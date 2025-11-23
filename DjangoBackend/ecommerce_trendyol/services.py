import requests
import base64
import logging
from django.conf import settings
from datetime import datetime, timezone
from ecommerce_core.models import Order, OrderLineItem, ProductVariant, MarketplaceAccount

logger = logging.getLogger(__name__)

class TrendyolAPIService:
    """
    Un client pentru a interacționa cu API-ul Trendyol.
    Gestionează autentificarea și construcția cererilor.
    """
    
    # URL-uri de bază
    BASE_URL_PRODUCT = "https://apigw.trendyol.com/integration/product"
    BASE_URL_SELLER = "https://apigw.trendyol.com/integration/product/sellers"

    
    def __init__(self, user, account_id: int):
        """
        Initializează serviciul pentru un utilizator specific ȘI un cont specific.
        """
        self.user = user
        self.account_id = account_id
        self.account = self._get_account()
        self.headers = self._get_auth_headers()
        
        # Construim URL-ul specific seller-ului
        self.seller_base_url = f"{self.BASE_URL_SELLER}/{self.account.seller_id}"

    def _get_account(self):
        """
        Prelucrează contul Trendyol specific cerut de utilizator.
        """
        try:
            account = MarketplaceAccount.objects.get(
                id=self.account_id,
                user=self.user, 
                platform=MarketplaceAccount.Platform.TRENDYOL
            )
            return account
        except MarketplaceAccount.DoesNotExist:
            logger.error(f"Contul Trendyol cu ID={self.account_id} nu a fost găsit SAU nu aparține utilizatorului {self.user.id}")
            raise Exception(f"Contul Marketplace (ID: {self.account_id}) nu a fost găsit sau nu aveți permisiunea.")

    def _get_auth_headers(self):
        """
        Construiește header-ul de autentificare Basic Auth.
        """
        if not self.account:
            raise Exception("Autentificare eșuată: contul nu a putut fi încărcat.")
            
        auth_string = f"{self.account.api_key}:{self.account.api_secret}"
        encoded_auth = base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")
        
        return {
            "Authorization": f"Basic {encoded_auth}",
            "User-Agent": f"AtlasAI-Platform (SellerID: {self.account.seller_id})",
            "storeFrontCode": self.account.store_front_code,
            "Content-Type": "application/json"
        }

    def _make_request(self, method, base_url, endpoint, params=None, json_data=None):
        """
        Metodă ajutătoare generică pentru a executa cereri HTTP.
        """
        url = f"{base_url}{endpoint}"
        try:
            response = requests.request(
                method, 
                url, 
                headers=self.headers, 
                params=params, 
                json=json_data,
                timeout=15 # Adăugăm un timeout de 15 secunde
            )
            response.raise_for_status() # Aruncă excepție pentru status codes 4xx/5xx
            
            # Unele răspunsuri de succes (ex: PUT, DELETE) pot fi goale
            if response.status_code == 204: # 204 No Content
                return {"status": "success", "status_code": 204}
                
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            logger.error(f"Eroare HTTP la apelul Trendyol API {url}: {http_err} - Răspuns: {response.text}")
            # Încercăm să parsăm eroarea JSON de la Trendyol
            try:
                error_data = response.json()
                raise Exception(f"Eroare API Trendyol: {response.status_code} - {error_data}")
            except requests.JSONDecodeError:
                raise Exception(f"Eroare API Trendyol: {response.status_code} - {response.text}")
        except requests.exceptions.RequestException as req_err:
            logger.error(f"Eroare la conectarea la Trendyol API {url}: {req_err}")
            raise Exception(f"Eroare de rețea la conectarea la Trendyol: {req_err}")

    # --- Metodele de Citire (Etapa 2) ---

    def get_categories(self):
        logger.info(f"Preluare arbore categorii Trendyol pentru contul {self.account_id}")
        return self._make_request("GET", self.BASE_URL_PRODUCT, "/product-categories")

    def get_brand_by_name(self, name: str):
        if not name:
            return []
        logger.info(f"Căutare brand Trendyol (cont {self.account_id}): {name}")
        return self._make_request("GET", self.BASE_URL_PRODUCT, "/brands/by-name", params={"name": name})

    def get_attributes(self, category_id: int):
        logger.info(f"Preluare atribute (cont {self.account_id}) pentru categoria Trendyol: {category_id}")
        return self._make_request("GET", self.BASE_URL_PRODUCT, f"/product-categories/{category_id}/attributes", params={"locale": "en"})

    # --- Metodele de Scriere (Etapa 3) ---

    def create_products(self, payload: dict):
        """
        Creează produse noi.
        (POST /integration/product/sellers/{sellerId}/products)
        """
        logger.info(f"Creare produs (cont {self.account_id})...")
        # Folosim URL-ul specific seller-ului
        return self._make_request("POST", self.seller_base_url, "/products", json_data=payload)

    def get_batch_status(self, batch_id: str):
        """
        Verifică statusul unui batch request.
        (GET /integration/product/sellers/{sellerId}/products/batch-requests/{batchId})
        """
        logger.info(f"Verificare batch (cont {self.account_id}): {batch_id}")
        return self._make_request("GET", self.seller_base_url, f"/products/batch-requests/{batch_id}")
    
    def process_order_data(self, order_data: dict):
        """
        Procesează datele unei comenzi (venite din Webhook sau Polling)
        și le salvează/actualizează în baza de date locală.
        """
        package_id = str(order_data.get('id')) # shipmentPackageId
        order_number = str(order_data.get('orderNumber'))
        
        # Conversie dată (Trendyol trimite timestamp în milisecunde)
        timestamp = order_data.get('orderDate', 0)
        order_date = datetime.fromtimestamp(timestamp / 1000.0, tz=timezone.utc)

        # 1. Creare sau Actualizare Comandă (Order)
        order, created = Order.objects.update_or_create(
            platform_package_id=package_id,
            defaults={
                'account': self.user,
                'platform_account': self.account,
                'platform_order_number': order_number,
                'total_price': order_data.get('totalPrice', 0),
                'currency': order_data.get('currencyCode', 'RON'),
                'customer_first_name': order_data.get('customerFirstName', ''),
                'customer_last_name': order_data.get('customerLastName', ''),
                'customer_email': order_data.get('customerEmail', ''),
                'shipping_address': order_data.get('shipmentAddress', {}),
                'invoice_address': order_data.get('invoiceAddress', {}),
                'status': order_data.get('status', 'Unknown'),
                'order_date': order_date
            }
        )

        logger.info(f"{'Comandă nouă creată' if created else 'Comandă actualizată'}: {order_number} (Pkg: {package_id})")

        # 2. Procesare Linii Comandă (Lines)
        lines = order_data.get('lines', [])
        
        # Păstrăm un set cu ID-urile liniilor curente pentru a șterge ce nu mai există (caz rar la update)
        current_line_ids = []

        for line in lines:
            line_id = str(line.get('id')) # orderLineId

            existing_line = OrderLineItem.objects.filter(
                platform_order_line_id=line_id, 
                order=order
            ).first()

            if existing_line:
                # Opțional: Putem actualiza statusul, dar NU scădem stocul din nou
                if existing_line.status != line.get('orderLineItemStatusName'):
                    existing_line.status = line.get('orderLineItemStatusName')
                    existing_line.save()
                continue # Trecem la următoarea linie, stocul e deja rezolvat

            merchant_sku = line.get('merchantSku', '')
            
            # Încercăm să găsim varianta locală după SKU
            local_variant = ProductVariant.objects.filter(
                sku=merchant_sku, 
                product__account=self.user
            ).first()

            if local_variant:
                # LOGICA NOUĂ PENTRU STOC
                qty_ordered = line.get('quantity', 0)
                
                if local_variant.type == ProductVariant.Type.BUNDLE:
                    # E un bundle: scădem stocul din componente
                    components = local_variant.bundle_components.all()
                    for comp in components:
                        needed_qty = comp.quantity * qty_ordered
                        # Scădem stocul componentei (atomic ar fi ideal, dar simplificăm aici)
                        comp_variant = comp.component_variant
                        comp_variant.stock = max(0, comp_variant.stock - needed_qty)
                        comp_variant.save() 
                        # Notă: comp_variant.save() va declanșa semnalul care recalculează stocul bundle-ului
                        # și va trimite noul stoc la Trendyol automat!
                else:
                    # E produs simplu
                    local_variant.stock = max(0, local_variant.stock - qty_ordered)
                    local_variant.save()

            # Salvare Linie
            line_item, _ = OrderLineItem.objects.update_or_create(
                order=order,
                platform_order_line_id=line_id,
                defaults={
                    'variant': local_variant,
                    'sku': merchant_sku,
                    'product_name': line.get('productName', ''),
                    'quantity': line.get('quantity', 0),
                    'price': line.get('price', 0),
                    'vat_rate': line.get('vatBaseAmount', 0),
                    'status': line.get('orderLineItemStatusName', '')
                }
            )
            current_line_ids.append(line_item.id)

            # Aici am putea scădea stocul local (rezervare), dar e mai sigur să o facem
            # într-un pas separat de procesare a stocului.

        return order
    
    def get_orders(self, status="Created", start_date=None, end_date=None):
        """
        Interoghează comenzile (Polling).
        (GET /integration/order/sellers/{sellerId}/orders)
        """
        params = {
            "status": status,
            "orderByField": "PackageLastModifiedDate",
            "orderByDirection": "DESC",
            "size": 50 # Paginare implicită
        }

        # Conversie date în timestamp (milisecunde)
        if start_date:
            params["startDate"] = int(start_date.timestamp() * 1000)
        if end_date:
            params["endDate"] = int(end_date.timestamp() * 1000)

        logger.info(f"Polling comenzi Trendyol (Cont: {self.account_id}, Status: {status})...")
        # Endpoint-ul de comenzi e în folderul 'order', diferit de 'product'
        # URL de bază: https://apigw.trendyol.com/integration/order/sellers/{sellerId}/orders
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        return self._make_request("GET", base_url_order, "/orders", params=params)

    def update_package_status_picking(self, package_id, lines):
        """
        Setează statusul la 'Picking'. 
        Critic: Blochează anularea din partea clientului.
        """
        logger.info(f"Setare status 'Picking' pentru pachetul {package_id}...")
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        payload = {
            "status": "Picking",
            "lines": lines # Lista de obiecte {lineId, quantity}
        }
        
        return self._make_request("PUT", base_url_order, f"/shipment-packages/{package_id}", json_data=payload)

    def update_package_status_invoiced(self, package_id, lines, invoice_number):
        """
        Setează statusul la 'Invoiced'.
        Necesită numărul facturii.
        """
        logger.info(f"Setare status 'Invoiced' pentru pachetul {package_id}...")
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        payload = {
            "status": "Invoiced",
            "lines": lines,
            "params": {
                "invoiceNumber": invoice_number
            }
        }
        
        return self._make_request("PUT", base_url_order, f"/shipment-packages/{package_id}", json_data=payload)
    
    def get_claims(self, status="WaitingInAction"):
        """
        Preluare retururi. Statusul default 'WaitingInAction' este cel care necesită atenție.
        """
        logger.info(f"Preluare retururi ({status}) pentru contul {self.account_id}...")
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        # Endpoint: /claims
        return self._make_request("GET", base_url_order, "/claims", params={"claimItemStatus": status})

    def approve_claim_items(self, claim_id, line_item_ids: list):
        """
        Aprobă returul.
        """
        logger.info(f"Aprobare retur {claim_id} pentru itemii {line_item_ids}")
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        payload = {
            "claimLineItemIdList": line_item_ids,
            "params": {}
        }
        return self._make_request("PUT", base_url_order, f"/claims/{claim_id}/items/approve", json_data=payload)

    def reject_claim_items(self, claim_id, line_item_ids: list, reason_id: int, description: str, file_obj=None):
        """
        Respinge returul. Necesită motiv și fișier (dovadă).
        ATENȚIE: Folosește multipart/form-data.
        """
        logger.info(f"Respingere retur {claim_id}...")
        
        # URL-ul complet
        url = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}/claims/{claim_id}/issue"
        
        # Parametrii query string
        params = {
            "claimIssueReasonId": reason_id,
            "claimItemIdList": ",".join(line_item_ids), # Trendyol cere listă separată prin virgulă
            "description": description
        }
        
        # Pregătirea fișierelor (Dovada)
        files = {}
        if file_obj:
            # file_obj trebuie să fie un obiect fișier deschis sau un InMemoryUploadedFile din Django
            files = {'files': ('evidence.jpg', file_obj, 'image/jpeg')}

        # Construim headerele DOAR pentru această cerere (fără Content-Type: application/json)
        # Requests va pune automat multipart/form-data și boundary-ul.
        custom_headers = self.headers.copy()
        custom_headers.pop("Content-Type", None)

        try:
            response = requests.post(
                url, 
                headers=custom_headers, 
                params=params, 
                files=files,
                timeout=30
            )
            response.raise_for_status()
            return {"status": "success", "code": response.status_code}
        except Exception as e:
            logger.error(f"Eroare la respingerea returului: {e}")
            raise

    def get_all_products_generator(self, batch_size=100):
        """
        Generator care iterează prin toate paginile de produse de pe Trendyol.
        Returnează produsele unul câte unul pentru a nu umple memoria.
        """
        page = 0
        total_elements = 0
        
        logger.info(f"Începe importul complet de produse pentru contul {self.account_id}...")
        
        while True:
            params = {
                "page": page,
                "size": batch_size,
                # Putem adăuga "approved": True dacă vrem doar cele aprobate
            }
            
            # GET /integration/product/sellers/{sellerId}/products
            # Folosim endpoint-ul de filtrare
            response = self._make_request("GET", self.seller_base_url, "/products", params=params)
            
            content = response.get('content', [])
            if not content:
                break # Nu mai sunt produse
                
            for product in content:
                yield product
            
            # Verificăm dacă am ajuns la final
            total_elements = response.get('totalElements', 0)
            total_pages = response.get('totalPages', 0)
            
            logger.info(f"Importat pagina {page}/{total_pages} (Total items: {total_elements})")
            
            page += 1
            if page >= total_pages:
                break

    def get_common_label(self, cargo_tracking_number):
        """
        Preia link-ul către PDF-ul etichetei (AWB) pentru Trendyol Pays.
        GET /integration/sellers/{sellerId}/common-label/query?id={trackingNumber}
        """
        logger.info(f"Preluare etichetă AWB pentru tracking: {cargo_tracking_number}")
        # Endpoint-ul de etichete este pe un base URL ușor diferit (fără /product sau /order)
        # URL: https://apigw.trendyol.com/integration/sellers/{sellerId}/common-label/query
        base_url_common = f"https://apigw.trendyol.com/integration/sellers/{self.account.seller_id}"
        
        response = self._make_request("GET", base_url_common, "/common-label/query", params={"id": cargo_tracking_number})
        
        # Răspunsul e de forma: {"data": [{"label": "url...", "format": "PDF"}]}
        data = response.get("data", [])
        if data and len(data) > 0:
            return data[0].get("label")
        return None

    # --- ORDER ACTIONS (Cancel & Split) ---

    def cancel_order_item(self, package_id, line_item_id, quantity, reason_id):
        """
        Anulează un item dintr-o comandă (înainte de livrare).
        PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/items/unsupplied
        """
        logger.info(f"Anulare item {line_item_id} (Cantitate: {quantity}) din pachetul {package_id}...")
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        payload = {
            "lines": [{
                "lineId": int(line_item_id),
                "quantity": int(quantity)
            }],
            "reasonId": int(reason_id),
            "shouldKeepPreviousStatus": True # De obicei vrem să păstrăm statusul restului pachetului
        }
        
        return self._make_request("PUT", base_url_order, f"/shipment-packages/{package_id}/items/unsupplied", json_data=payload)

    def split_package(self, package_id, order_line_ids):
        """
        Împarte un pachet existent în două. Liniile specificate vor fi mutate într-un pachet NOU.
        POST /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/split
        """
        logger.info(f"Split pachet {package_id} pentru liniile {order_line_ids}...")
        base_url_order = f"https://apigw.trendyol.com/integration/order/sellers/{self.account.seller_id}"
        
        # order_line_ids trebuie să fie o listă de int-uri
        payload = {
            "orderLineIds": [int(x) for x in order_line_ids],
            "shouldKeepPreviousStatus": True
        }
        
        return self._make_request("POST", base_url_order, f"/shipment-packages/{package_id}/split", json_data=payload)