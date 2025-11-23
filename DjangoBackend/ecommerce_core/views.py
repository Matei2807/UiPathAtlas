import os
import tempfile
from .services import InvoiceProcessorService, run_bundle_generation_service
from rest_framework import viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Bundle, MarketplaceAccount, MarketplaceListing, Order, ReturnRequest, Product, ProductVariant, BundleComponent
from .serializers import BundleSerializer, InvoiceUploadSerializer, MarketplaceAccountSerializer, MarketplaceListingSerializer, OrderSerializer, ReturnRequestSerializer, ProductVariantListSerializer, ProductVariantDetailSerializer
from ecommerce_trendyol.tasks import publish_trendyol_listing, set_order_status_picking, set_order_status_invoiced, import_trendyol_products_task
from ecommerce_trendyol.services import TrendyolAPIService
from .models import SystemEvent
from .serializers import SystemEventSerializer

class ProductVariantViewSet(viewsets.ModelViewSet):
    """
    API principal pentru gestionarea catalogului de produse (PIM).
    """
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sku', 'barcode', 'product__title', 'product__brand']
    ordering_fields = ['created_at', 'stock', 'price']
    ordering = ['-created_at']

    def get_queryset(self):
        """
        Returnează doar variantele utilizatorului curent.
        Optimizat cu select_related și prefetch_related pentru a evita N+1 queries.
        """
        user = self.request.user
        return ProductVariant.objects.filter(product__account=user)\
            .select_related('product')\
            .prefetch_related(
                'listings', 
                'listings__platform_account',
                'bundle_components',
                'bundle_components__component_variant',
                'bundle_components__component_variant__product'
            )

    def get_serializer_class(self):
        """
        Folosește un serializer sumar pentru listă și unul detaliat pentru click pe produs.
        """
        if self.action == 'list':
            return ProductVariantListSerializer
        return ProductVariantDetailSerializer

    @action(detail=False, methods=['post'])
    def create_bundle(self, request):
        """
        Endpoint pentru a crea un Bundle complet configurat.
        Body JSON așteptat:
        {
            "sku": "SET-VARA-2025",          # Obligatoriu
            "title": "Set Complet de Vară",  # Obligatoriu
            "description": "Descriere...",   # Opțional
            "brand": "Nume Brand",           # Opțional (default: Generic)
            "price": 150.00,                 # Preț final (Vânzare)
            "list_price": 199.99,            # Preț de bază (Tăiat) - Opțional
            "barcode": "EAN123...",          # Opțional
            "images": ["url1.jpg", ...],     # Listă URL-uri imagini
            "components": [                  # Lista de produse incluse
                {"variant_id": 10, "quantity": 1},
                {"variant_id": 12, "quantity": 2}
            ]
        }
        """
        data = request.data
        user = request.user
        
        try:
            # 1. Extragem datele pentru Produsul Părinte (Product)
            sku = data.get('sku')
            if not sku:
                return Response({"error": "SKU este obligatoriu."}, status=400)

            title = data.get('title')
            if not title:
                return Response({"error": "Titlul este obligatoriu."}, status=400)

            description = data.get('description', '')
            brand = data.get('brand', 'Generic') # Default Generic dacă nu e trimis

            # Creăm Părintele
            product = Product.objects.create(
                account=user,
                sku=sku, # La bundle, SKU-ul părintelui e adesea același cu al variantei unice
                title=title,
                brand=brand,
                description=description
            )
            
            # 2. Extragem datele pentru Variantă (ProductVariant - Bundle)
            price = data.get('price', 0)           # Preț final
            list_price = data.get('list_price')    # Preț tăiat (Base Price)
            barcode = data.get('barcode', '')
            
            # Gestionare Imagini
            # Frontend-ul poate trimite un array de string-uri ["url1", "url2"]
            images_data = data.get('images', [])
            formatted_images = []
            for img in images_data:
                if isinstance(img, str):
                    formatted_images.append(img) # Salvăm direct string-ul URL
                elif isinstance(img, dict) and 'url' in img:
                    formatted_images.append(img['url']) # Extragem URL dacă e obiect

            # Creăm Varianta de tip Bundle
            bundle_variant = ProductVariant.objects.create(
                product=product,
                type=ProductVariant.Type.BUNDLE,
                sku=sku,
                barcode=barcode,
                price=price,
                list_price=list_price, # Salvăm și prețul de bază
                images=formatted_images, # Salvăm imaginile
                stock=0 # Se va calcula automat mai jos
            )
            
            # 3. Adăugare Componente
            components_data = data.get('components', [])
            if not components_data:
                 return Response({"error": "Un bundle trebuie să aibă cel puțin o componentă."}, status=400)

            for comp in components_data:
                component_variant = None
                
                # Cazul A: Avem ID (ideal)
                if 'variant_id' in comp and comp['variant_id']:
                    try:
                        component_variant = ProductVariant.objects.get(id=comp['variant_id'], product__account=user)
                    except ProductVariant.DoesNotExist:
                        pass
                
                # Cazul B: Avem SKU (fallback din generator)
                if not component_variant and 'sku' in comp:
                    try:
                        component_variant = ProductVariant.objects.get(sku=comp['sku'], product__account=user)
                    except ProductVariant.DoesNotExist:
                        return Response({"error": f"Componenta cu SKU '{comp['sku']}' nu a fost găsită în contul tău. Importă produsele mai întâi!"}, status=400)

                if component_variant:
                    BundleComponent.objects.create(
                        bundle_variant=bundle_variant,
                        component_variant=component_variant,
                        quantity=comp.get('quantity', 1)
                    )
                else:
                     return Response({"error": "Componentă invalidă (lipsește ID sau SKU valid)."}, status=400)
                
            # Trigger recalculare stoc (esențial pentru a avea stocul corect din prima secundă)
            # Deși avem semnale, e mai sigur să forțăm un calcul aici pentru răspunsul API
            bundle_variant.stock = bundle_variant.calculate_bundle_stock()
            bundle_variant.save()

            # Returnăm obiectul complet folosind serializer-ul detaliat
            return Response(ProductVariantDetailSerializer(bundle_variant).data, status=201)

        except Exception as e:
            # Dacă ceva eșuează, ar fi ideal să ștergem produsul parțial creat (rollback),
            # but Django does that automatically only if we set `ATOMIC_REQUESTS` or use `transaction.atomic()`.
            # For simplicity now, we return the error.
            return Response({"error": str(e)}, status=400)

class MarketplaceAccountViewSet(viewsets.ModelViewSet):
    """
    API ViewSet pentru a gestiona Conturile Marketplace (Onboarding).
    Permite operații CRUD complete (Create, Read, Update, Delete)
    dar filtrate doar pentru utilizatorul autentificat.
    """
    serializer_class = MarketplaceAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Securitate: Acest ViewSet returnează DOAR conturile
        care aparțin utilizatorului autentificat.
        """
        return MarketplaceAccount.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """
        La creare, setează automat 'user'-ul ca fiind
        utilizatorul care face cererea.
        """
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def import_products(self, request, pk=None):
        """
        Declanșează importul tuturor produselor existente de pe acest cont Marketplace
        în baza de date locală (PIM).
        """
        account = self.get_object()
        
        if account.platform != MarketplaceAccount.Platform.TRENDYOL:
            return Response({"error": "Importul este disponibil momentan doar pentru Trendyol."}, status=400)
            
        # Pornim task-ul
        import_trendyol_products_task.delay(account.id)
        
        return Response({
            "status": "processing",
            "message": f"Importul produselor pentru {account.name} a început în fundal. Poate dura câteva minute."
        })

class MarketplaceListingViewSet(viewsets.ModelViewSet):
    """
    API ViewSet pentru a gestiona "Listările" pe Marketplace.
    Acesta este API-ul central "Smart Hub".
    """
    serializer_class = MarketplaceListingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Returnează doar listările care aparțin utilizatorului autentificat.
        """
        return MarketplaceListing.objects.filter(account=self.request.user)

    def perform_create(self, serializer):
        """
        Interceptăm crearea pentru a seta statusul și a porni task-ul Celery.
        """
        # 1. Salvează listarea cu statusul inițial "PENDING_CREATE"
        listing = serializer.save(
            account=self.request.user, 
            status=MarketplaceListing.Status.PENDING_CREATE
        )

        # 2. Pornește task-ul Celery specific platformei
        if listing.platform_account.platform == MarketplaceAccount.Platform.TRENDYOL:
            # Trimite ID-ul listării către task-ul Celery
            publish_trendyol_listing.delay(listing_id=listing.id)
            
        # elif listing.platform_account.platform == MarketplaceAccount.Platform.EMAG:
        #     publish_emag_listing.delay(listing_id=listing.id) # Pentru viitor
        
        # Nu așteptăm finalizarea task-ului. Răspundem imediat.

class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Gestionează vizualizarea comenzilor și acțiunile pe ele.
    Este ReadOnly pentru că nu creăm comenzi manual, ele vin din integrări.
    """
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(account=self.request.user).order_by('-order_date')

    @action(detail=True, methods=['post'])
    def mark_picking(self, request, pk=None):
        """
        Butonul 'Începe Pregătirea' din Frontend.
        """
        order = self.get_object()
        
        if order.status != Order.Status.CREATED:
            return Response({"error": "Doar comenzile 'Created' pot trece în 'Picking'."}, status=400)
            
        # Pornim task-ul asincron
        set_order_status_picking.delay(order.id)
        
        return Response({"status": "processing", "message": "Comanda se marchează ca Picking..."})

    @action(detail=True, methods=['post'])
    def mark_invoiced(self, request, pk=None):
        """
        Butonul 'Marchează Facturat' din Frontend.
        Necesită 'invoice_number' în body.
        """
        order = self.get_object()
        invoice_number = request.data.get('invoice_number')
        
        if not invoice_number:
            return Response({"error": "Numărul facturii este obligatoriu."}, status=400)
            
        # Pornim task-ul asincron
        set_order_status_invoiced.delay(order.id, invoice_number)
        
        return Response({"status": "processing", "message": "Comanda se marchează ca Facturată..."})
    
    @action(detail=True, methods=['get'])
    def label(self, request, pk=None):
        """
        Returnează URL-ul PDF-ului de AWB.
        """
        order = self.get_object()
        
        if not order.platform_package_id:
             return Response({"error": "Comanda nu are un ID de pachet valid."}, status=400)

        # Logica pentru a găsi AWB-ul depinde de platformă
        if order.platform_account.platform == MarketplaceAccount.Platform.TRENDYOL:
            try:
                service = TrendyolAPIService(user=order.account, account_id=order.platform_account.id)
                
                # Trebuie să găsim tracking number-ul. 
                # În modelul tău Order nu ai stocat explicit 'cargoTrackingNumber'.
                # Opțiunea 1: Facem un request 'get_orders' rapid către Trendyol pentru a lua datele fresh.
                # Opțiunea 2: Îl stocăm în Order model (Recomandat pe viitor).
                
                # Mergem pe Opțiunea 1 pentru siguranță acum:
                trendyol_order_data = service.get_orders(status=order.status, size=50) # Căutăm comanda
                # Filtrare manuală în răspuns (ineficient dar sigur momentan)
                target_pkg = None
                if trendyol_order_data and 'content' in trendyol_order_data:
                    for pkg in trendyol_order_data['content']:
                        if str(pkg.get('id')) == str(order.platform_package_id):
                            target_pkg = pkg
                            break
                
                if target_pkg and target_pkg.get('cargoTrackingNumber'):
                    url = service.get_common_label(target_pkg.get('cargoTrackingNumber'))
                    if url:
                        return Response({"label_url": url})
                    else:
                        return Response({"error": "Nu s-a putut genera eticheta. Verificați statusul comenzii."}, status=404)
                else:
                     return Response({"error": "Tracking number nu a fost găsit pe Trendyol."}, status=404)

            except Exception as e:
                return Response({"error": str(e)}, status=500)
        
        return Response({"error": "Platforma nu suportă generarea de etichete prin acest API."}, status=400)

    @action(detail=True, methods=['post'])
    def cancel_item(self, request, pk=None):
        """
        Anulează un item.
        Body: { "line_item_id": "DB_ID_OR_PLATFORM_ID", "quantity": 1, "reason_id": 500 }
        """
        order = self.get_object()
        line_id_param = request.data.get('line_item_id')
        quantity = request.data.get('quantity')
        reason_id = request.data.get('reason_id')

        if not all([line_id_param, quantity, reason_id]):
            return Response({"error": "Lipsesc parametri (line_item_id, quantity, reason_id)"}, status=400)

        # Găsim linia în DB
        try:
            # Presupunem că frontend trimite ID-ul din baza de date locală
            line_item = order.items.get(id=line_id_param)
        except:
            return Response({"error": "Item-ul nu aparține acestei comenzi."}, status=404)

        if order.platform_account.platform == MarketplaceAccount.Platform.TRENDYOL:
            # Putem face asta asincron prin Celery, sau sincron. 
            # Pentru feedback rapid la user, o facem sincron acum, dar ideal e Celery.
            try:
                service = TrendyolAPIService(user=order.account, account_id=order.platform_account.id)
                service.cancel_order_item(
                    package_id=order.platform_package_id,
                    line_item_id=line_item.platform_order_line_id, # ID-ul de platformă
                    quantity=quantity,
                    reason_id=reason_id
                )
                # Actualizăm local statusul (simplificat)
                line_item.status = "Cancelled"
                line_item.save()
                return Response({"status": "success", "message": "Item anulat."})
            except Exception as e:
                return Response({"error": str(e)}, status=500)

        return Response({"error": "Platforma nu suportă anularea."}, status=400)
    
class ReturnRequestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return ReturnRequest.objects.filter(account=self.request.user).order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        from ecommerce_trendyol.tasks import approve_return_task
        approve_return_task.delay(pk)
        return Response({"status": "processing"})

    # Reject necesită fișier, deci e mai bine să fie un endpoint care primește form-data
    # și apelează serviciul direct (sincron) sau salvează fișierul și apoi task-ul.

class InvoiceImportViewSet(viewsets.ViewSet):
    @action(detail=False, methods=['post'])
    def process(self, request):
        serializer = InvoiceUploadSerializer(data=request.data)
        if serializer.is_valid():
            uploaded_file = serializer.validated_data['file']
            file_name = uploaded_file.name

            event = SystemEvent.objects.create(
                message=f"Am detectat factura: {file_name}. Încep analiza AI...",
                status="processing"
            )
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name

            try:
                # MODIFICARE AICI: Trimitem user-ul curent către serviciu
                service = InvoiceProcessorService(user=request.user)
                
                data = service.process_invoice(temp_file_path, max_items=5)

                # 2. ACTUALIZĂM LOGUL: "Gata!"
                event.message = f"Procesare finalizată pentru {file_name}!"
                event.status = "completed"
                event.save()
                
                return Response({
                    "status": "success",
                    "data": data
                })
                
            except Exception as e:
                # 3. ACTUALIZĂM LOGUL: "Eroare"
                event.message = f"Eroare la {file_name}: {str(e)}"
                event.status = "error"
                event.save()
                return Response({"error": str(e)}, status=500)
                
            finally:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
        
        return Response(serializer.errors, status=400)
    
class BundleViewSet(viewsets.ModelViewSet):
    """
    CRUD pentru Pachetele SALVATE în baza de date.
    """
    queryset = Bundle.objects.all().order_by('-created_at')
    serializer_class = BundleSerializer
    permission_classes = [permissions.IsAuthenticated]

class BundleGeneratorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            limit = int(request.data.get('limit', 5))
            suggestions = run_bundle_generation_service(limit=limit)
            return Response({
                "status": "success",
                "count": len(suggestions),
                "suggestions": suggestions
            })
        except Exception as e:
            # Log error for debug
            import traceback
            traceback.print_exc()
            return Response({"error": f"Eroare generare: {str(e)}"}, status=500)
        
class SystemEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemEvent.objects.all()
    serializer_class = SystemEventSerializer
    permission_classes = [permissions.AllowAny] # Sau IsAuthenticated, depinde de token

    @action(detail=False, methods=['get'])
    def latest(self, request):
        # Returnează cel mai recent eveniment
        latest_event = SystemEvent.objects.first()
        if latest_event:
            return Response(SystemEventSerializer(latest_event).data)
        return Response({})