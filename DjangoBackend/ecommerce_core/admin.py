from django.contrib import admin
from .models import (
    MarketplaceAccount, Product, ProductVariant, MarketplaceListing,
    Order, OrderLineItem, ReturnRequest, ReturnLineItem, BundleComponent
)

# --- Marketplace Account ---

@admin.register(MarketplaceAccount)
class MarketplaceAccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'platform', 'seller_id')
    list_filter = ('platform', 'user')
    search_fields = ('name', 'seller_id', 'user__username')
    
    fieldsets = (
        (None, {
            'fields': ('user', 'platform', 'name')
        }),
        ('Detalii Platformă', {
            'fields': ('seller_id', 'store_front_code')
        }),
        ('Credențiale API (Securizat)', {
            'classes': ('collapse',),
            'description': "AVERTISMENT: Aceste chei sunt sensibile. Nu le partajați.",
            'fields': ('api_key', 'api_secret'),
        }),
    )

# --- Bundle Components Inline ---
class BundleComponentInline(admin.TabularInline):
    model = BundleComponent
    fk_name = "bundle_variant" # Cheia străină către părinte (Bundle)
    extra = 1
    autocomplete_fields = ['component_variant']
    verbose_name = "Componentă în acest Set"
    verbose_name_plural = "Componente ale Setului"

# --- Produse (PIM) ---

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1
    fields = ('sku', 'barcode', 'attributes', 'stock', 'price', 'list_price', 'images')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'sku', 'account', 'brand', 'created_at')
    search_fields = ('title', 'sku', 'brand')
    list_filter = ('account', 'brand')
    inlines = [ProductVariantInline]

class MarketplaceListingInline(admin.TabularInline):
    model = MarketplaceListing
    extra = 0
    fields = ('platform_account', 'status', 'platform_listing_id', 'stock_override', 'price_override', 'vat_rate', 'delivery_duration', 'shipment_address_id', 'returning_address_id')
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('platform_account',)

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('sku', 'product', 'barcode', 'stock', 'price')
    search_fields = ('sku', 'barcode', 'product__title')
    list_filter = ('type', 'product__account',)
    inlines = [BundleComponentInline, MarketplaceListingInline]
    autocomplete_fields = ('product',)

@admin.register(MarketplaceListing)
class MarketplaceListingAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_sku', 'platform_account', 'status', 'platform_listing_id', 'updated_at')
    search_fields = ('variant__sku', 'platform_listing_id')
    list_filter = ('status', 'platform_account__platform')
    autocomplete_fields = ('variant', 'account', 'platform_account')
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Variant SKU')
    def get_sku(self, obj):
        return obj.variant.sku

# --- COMENZI (ORDERS) ---

class OrderLineItemInline(admin.TabularInline):
    model = OrderLineItem
    extra = 0
    # Facem câmpurile read-only pentru că nu vrem să modificăm comanda manual și să stricăm sincronizarea
    readonly_fields = ('sku', 'product_name', 'quantity', 'price', 'status', 'platform_order_line_id')
    can_delete = False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('platform_order_number', 'platform_account', 'status', 'total_price', 'order_date', 'created_at')
    list_filter = ('status', 'platform_account', 'order_date')
    search_fields = ('platform_order_number', 'platform_package_id', 'customer_email', 'customer_last_name')
    inlines = [OrderLineItemInline]
    readonly_fields = ('created_at', 'updated_at', 'platform_package_id')
    
    fieldsets = (
        ('Info Comandă', {
            'fields': ('account', 'platform_account', 'platform_order_number', 'status', 'order_date')
        }),
        ('Financiar', {
            'fields': ('total_price', 'currency')
        }),
        ('Client', {
            'fields': ('customer_first_name', 'customer_last_name', 'customer_email', 'shipping_address', 'invoice_address')
        }),
        ('Tehnic', {
            'classes': ('collapse',),
            'fields': ('platform_package_id', 'created_at', 'updated_at')
        }),
    )

# --- RETURURI (RETURNS) ---

class ReturnLineItemInline(admin.TabularInline):
    model = ReturnLineItem
    extra = 0
    readonly_fields = ('sku', 'customer_reason', 'customer_note', 'claim_line_item_id')
    can_delete = False

@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = ('platform_order_number', 'claim_id', 'status', 'claim_date')
    list_filter = ('status', 'platform_account')
    search_fields = ('platform_order_number', 'claim_id')
    inlines = [ReturnLineItemInline]
    readonly_fields = ('created_at', 'updated_at')