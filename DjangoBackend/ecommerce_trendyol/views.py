import logging
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from .services import TrendyolAPIService
from .tasks import CATEGORIES_CACHE_KEY, refresh_trendyol_categories_cache, process_trendyol_webhook_order

logger = logging.getLogger(__name__)

# TTL-uri pentru cache-urile dinamice (branduri, atribute)
CACHE_TTL_DYNAMIC = 60 * 60 # 1 oră

class AccountIDMixin:
    """
    Mixin pentru a extrage și valida 'account_id' din query params.
    """
    def get_account_id(self, request):
        account_id_str = request.query_params.get('account_id', None)
        if not account_id_str:
            raise Exception("Query parameter-ul 'account_id' este obligatoriu.")
        try:
            return int(account_id_str)
        except ValueError:
            raise Exception("Query parameter-ul 'account_id' trebuie să fie un număr valid.")

class CategoryListView(APIView, AccountIDMixin): # <-- Am adăugat AccountIDMixin
    """
    View pentru a prelua arborele de categorii Trendyol.
    Citește direct din cache-ul Redis care este populat de un task Celery.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Cache-ul este global, deci nu avem nevoie de account_id pentru a-l citi
        categories_data = cache.get(CATEGORIES_CACHE_KEY)
        
        if categories_data:
            # Funcție simplă de filtrare recursivă
            def filter_categories(categories, query):
                filtered_list = []
                for category in categories:
                    # Verifică dacă numele categoriei se potrivește
                    if query.lower() in category.get('name', '').lower():
                        # Adaugă categoria și toate subcategoriile ei
                        filtered_list.append(category) 
                    else:
                        # Verifică recursiv subcategoriile
                        filtered_subcategories = filter_categories(category.get('subCategories', []), query)
                        if filtered_subcategories:
                            # Dacă se găsește o potrivire în subcategorii, adaugă părintele
                            filtered_category = category.copy()
                            filtered_category['subCategories'] = filtered_subcategories
                            filtered_list.append(filtered_category)
                return filtered_list
            
            # Aplică filtrarea (dacă există)
            search_query = request.query_params.get('search', None)
            if search_query:
                filtered_data = filter_categories(categories_data.get('categories', []), search_query)
                return Response({"categories": filtered_data})
            
            # Returnează datele complete dacă nu există căutare
            return Response(categories_data)

        # Dacă nu există în cache
        logger.warning(f"Cache miss pentru categorii: {CATEGORIES_CACHE_KEY}. Se declanșează task-ul.")
        
        try:
            # Pentru a porni task-ul, avem nevoie de *un* cont.
            # Folosim noul mixin pentru a-l valida.
            account_id = self.get_account_id(request) 
            refresh_trendyol_categories_cache.delay(account_id=account_id)
        except Exception as e:
             # Dacă nu e trimis niciun account_id, nu putem porni task-ul
             logger.warning(f"Cache-ul este gol, dar nu s-a putut porni task-ul de refresh: {e}")

        return Response(
            {"error": "Datele despre categorii sunt în curs de reîmprospătare. Vă rugăm să reîncercați în 30 de secunde."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


class BrandSearchView(APIView, AccountIDMixin): # <-- Am adăugat AccountIDMixin
    """
    View pentru a căuta branduri Trendyol.
    Folosește cache la nivel de cerere.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        brand_name = request.query_params.get('name', None)
        
        if not brand_name:
            return Response({"error": "Parametrul 'name' este obligatoriu."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Extragem ID-ul contului
            account_id = self.get_account_id(request)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Cache-ul este acum specific contului
        cache_key = f"trendyol:acc{account_id}:brand:{brand_name.lower().strip()}"
        cached_data = cache.get(cache_key)
        
        if cached_data:
            logger.info(f"Hit de cache pentru brand: {cache_key}")
            return Response({"brands": cached_data})
        
        logger.info(f"Cache miss pentru brand: {cache_key}. Se apelează API-ul.")
        try:
            # Instanțiem serviciul cu contul corect
            service = TrendyolAPIService(user=request.user, account_id=account_id)
            brand_data = service.get_brand_by_name(brand_name)
            
            cache.set(cache_key, brand_data, timeout=CACHE_TTL_DYNAMIC)
            
            return Response({"brands": brand_data})
        except Exception as e:
            logger.error(f"Eroare la căutarea brand-ului {brand_name}: {e}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CategoryAttributeView(APIView, AccountIDMixin): # <-- Am adăugat AccountIDMixin
    """
    View pentru a prelua atributele unei categorii.
    Folosește cache la nivel de categorie.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id, *args, **kwargs):
        try:
            # Extragem ID-ul contului
            account_id = self.get_account_id(request)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Cache-ul este acum specific contului și categoriei
        cache_key = f"trendyol:acc{account_id}:attributes:{category_id}"
        cached_data = cache.get(cache_key)
        
        if cached_data:
            logger.info(f"Hit de cache pentru atribute: {cache_key}")
            return Response(cached_data)
        
        logger.info(f"Cache miss pentru atribute: {cache_key}. Se apelează API-ul.")
        try:
            # Instanțiem serviciul cu contul corect
            service = TrendyolAPIService(user=request.user, account_id=account_id)
            attribute_data = service.get_attributes(category_id)
            
            cache.set(cache_key, attribute_data, timeout=CACHE_TTL_DYNAMIC)
            
            return Response(attribute_data)
        except Exception as e:
            logger.error(f"Eroare la preluarea atributelor pentru categoria {category_id}: {e}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class TrendyolOrderWebhookView(APIView):
    """
    Endpoint pentru a primi notificări de comenzi de la Trendyol.
    URL-ul va fi setat în panoul Trendyol ca: https://api.atlasai.ro/api/v2/ecommerce/trendyol/webhook/orders/{seller_id}/
    """
    permission_classes = [AllowAny] # Trendyol nu trimite token de user Django

    def post(self, request, seller_id, *args, **kwargs):
        # 1. Validare de bază (Opțional: verificare Basic Auth header dacă a fost configurat în Trendyol)
        # Trendyol trimite "Authorization" header dacă ați configurat Basic Auth în webhook.
        # Pentru moment, acceptăm cererea și validăm seller_id-ul în task.
        
        data = request.data
        if not data:
             return Response({"error": "No data received"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Pornire Task Asincron
        # Răspundem Trendyol-ului imediat cu 200 OK pentru a nu considera webhook-ul eșuat.
        process_trendyol_webhook_order.delay(data=data, seller_id=seller_id)

        return Response({"status": "received"}, status=status.HTTP_200_OK)