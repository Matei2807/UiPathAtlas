from django.urls import path
from . import views

app_name = 'ecommerce_trendyol'

urlpatterns = [
    # GET /api/v2/ecommerce/trendyol/categories/?search=...
    path('categories/', views.CategoryListView.as_view(), name='category-list'),
    
    # GET /api/v2/ecommerce/trendyol/categories/1234/attributes/
    path('categories/<int:category_id>/attributes/', views.CategoryAttributeView.as_view(), name='category-attributes'),
    
    # GET /api/v2/ecommerce/trendyol/brands/?name=...
    path('brands/', views.BrandSearchView.as_view(), name='brand-search'),

    # Webhook Endpoint
    # Trendyol va face POST aici. {seller_id} ne ajută să identificăm contul rapid.
    path('webhook/orders/<str:seller_id>/', views.TrendyolOrderWebhookView.as_view(), name='webhook-orders'),
]
