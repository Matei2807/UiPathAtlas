from django.db.models.signals import post_save, m2m_changed, post_delete
from django.dispatch import receiver
from django.db import transaction
from .models import ProductVariant, BundleComponent, MarketplaceListing, MarketplaceAccount, OrderLineItem
# Importăm dinamic pentru a evita circular imports
from django.apps import apps

@receiver(post_save, sender=ProductVariant)
def product_variant_changed(sender, instance, created, **kwargs):
    """
    Când se schimbă o variantă:
    1. Dacă e SIMPLE: Verificăm dacă face parte din vreun Bundle și recalculăm stocul bundle-ului.
    2. Declanșăm update către Marketplace pentru varianta însăși.
    """

    print("Signal: product_variant_changed triggered")
    # 1. Propagare schimbare stoc către Bundle-uri părinte
    if instance.type == ProductVariant.Type.SIMPLE:
        # Găsim toate bundle-urile care conțin acest produs
        parent_bundles = ProductVariant.objects.filter(
            bundle_components__component_variant=instance
        ).distinct()
        
        print(f"Found {parent_bundles.count()} parent bundles for variant {instance.id}")
        for bundle in parent_bundles:
            new_stock = bundle.calculate_bundle_stock()
            if bundle.stock != new_stock:
                bundle.stock = new_stock
                # Salvăm (asta va declanșa recursiv acest semnal pentru bundle, trimițând update la Trendyol)
                bundle.save(update_fields=['stock', 'updated_at'])

    # 2. Notificare Marketplace (pentru produsul curent - fie el simplu sau bundle)
    print(f"Triggering marketplace update for variant {instance.id}")
    trigger_marketplace_update(instance)

@receiver(post_save, sender=BundleComponent)
@receiver(post_delete, sender=BundleComponent)
def bundle_structure_changed(sender, instance, **kwargs):
    """
    Dacă se schimbă structura unui bundle (se adaugă/șterge o componentă sau se schimbă cantitatea),
    recalculăm stocul bundle-ului.
    """
    bundle = instance.bundle_variant
    new_stock = bundle.calculate_bundle_stock()
    if bundle.stock != new_stock:
        bundle.stock = new_stock
        bundle.save(update_fields=['stock', 'updated_at'])

def trigger_marketplace_update(variant):
    """
    Trimite update la Celery doar dacă produsul este listat Activ.
    """
    active_listings = variant.listings.filter(status=MarketplaceListing.Status.ACTIVE)
    
    for listing in active_listings:
        if listing.platform_account.platform == MarketplaceAccount.Platform.TRENDYOL:
            from ecommerce_trendyol.tasks import update_trendyol_stock_price
            # Folosind transaction.on_commit ne asigurăm că DB e updatat înainte să plece task-ul
            transaction.on_commit(lambda: update_trendyol_stock_price.delay(listing_id=listing.id))

# @receiver(post_save, sender=ProductVariant)
# def trigger_marketplace_updates(sender, instance, created, **kwargs):
#     """
#     Când o variantă se modifică (stoc sau preț), notificăm toate platformele active.
#     """
#     if created:
#         return # Nu facem update la creare, trebuie publicat manual întâi

#     # Găsim toate listările ACTIVE pentru această variantă
#     active_listings = instance.listings.filter(status=MarketplaceListing.Status.ACTIVE)
    
#     for listing in active_listings:
#         platform = listing.platform_account.platform
        
#         if platform == MarketplaceAccount.Platform.TRENDYOL:
#             # Importăm task-ul aici
#             from ecommerce_trendyol.tasks import update_trendyol_stock_price
#             update_trendyol_stock_price.delay(listing_id=listing.id)
            
#         # elif platform == 'emag': ... # TODO!