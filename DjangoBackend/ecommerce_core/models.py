from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _

# Recomandare de securitate:
# În producție, NU stocați cheile API în text clar. Folosiți django-cryptography
# (https://pypi.org/project/django-cryptography/) sau un serviciu extern
# de gestionare a secretelor (ex: HashiCorp Vault sau AWS Secrets Manager).
# Pentru dezvoltare, vom folosi TextField, dar cu un AVERTISMENT.

class MarketplaceAccount(models.Model):
    """
    Stochează credențialele și setările pentru un cont de marketplace (ex: "Trendyol RO").
    """
    class Platform(models.TextChoices):
        TRENDYOL = 'trendyol', _('Trendyol')
        EMAG = 'emag', _('eMAG')

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="marketplace_accounts")
    platform = models.CharField(max_length=20, choices=Platform.choices)
    name = models.CharField(max_length=100) # Ex: "Contul meu Trendyol România"
    seller_id = models.CharField(max_length=100)
    
    # !!! AVERTISMENT DE SECURITATE !!!
    # Aceste câmpuri TREBUIE criptate în producție.
    api_key = models.TextField(blank=True)
    api_secret = models.TextField(blank=True)
    # Stocăm și storeFrontCode-ul aici
    store_front_code = models.CharField(max_length=10, default="RO")

    class Meta:
        verbose_name = "Cont Marketplace"
        verbose_name_plural = "Conturi Marketplace"
        unique_together = ('user', 'seller_id', 'platform')

    def __str__(self):
        return f"{self.user.username} - {self.name} ({self.get_platform_display()})"

class Product(models.Model):
    """
    Produsul "Master" din PIM-ul tău. Sursa Adevărului pentru informații generale.
    """
    account = models.ForeignKey(User, on_delete=models.CASCADE, related_name="products")
    sku = models.CharField(max_length=100, unique=True, help_text="SKU-ul tău intern, unic pentru produsul de bază.")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    brand = models.CharField(max_length=100, help_text="Numele brandului tău intern.")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Produs (PIM)"
        verbose_name_plural = "Produse (PIM)"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.sku})"

class ProductVariant(models.Model):
    """
    O variantă poate fi un produs fizic (SIMPLE) sau un set (BUNDLE).
    """
    class Type(models.TextChoices):
        SIMPLE = 'simple', _('Produs Simplu')
        BUNDLE = 'bundle', _('Bundle / Set')
    
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SIMPLE)

    sku = models.CharField(max_length=100, unique=True, help_text="SKU-ul unic al variantei (ex: TR-ROSU-M).")
    barcode = models.CharField(max_length=100, db_index=True)

    attributes = models.JSONField(default=dict, help_text='Ex: {"culoare": "Roșu", "marime": "M"}')
    images = models.JSONField(default=list, help_text='Listă de URL-uri ale imaginilor.')
    
    # Stocul pentru SIMPLE este cel fizic.
    # Stocul pentru BUNDLE este cel CALCULAT (cache). Se actualizează via signals.
    stock = models.PositiveIntegerField(default=0, help_text="Stoc fizic (simple) sau calculat (bundle).")
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prețul 'master' de vânzare.") # sale price

    list_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, 
        help_text="Prețul întreg (tăiat). Dacă e gol, se va folosi prețul de vânzare."
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Variantă Produs (PIM)"
        verbose_name_plural = "Variante Produse (PIM)"
        ordering = ['product', 'sku']

    def __str__(self):
        return f"{self.sku} ({self.get_type_display()}) - Stoc: {self.stock}"
    
    def calculate_bundle_stock(self):
        """
        Metodă critică: Calculează stocul maxim posibil pentru acest bundle
        bazat pe componentele sale.
        """
        if self.type != self.Type.BUNDLE:
            return self.stock

        components = self.bundle_components.all()
        if not components.exists():
            return 0

        max_possible_stock = float('inf')
        
        for comp in components:
            if comp.component_variant.stock == 0:
                return 0
            # Câte seturi putem face cu stocul acestei componente?
            possible = comp.component_variant.stock // comp.quantity
            if possible < max_possible_stock:
                max_possible_stock = possible
        
        return int(max_possible_stock) if max_possible_stock != float('inf') else 0
    
class BundleComponent(models.Model):
    """
    Definește rețeta unui bundle. 
    Ex: Bundle 'SET-VARA' are componenta 'TRICOU-A' x 2 buc.
    """
    bundle_variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="bundle_components")
    component_variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name="included_in_bundles")
    quantity = models.PositiveIntegerField(default=1, help_text="Câte bucăți din componentă intră în bundle.")

    class Meta:
        unique_together = ('bundle_variant', 'component_variant')
        verbose_name = "Componentă Bundle"
        verbose_name_plural = "Componente Bundle"

    def __str__(self):
        return f"{self.quantity} x {self.component_variant.sku} în {self.bundle_variant.sku}"

class MarketplaceListing(models.Model):
    """
    Modelul "Adeziv". Conectează o Variantă PIM (ce ai tu) cu o listare pe o platformă (ce e publicat).
    """
    class Status(models.TextChoices):
        DRAFT = 'draft', _('Draft') # Pregătit în PIM, nu e trimis
        PENDING_CREATE = 'pending_create', _('Așteaptă Creare') # Trimis la API, așteaptă batchId
        PENDING_UPDATE = 'pending_update', _('Așteaptă Actualizare') # Trimis la API, așteaptă batchId
        ACTIVE = 'active', _('Activ') # Confirmat, live pe platformă
        FAILED = 'failed', _('Eșuat') # Crearea/Actualizarea a eșuat
        ARCHIVED = 'archived', _('Arhivat') # Arhivat pe platformă

    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="listings")
    account = models.ForeignKey(User, on_delete=models.CASCADE, related_name="listings")
    platform_account = models.ForeignKey(MarketplaceAccount, on_delete=models.PROTECT, related_name="listings")
    
    # --- Date specifice Platformei (salvate după publicare) ---
    platform_listing_id = models.CharField(max_length=100, blank=True, db_index=True, help_text="ID-ul de la Trendyol (batchRequestId inițial, apoi alt ID)")
    platform_category_id = models.CharField(max_length=50)
    platform_brand_id = models.CharField(max_length=50)
    platform_attributes = models.JSONField(default=dict, help_text="Atributele formatate pentru API-ul platformei.")

    # --- Controlul Sincronizării ---
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    last_sync_status = models.TextField(blank=True, help_text="Ultimele erori sau mesaje de succes de la API.")
    
    stock_override = models.PositiveIntegerField(null=True, blank=True, help_text="Opțional: Setează un stoc fix de trimis (ex: 50).")
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Opțional: Setează un preț diferit pentru această platformă.")

    vat_rate = models.PositiveIntegerField(default=21, help_text="Cota TVA")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Adresele de livrare/retur sunt specifice contului Trendyol, dar pot fi suprascrise per produs
    shipment_address_id = models.BigIntegerField(
        null=True, blank=True, 
        help_text="ID-ul adresei de expediere de pe Trendyol. Dacă e gol, se caută automat una default."
    )
    returning_address_id = models.BigIntegerField(
        null=True, blank=True, 
        help_text="ID-ul adresei de retur de pe Trendyol. Dacă e gol, se caută automat una default."
    )

    class Meta:
        verbose_name = "Listare Marketplace"
        verbose_name_plural = "Listări Marketplace"
        unique_together = ('variant', 'platform_account')

    def __str__(self):
        return f"{self.variant.sku} pe {self.platform_account.get_platform_display()} ({self.get_status_display()})"


class Order(models.Model):
    """
    Reprezintă o comandă venită dintr-un Marketplace (ex: Trendyol).
    """
    class Status(models.TextChoices):
        CREATED = 'Created', 'Creată'
        PICKING = 'Picking', 'În Pregătire'
        INVOICED = 'Invoiced', 'Facturată'
        SHIPPED = 'Shipped', 'Expediată'
        CANCELLED = 'Cancelled', 'Anulată'
        DELIVERED = 'Delivered', 'Livrată'
        UNDELIVERED = 'UnDelivered', 'Nelivrată'
        RETURNED = 'Returned', 'Returnată'
        UNKNOWN = 'Unknown', 'Necunoscut'

    # Legături
    account = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    platform_account = models.ForeignKey(MarketplaceAccount, on_delete=models.PROTECT, related_name="orders")

    # Identificatori Platformă
    platform_order_number = models.CharField(max_length=100, db_index=True, help_text="Numărul comenzii clientului (orderNumber).")
    platform_package_id = models.CharField(max_length=100, unique=True, db_index=True, help_text="ID-ul pachetului (shipmentPackageId) - Cheia principală pentru Trendyol.")
    
    # Detalii Financiare
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='RON')
    
    # Detalii Client & Livrare (Stocate ca JSON pentru flexibilitate)
    customer_first_name = models.CharField(max_length=100, blank=True)
    customer_last_name = models.CharField(max_length=100, blank=True)
    customer_email = models.CharField(max_length=255, blank=True)
    shipping_address = models.JSONField(default=dict)
    invoice_address = models.JSONField(default=dict)
    
    # Status
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.CREATED)
    
    # Meta
    order_date = models.DateTimeField() # Data plasării comenzii pe platformă
    created_at = models.DateTimeField(auto_now_add=True) # Data intrării în sistemul nostru
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order #{self.platform_order_number} ({self.get_status_display()}) - {self.platform_account.name}"


class OrderLineItem(models.Model):
    """
    Un produs specific dintr-o comandă.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    
    # Încercăm să legăm de un produs intern, dar lăsăm null dacă nu-l găsim (produs șters sau inexistent în PIM)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items")
    
    # Date specifice liniei
    platform_order_line_id = models.CharField(max_length=100, help_text="ID unic al liniei (orderLineId). Necesar pentru split/cancel.")
    sku = models.CharField(max_length=100, help_text="SKU-ul așa cum a venit din platformă (merchantSku).")
    product_name = models.CharField(max_length=255)
    
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Status per item (unele platforme permit anularea parțială)
    status = models.CharField(max_length=50, default='Created')

    def __str__(self):
        return f"{self.sku} x {self.quantity} (Order: {self.order.platform_order_number})"


class ReturnRequest(models.Model):
    """
    Reprezintă o cerere de retur (Claim) de la Trendyol.
    """
    class Status(models.TextChoices):
        CREATED = 'Created', 'Creat'
        WAITING = 'WaitingInAction', 'Așteaptă Acțiune' # Statusul critic
        ACCEPTED = 'Accepted', 'Acceptat'
        REJECTED = 'Rejected', 'Respins'
        CANCELLED = 'Cancelled', 'Anulat'
        UNRESOLVED = 'Unresolved', 'Nerezolvat'
        IN_ANALYSIS = 'InAnalysis', 'În Analiză'

    account = models.ForeignKey(User, on_delete=models.CASCADE, related_name="returns")
    platform_account = models.ForeignKey(MarketplaceAccount, on_delete=models.PROTECT, related_name="returns")
    
    # Legătura cu comanda noastră (opțional, dacă o găsim)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name="returns")
    
    # Identificatori
    claim_id = models.CharField(max_length=100, unique=True, db_index=True)
    platform_order_number = models.CharField(max_length=100)
    
    # Meta
    claim_date = models.DateTimeField()
    status = models.CharField(max_length=50, choices=Status.choices)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Retur {self.platform_order_number} ({self.status})"

class ReturnLineItem(models.Model):
    """
    Produsul specific returnat.
    """
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name="items")
    
    # Identificatori
    claim_line_item_id = models.CharField(max_length=100, unique=True)
    sku = models.CharField(max_length=100)
    
    # Motivul clientului
    customer_reason = models.CharField(max_length=255, blank=True)
    customer_note = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.sku} (Motiv: {self.customer_reason})"
    
class Bundle(models.Model):
    
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Stocăm codul generat de AI sau logica ta
    bundle_code = models.CharField(max_length=50, blank=True) 
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def _str_(self):
        return f"{self.title} ({self.sku})"

class BundleItem(models.Model):
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name='items')
    # Legăm de produsul nostru intern
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.product.sku}"
    
class SystemEvent(models.Model):
    """
    Jurnal pentru a comunica starea proceselor de fundal către Frontend.
    """
    type = models.CharField(max_length=50, default='invoice_processing')
    message = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default='pending') # pending, processing, completed, error
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at'] # Cele mai noi primele

    def __str__(self):
        return f"{self.status}: {self.message}"