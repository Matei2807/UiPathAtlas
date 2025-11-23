import logging
from datetime import datetime, timedelta#, timezone
from django.utils import timezone
from celery import shared_task
from django.core.cache import cache
from django.contrib.auth.models import User
from ecommerce_core.models import MarketplaceAccount, MarketplaceListing, ProductVariant, Product, Order, ReturnRequest, ReturnLineItem
from celery.exceptions import MaxRetriesExceededError
import json
from .services import TrendyolAPIService

logger = logging.getLogger(__name__)

# Definim o cheie de cache globală
CATEGORIES_CACHE_KEY = "trendyol:global:categories"
CACHE_TTL_CATEGORIES = 60 * 60 * 25 # 25 de ore

@shared_task
def refresh_trendyol_categories_cache(account_id=None):
    """
    Task Celery care preia arborele de categorii Trendyol și îl salvează în cache-ul Redis.
    Rulează periodic (ex: noaptea) prin Celery Beat.
    """
    logger.info("Începe task-ul 'refresh_trendyol_categories_cache'...")
    
    try:
        if account_id:
            account = MarketplaceAccount.objects.get(
                id=account_id,
                platform=MarketplaceAccount.Platform.TRENDYOL
            )
        else:
            # Dacă rulează din BEAT (fără ID), ia primul cont pe care îl găsește
            account = MarketplaceAccount.objects.filter(
                platform=MarketplaceAccount.Platform.TRENDYOL
            ).first()

        if not account:
            logger.warning("Niciun cont Trendyol găsit în sistem. Task-ul de cache categorii se oprește.")
            return

        # Folosim utilizatorul și ID-ul contului pentru a instanția serviciul
        service = TrendyolAPIService(user=account.user, account_id=account.id)
        categories_data = service.get_categories()
        
        # Salvăm datele în cache-ul Redis
        cache.set(CATEGORIES_CACHE_KEY, categories_data, timeout=CACHE_TTL_CATEGORIES)
        
        logger.info(f"Cache-ul de categorii Trendyol (cheie: {CATEGORIES_CACHE_KEY}) a fost reîmprospătat cu succes folosind contul {account.id}.")
    except Exception as e:
        logger.error(f"Eroare la reîmprospătarea cache-ului de categorii Trendyol: {e}", exc_info=True)

@shared_task(bind=True)
def publish_trendyol_listing(self, listing_id: int):
    """
    Task Celery pentru a construi și trimite o cerere de creare produs la Trendyol.
    """
    logger.info(f"Începe publicarea listing-ului {listing_id}...")
    try:
        # Preluăm listarea și modelele asociate dintr-o singură interogare
        listing = MarketplaceListing.objects.select_related(
            'variant', 'variant__product', 'platform_account', 'account'
        ).get(id=listing_id)
        
        # 1. Extragem datele
        variant = listing.variant
        product = variant.product
        
        # 2. Logica pentru stoc și preț
        price_to_send = listing.price_override if listing.price_override else variant.price
        base_list_price = variant.list_price if variant.list_price else variant.price
        list_price_to_send = max(base_list_price, price_to_send)

        stock_to_send = 0
        if listing.stock_override is not None:
            # Trimite valoarea fixă, dar nu mai mult decât stocul real
            stock_to_send = min(listing.stock_override, variant.stock)
        else:
            # Trimite stocul real
            stock_to_send = variant.stock

        # 3. Asamblare Payload
        # (Folosim SKU-ul produsului PĂRINTE ca productMainId pentru a grupa variantele)
        item_payload = {
            "barcode": variant.barcode,
            "stockCode": variant.sku,
            "title": product.title,
            "productMainId": product.sku, # Folosim SKU-ul părintelui
            "brandId": int(listing.platform_brand_id), # Asigurăm că e int
            "categoryId": int(listing.platform_category_id), # Asigurăm că e int
            "quantity": int(stock_to_send),
            "description": product.description,
            "salePrice": float(price_to_send),
            "listPrice": float(list_price_to_send), # Simplificare: listPrice = salePrice
            "vatRate": int(listing.vat_rate), # Cota TVA
            "images": [{"url": url} for url in variant.images],
            "attributes": listing.platform_attributes # Acesta vine direct din JSON-ul salvat
        }

        if listing.shipment_address_id:
            item_payload["shipmentAddressId"] = listing.shipment_address_id
        if listing.returning_address_id:
            item_payload["returningAddressId"] = listing.returning_address_id
        
        payload = {"items": [item_payload]}
        logger.debug(f"Payload pentru listing {listing_id}: {json.dumps(payload, indent=2)}")

        # 4. Instanțiere Serviciu și Apel API
        service = TrendyolAPIService(user=listing.account, account_id=listing.platform_account.id)
        response = service.create_products(payload)
        
        batch_id = response.get('batchRequestId')
        if not batch_id:
            raise Exception("Răspunsul API Trendyol nu a conținut 'batchRequestId'")
        
        # 5. Salvare Batch ID și Pornire Task de Polling
        listing.platform_listing_id = batch_id
        listing.last_sync_status = "Trimis către Trendyol. Se așteaptă procesarea batch-ului."
        listing.save()
        
        # Pornim task-ul de verificare, cu o mică întârziere
        check_trendyol_batch_status.apply_async(
            args=[listing.id],
            countdown=60 # Verifică prima dată peste 1 minut
        )
        
        logger.info(f"Listing-ul {listing_id} a fost trimis. Batch ID: {batch_id}. Se așteaptă verificarea.")

    except Exception as e:
        logger.error(f"Eroare la publicarea listing-ului {listing_id}: {e}", exc_info=True)
        try:
            listing = MarketplaceListing.objects.get(id=listing_id)
            listing.status = MarketplaceListing.Status.FAILED
            listing.last_sync_status = str(e)
            listing.save()
        except MarketplaceListing.DoesNotExist:
            pass # Nu putem face nimic


@shared_task(bind=True, max_retries=10) # Reîncearcă de 10 ori
def check_trendyol_batch_status(self, listing_id: int):
    """
    Task Celery care face polling la Trendyol pentru a verifica statusul unui batch.
    """
    logger.info(f"Verificare status pentru listing {listing_id}...")
    try:
        listing = MarketplaceListing.objects.get(id=listing_id)
        
        if not listing.platform_listing_id:
            raise Exception(f"Listing-ul {listing_id} nu are batchRequestId salvat.")
        
        service = TrendyolAPIService(user=listing.account, account_id=listing.platform_account.id)
        response = service.get_batch_status(listing.platform_listing_id)
        
        batch_status = response.get('status')
        
        if batch_status == "COMPLETED":
            item_status = response.get('items', [{}])[0] # Luăm statusul primului item
            
            if item_status.get('status') == "SUCCESS":
                listing.status = MarketplaceListing.Status.ACTIVE
                listing.last_sync_status = "Publicat cu succes."
                listing.save()
                logger.info(f"Listing-ul {listing_id} este acum ACTIV.")
            else:
                listing.status = MarketplaceListing.Status.FAILED
                listing.last_sync_status = json.dumps(item_status.get('failureReasons', 'Eroare necunoscută.'))
                listing.save()
                logger.error(f"Publicarea listing-ului {listing_id} a eșuat: {listing.last_sync_status}")
        
        elif batch_status in ["PENDING", "PROCESSING"]:
            logger.info(f"Listing-ul {listing_id} este încă în procesare. Se reîncearcă în 5 minute.")
            # Reîncearcă task-ul peste 5 minute (300 secunde)
            raise self.retry(countdown=60 * 5)
        
        else:
            # Status necunoscut (ex: FAILED la nivel de batch)
            listing.status = MarketplaceListing.Status.FAILED
            listing.last_sync_status = f"Batch-ul a eșuat cu statusul: {batch_status}"
            listing.save()
            logger.error(f"Verificarea batch-ului {listing_id} a eșuat: {batch_status}")

    except MaxRetriesExceededError:
        logger.error(f"Epuizat numărul de reîncercări pentru listing {listing_id}. Setat ca Eșuat.")
        try:
            listing = MarketplaceListing.objects.get(id=listing_id)
            listing.status = MarketplaceListing.Status.FAILED
            listing.last_sync_status = "Timeout: Task-ul de verificare a expirat după multiple reîncercări."
            listing.save()
        except MarketplaceListing.DoesNotExist:
            pass
    
    except Exception as e:
        logger.error(f"Eroare la verificarea statusului listing-ului {listing_id}: {e}", exc_info=True)
        # Reîncearcă pentru erori de rețea, etc.
        raise self.retry(countdown=60) # Reîncearcă peste 1 minut
    
@shared_task
def process_trendyol_webhook_order(data: dict, seller_id: str):
    """
    Procesează asincron o notificare de comandă primită prin Webhook.
    """
    logger.info(f"Webhook primit pentru SellerID {seller_id}. Începe procesarea...")

    try:
        # Găsim contul pe baza seller_id primit în URL-ul webhook-ului sau dedus
        # (Vom presupune că un user poate avea un singur cont cu acest seller_id pentru simplitate,
        # sau vom itera dacă există duplicate, deși unique_together în model previne asta).
        account = MarketplaceAccount.objects.filter(
            seller_id=seller_id, 
            platform=MarketplaceAccount.Platform.TRENDYOL
        ).first()

        if not account:
            logger.error(f"Webhook primit pentru un Seller ID necunoscut: {seller_id}")
            return

        # Instanțiem serviciul
        service = TrendyolAPIService(user=account.user, account_id=account.id)
        
        # Procesăm datele folosind metoda creată la Pasul 2
        service.process_order_data(data)
        
        logger.info(f"Webhook procesat cu succes pentru pachetul {data.get('id')}")

    except Exception as e:
        logger.error(f"Eroare la procesarea webhook-ului Trendyol: {e}", exc_info=True)
        # Putem da retry aici dacă e o eroare de DB temporară


# --- Task Periodic de Polling ---

@shared_task
def sync_trendyol_orders_periodic():
    """
    Task periodic care verifică comenzile 'Created' pentru TOATE conturile Trendyol active.
    Funcționează ca backup pentru Webhook-uri.
    """
    logger.info("Începe sincronizarea periodică a comenzilor Trendyol...")
    
    # Iterăm prin toate conturile Trendyol
    accounts = MarketplaceAccount.objects.filter(platform=MarketplaceAccount.Platform.TRENDYOL)

    target_statuses = ["Created", "Picking", "Shipped", "Delivered", "Cancelled", "Returned"]
    
    for account in accounts:
        try:
            service = TrendyolAPIService(user=account.user, account_id=account.id)
            end_date = timezone.now()
            start_date = end_date - timedelta(days=1)
            
            for status in target_statuses:
                try:
                    response = service.get_orders(status=status, start_date=start_date, end_date=end_date)
                    orders_content = response.get('content', [])
                    
                    if orders_content:
                        logger.info(f"Cont {account.name}: Găsite {len(orders_content)} comenzi cu status {status}")
                        for order_data in orders_content:
                            service.process_order_data(order_data)
                except Exception as e:
                    logger.warning(f"Eroare la preluarea statusului {status} pentru {account.name}: {e}")
                    
        except Exception as e:
            logger.error(f"Eroare critică la sincronizarea contului {account.id}: {e}")

# --- Task-uri de Acțiune (Update Status) ---

@shared_task
def set_order_status_picking(order_id):
    """
    Trimite statusul 'Picking' la Trendyol.
    """
    try:
        order = Order.objects.get(id=order_id)
        service = TrendyolAPIService(user=order.account, account_id=order.platform_account.id)
        
        # Construim lista de linii necesară pentru API
        lines_payload = []
        for item in order.items.all():
            lines_payload.append({
                "lineId": int(item.platform_order_line_id),
                "quantity": item.quantity
            })
            
        service.update_package_status_picking(order.platform_package_id, lines_payload)
        
        # Actualizăm local
        order.status = Order.Status.PICKING
        order.save()
        logger.info(f"Comanda {order.platform_order_number} marcată ca PICKING.")
        
    except Exception as e:
        logger.error(f"Eroare la setarea statusului PICKING pentru order {order_id}: {e}", exc_info=True)
        # TODO: Notifică utilizatorul că a eșuat

@shared_task
def set_order_status_invoiced(order_id, invoice_number):
    """
    Trimite statusul 'Invoiced' la Trendyol.
    """
    try:
        order = Order.objects.get(id=order_id)
        service = TrendyolAPIService(user=order.account, account_id=order.platform_account.id)
        
        lines_payload = []
        for item in order.items.all():
            lines_payload.append({
                "lineId": int(item.platform_order_line_id),
                "quantity": item.quantity
            })
            
        service.update_package_status_invoiced(order.platform_package_id, lines_payload, invoice_number)
        
        # Actualizăm local
        order.status = Order.Status.INVOICED
        order.save()
        logger.info(f"Comanda {order.platform_order_number} marcată ca INVOICED ({invoice_number}).")
        
    except Exception as e:
        logger.error(f"Eroare la setarea statusului INVOICED pentru order {order_id}: {e}", exc_info=True)

@shared_task
def sync_trendyol_claims_periodic():
    """
    Verifică retururile care așteaptă acțiune ('WaitingInAction').
    """
    accounts = MarketplaceAccount.objects.filter(platform=MarketplaceAccount.Platform.TRENDYOL)
    for account in accounts:
        try:
            service = TrendyolAPIService(user=account.user, account_id=account.id)
            response = service.get_claims(status="WaitingInAction")
            claims = response.get('content', [])
            
            for claim_data in claims:
                # Salvare Claim
                claim_id = str(claim_data.get('id'))
                timestamp = claim_data.get('claimDate', 0)
                claim_date = datetime.fromtimestamp(timestamp / 1000.0)#, tz=timezone.utc)
                
                # Încercăm să legăm de o comandă existentă
                order = Order.objects.filter(platform_order_number=claim_data.get('orderNumber')).first()
                
                ret_req, _ = ReturnRequest.objects.update_or_create(
                    claim_id=claim_id,
                    defaults={
                        'account': account.user,
                        'platform_account': account,
                        'order': order,
                        'platform_order_number': claim_data.get('orderNumber'),
                        'claim_date': claim_date,
                        'status': ReturnRequest.Status.WAITING
                    }
                )
                
                # Salvare Itemii din Claim
                for item in claim_data.get('items', []):
                    for line in item.get('claimItems', []):
                         ReturnLineItem.objects.update_or_create(
                             claim_line_item_id=line.get('id'),
                             defaults={
                                 'return_request': ret_req,
                                 'sku': item.get('orderLine', {}).get('merchantSku', ''),
                                 'customer_reason': line.get('customerClaimItemReason', {}).get('name', ''),
                                 'customer_note': line.get('customerNote', '')
                             }
                         )
                         
        except Exception as e:
            logger.error(f"Eroare sync retururi {account.name}: {e}")

# --- Task-uri Acțiuni Retururi ---

@shared_task
def approve_return_task(claim_db_id):
    """ Task asincron pentru aprobare """
    try:
        ret_req = ReturnRequest.objects.get(id=claim_db_id)
        service = TrendyolAPIService(user=ret_req.account, account_id=ret_req.platform_account.id)
        
        # Colectăm ID-urile liniilor
        item_ids = [item.claim_line_item_id for item in ret_req.items.all()]
        
        service.approve_claim_items(ret_req.claim_id, item_ids)
        
        ret_req.status = ReturnRequest.Status.ACCEPTED
        ret_req.save()
    except Exception as e:
        logger.error(f"Eroare aprobare retur {claim_db_id}: {e}")

# Notă: Pentru reject, deoarece implică fișiere, e mai complex de trimis prin Celery (serializare fișier).
# Recomandarea mea: Execută reject-ul sincron în View sau salvează fișierul temporar pe S3 și trimite calea către Celery.
# Pentru simplitate acum, vom face reject-ul direct în View, nu prin Task.

@shared_task
def update_trendyol_stock_price(listing_id: int):
    """
    Trimite actualizarea de stoc/preț pentru o singură listare.
    """
    try:
        listing = MarketplaceListing.objects.select_related('variant').get(id=listing_id)
        
        # Calculăm valorile (luăm override dacă există, altfel valoarea din variantă)
        stock = listing.stock_override if listing.stock_override is not None else listing.variant.stock
        price = listing.price_override if listing.price_override is not None else listing.variant.price
        
        payload = {
            "items": [
                {
                    "barcode": listing.variant.barcode,
                    "quantity": int(stock),
                    "salePrice": float(price),
                    "listPrice": float(price)
                }
            ]
        }
        
        service = TrendyolAPIService(user=listing.account, account_id=listing.platform_account.id)
        
        # Apelăm endpoint-ul de inventory
        # Notă: Trebuie să expui metoda în service (folosind _make_request pe endpoint-ul corect)
        # URL: /integration/inventory/sellers/{sellerId}/products/price-and-inventory
        
        base_url_inv = f"https://apigw.trendyol.com/integration/inventory/sellers/{service.account.seller_id}"
        response = service._make_request("POST", base_url_inv, "/products/price-and-inventory", json_data=payload)
        
        logger.info(f"Update stoc trimis pt {listing.variant.sku}. Batch: {response.get('batchRequestId')}")
        
    except Exception as e:
        logger.error(f"Eroare update stoc listing {listing_id}: {e}")

@shared_task
def import_trendyol_products_task(account_id):
    """
    Importă toate produsele existente de pe Trendyol în PIM-ul local.
    """
    logger.info(f"Start task import produse pentru contul {account_id}")
    
    try:
        account = MarketplaceAccount.objects.get(id=account_id)
        service = TrendyolAPIService(user=account.user, account_id=account.id)
        
        stats = {"created_products": 0, "created_variants": 0, "linked_listings": 0}
        
        # Iterăm prin toate produsele folosind generatorul din service
        for t_prod in service.get_all_products_generator():
            
            # 1. Extragere date cheie
            # Trendyol structurează ciudat: un item în listă este de fapt o variantă.
            # Gruparea se face după 'productMainId'.
            
            main_id = t_prod.get('productMainId') or f"GEN-{t_prod.get('productCode')}"
            title = t_prod.get('title')
            brand_name = t_prod.get('brand', 'Generic')
            description = t_prod.get('description', '')
            
            barcode = t_prod.get('barcode')
            sku = t_prod.get('stockCode') or barcode # SKU Variantă
            
            quantity = t_prod.get('quantity', 0)
            sale_price = t_prod.get('salePrice', 0)
            list_price = t_prod.get('listPrice', 0)

            vat_rate = t_prod.get('vatRate', 21)

            shipment_addr_id = t_prod.get('shipmentAddressId')
            return_addr_id = t_prod.get('returningAddressId')
            
            images = t_prod.get('images', [])
            image_urls = [img['url'] for img in images]
            
            # Atribute (Culoare, Mărime etc)
            attributes_data = t_prod.get('attributes') or []
            attributes = {}
            for attr in attributes_data:
                # Luăm numele și valoarea, ignorând null-urile
                a_name = attr.get('attributeName')
                a_val = attr.get('attributeValue')
                if a_name and a_val:
                    attributes[a_name] = a_val

            # 2. Gestionare PRODUS PĂRINTE (PIM Product)
            # Căutăm după SKU-ul părintelui (productMainId) SAU creăm unul nou
            product, prod_created = Product.objects.get_or_create(
                sku=main_id,
                account=account.user,
                defaults={
                    'title': title,
                    'brand': brand_name,
                    'description': description
                }
            )
            if prod_created:
                stats["created_products"] += 1

            # 3. Gestionare VARIANTĂ (PIM Variant)
            # Căutăm după SKU-ul variantei
            variant, var_created = ProductVariant.objects.update_or_create(
                sku=sku,
                product=product,
                defaults={
                    'barcode': barcode,
                    'stock': quantity,      # Sincronizăm stocul inițial
                    'price': sale_price,    # Sincronizăm prețul
                    'list_price': list_price,
                    'images': image_urls,
                    'attributes': attributes
                }
            )
            if var_created:
                stats["created_variants"] += 1

            # 4. Gestionare LISTING (Legătura)
            # Creăm legătura ca să știm că acest produs e deja pe Trendyol
            listing, list_created = MarketplaceListing.objects.update_or_create(
                variant=variant,
                platform_account=account,
                defaults={
                    'account': account.user,
                    'status': MarketplaceListing.Status.ACTIVE, # E deja acolo
                    'platform_listing_id': t_prod.get('productContentId') or '',
                    'platform_brand_id': str(t_prod.get('brandId', '')),
                    'platform_category_id': str(t_prod.get('pimCategoryId', '')),
                    'last_sync_status': "Importat automat din Trendyol",
                    # Putem salva și atributele specifice platformei dacă vrem
                    'platform_attributes': t_prod.get('attributes', []),
                    'vat_rate': vat_rate,
                    'shipment_address_id': shipment_addr_id,
                    'returning_address_id': return_addr_id
                }
            )
            if list_created:
                stats["linked_listings"] += 1
                
        logger.info(f"Import finalizat cu succes: {stats}")
        return stats

    except Exception as e:
        logger.error(f"Eroare la importul produselor: {e}", exc_info=True)