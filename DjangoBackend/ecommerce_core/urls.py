from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'ecommerce_core'

router = DefaultRouter()

# /api/v2/ecommerce/accounts/
router.register(r'accounts', views.MarketplaceAccountViewSet, basename='marketplace-account')

# /api/v2/ecommerce/listings/
router.register(r'listings', views.MarketplaceListingViewSet, basename='marketplace-listing')

# /api/v2/ecommerce/orders/
router.register(r'orders', views.OrderViewSet, basename='order')

# /api/v2/ecommerce/returns/
router.register(r'returns', views.ReturnRequestViewSet, basename='return-request')

router.register(r'products', views.ProductVariantViewSet, basename='product-variant')

router.register(r'invoices', views.InvoiceImportViewSet, basename='invoice-import')

router.register(r'events', views.SystemEventViewSet, basename='system-events')

# router.register(r'bundles', views.BundleViewSet, basename='bundle')


urlpatterns = [
    path('', include(router.urls)),
    path('bundles/generate/', views.BundleGeneratorView.as_view(), name='generate-bundles'),
    ]