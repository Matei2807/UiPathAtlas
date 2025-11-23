from django.urls import path
from . import views

app_name = 'emag'

urlpatterns = [ # /api/emag/...
    path('request-access-token/', views.test_emag_connection, name='request_access_token'),
    path('get-new-orders/', views.get_new_orders, name='get_new_orders'),
    # Rutele noi pentru prerechizite
    path('vat/', views.get_vat_rates, name='get_vat_rates'),
    path('handling-time/', views.get_handling_times, name='get_handling_times'),
    
    # Ruta principală pentru a crea produsul
    path('creare-produs/', views.create_product_view, name='create_product_view'),
]