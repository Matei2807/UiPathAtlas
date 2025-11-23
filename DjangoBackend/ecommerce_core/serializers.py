from rest_framework import serializers
from .models import MarketplaceAccount, MarketplaceListing, Order, OrderLineItem, ReturnRequest, Product, ProductVariant, BundleComponent, Bundle, BundleItem, SystemEvent

class MarketplaceAccountSerializer(serializers.ModelSerializer):
    # Facem user-ul read-only. Îl vom seta automat din view.
    user = serializers.StringRelatedField(read_only=True)
    
    # Facem cheile write-only.
    # Frontend-ul le poate trimite, dar nu le poate citi niciodată înapoi.
    api_key = serializers.CharField(write_only=True, style={'input_type': 'password'})
    api_secret = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = MarketplaceAccount
        fields = [
            'id', 'user', 'platform', 'name', 'seller_id', 
            'store_front_code', 'api_key', 'api_secret'
        ]
        read_only_fields = ['id', 'user']

class MarketplaceListingSerializer(serializers.ModelSerializer):
    # Câmpuri "read-only" pentru a afișa informații prietenoase
    user = serializers.StringRelatedField(read_only=True, source='account.username')
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    platform_name = serializers.CharField(source='platform_account.name', read_only=True)
    
    class Meta:
        model = MarketplaceListing
        fields = [
            'id', 
            'user', 
            'variant',           # ID-ul ProductVariant (PIM) - write
            'variant_sku',       # SKU-ul PIM - read
            'platform_account',  # ID-ul MarketplaceAccount - write
            'platform_name',     # Numele contului - read
            'status',            # Statusul listării (draft, pending, active) - read
            'last_sync_status',  # Ultima eroare/succes - read
            'platform_listing_id', # ID-ul de la Trendyol (batchId) - read
            
            # Câmpuri de control al sincronizării - write
            'stock_override', 
            'price_override',
            
            # Câmpuri specifice platformei, trimise de frontend - write
            'platform_category_id', 
            'platform_brand_id', 
            'platform_attributes'
        ]
        # Setăm câmpurile care sunt doar pentru citire (calculate de server)
        read_only_fields = [
            'id', 'user', 'variant_sku', 'platform_name', 
            'status', 'last_sync_status', 'platform_listing_id'
        ]
        
        # 'variant', 'platform_account', 'stock_override', 'price_override',
        # 'platform_category_id', 'platform_brand_id', 'platform_attributes' 
        # sunt toate "writeable".

class OrderLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderLineItem
        fields = ['id', 'sku', 'product_name', 'quantity', 'price', 'status']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderLineItemSerializer(many=True, read_only=True)
    platform_name = serializers.CharField(source='platform_account.name', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'platform_order_number', 'platform_name', 'status', 
            'total_price', 'currency', 'customer_first_name', 'customer_last_name',
            'order_date', 'shipping_address', 'items'
        ]

class ReturnRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequest
        fields = '__all__'

# --- SERIALIZERE PENTRU PRODUSE & BUNDLE ---

class ProductSimpleSerializer(serializers.ModelSerializer):
    """Folosit pentru a afișa detalii despre părinte în interiorul variantei."""
    class Meta:
        model = Product
        fields = ['id', 'title', 'brand', 'description']
    
class BundleComponentReadSerializer(serializers.ModelSerializer):
    """
    Serializer pentru a arăta ce conține un bundle (Read-Only).
    Afișează detalii despre componentă (nume, sku, poză).
    """
    component_sku = serializers.CharField(source='component_variant.sku', read_only=True)
    component_name = serializers.CharField(source='component_variant.product.title', read_only=True)
    component_image = serializers.SerializerMethodField()
    current_stock = serializers.IntegerField(source='component_variant.stock', read_only=True)

    class Meta:
        model = BundleComponent
        fields = ['id', 'component_variant', 'component_sku', 'component_name', 'component_image', 'quantity', 'current_stock']

    def get_component_image(self, obj):
        # Verificăm dacă există imagini
        images = obj.component_variant.images
        if images and len(images) > 0:
            first_image = images[0]
            # FIX: Verificăm tipul imaginii. 
            # Dacă e string (URL direct), îl returnăm.
            if isinstance(first_image, str):
                return first_image
            # Dacă e dicționar (vechea structură), luăm cheia 'url'.
            elif isinstance(first_image, dict):
                return first_image.get('url')
        return None

class MarketplaceListingSimpleSerializer(serializers.ModelSerializer):
    """
    Versiune simplificată a listing-ului pentru a fi afișată în lista de produse.
    """
    platform_name = serializers.CharField(source='platform_account.name', read_only=True)
    platform_type = serializers.CharField(source='platform_account.platform', read_only=True)

    class Meta:
        model = MarketplaceListing
        fields = ['id', 'platform_account', 'platform_name', 'platform_type', 'status', 'price_override', 'stock_override', 'platform_listing_id']

class ProductVariantDetailSerializer(serializers.ModelSerializer):
    """
    SERIALIZER PRINCIPAL PENTRU DETALII (GET /api/v2/ecommerce/products/1/)
    Aduce TOT: Părinte, Componente (dacă e bundle), Listări.
    """
    product_details = ProductSimpleSerializer(source='product', read_only=True)
    components = BundleComponentReadSerializer(source='bundle_components', many=True, read_only=True)
    listings = MarketplaceListingSimpleSerializer(many=True, read_only=True)
    
    # Câmp calculat pentru a ști rapid dacă e bundle în frontend
    is_bundle = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'type', 'is_bundle', 'sku', 'barcode', 
            'stock', 'price', 'list_price', 
            'images', 'attributes', 
            'product_details', # Info Părinte (Titlu, Brand)
            'components',      # Doar dacă e bundle
            'listings',        # Pe ce marketplace-uri e publicat
            'created_at', 'updated_at'
        ]

    def get_is_bundle(self, obj):
        return obj.type == ProductVariant.Type.BUNDLE

class ProductVariantListSerializer(serializers.ModelSerializer):
    """
    SERIALIZER PENTRU LISTĂ (GET /api/v2/ecommerce/products/)
    Mai light, pentru a încărca tabelul rapid.
    """
    product_title = serializers.CharField(source='product.title', read_only=True)
    brand = serializers.CharField(source='product.brand', read_only=True)
    
    # Putem arăta statusurile listărilor sumarizat
    active_listings_count = serializers.SerializerMethodField()
    is_bundle = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'type', 'is_bundle', 'sku', 'barcode', 'stock', 'price', 
            'product_title', 'brand', 'images', 'active_listings_count'
        ]

    def get_active_listings_count(self, obj):
        # Optimizare: Aceasta ar trebui precalculată în queryset cu annotate
        return obj.listings.filter(status=MarketplaceListing.Status.ACTIVE).count()
    
    def get_is_bundle(self, obj):
        return obj.type == ProductVariant.Type.BUNDLE
    
class InvoiceUploadSerializer(serializers.Serializer):
    file = serializers.FileField(help_text="Încarcă fișierul PDF al facturii.")

class BundleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    
    # Pentru creare primim ID-ul produsului
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source='product', write_only=True
    )

    class Meta:
        model = BundleItem
        fields = ['id', 'product_id', 'product_name', 'product_sku', 'quantity']

class BundleSerializer(serializers.ModelSerializer):
    items = BundleItemSerializer(many=True)

    class Meta:
        model = Bundle
        fields = ['id', 'sku', 'title', 'description', 'base_price', 'final_price', 'bundle_code', 'items', 'is_active']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        bundle = Bundle.objects.create(**validated_data)
        for item_data in items_data:
            BundleItem.objects.create(bundle=bundle, **item_data)
        return bundle
    
class SystemEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemEvent
        fields = '__all__'