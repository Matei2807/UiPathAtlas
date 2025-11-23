from django.contrib import admin
from django.urls import path, include
from travel_planner import views
from social_automation import views as social_views

urlpatterns = [
    path('admin/', admin.site.urls),  # Ruta pentru interfața de administrare
    path('list/', views.get_travel_plans, name='get_travel_plans'),  # Ruta pentru listare
    path('get-flight/', views.generate_flights, name = 'get_flight'),
    path('get-hotel/', views.generate_hotels, name = 'get_hotel'),
    path('refine/', views.regenerate_part_day_itinerary, name = 'get_attraction'),
    path('generate-itinerary-stream/', views.generate_async_itinerary_request, name='generate_async_itinerary'),
    path('chat-assistant/', views.generate_itinerary_request_chat, name='chat_assistant'),
    path('start-assistant/', views.start_itinerary_request_chat, name='create_travel_plan'),
    path('start-assistant-chat/', views.start_assistant_chat, name='start_assistant_chat'),
    path('talk-chat/', views.talk_chat, name='talk_chat'),
    
    path('api/pcom/send_message/adv18an2aca19ca', views.send_message_ai, name='send_message_ai'),
    
    # GetYourGuide API integration
    path('api/', include('new_backend.urls')),
    
    path('api/social/', include('social_automation.urls')), # Ruta principală pentru noua aplicație
    path('social/upload-image/', social_views.upload_multiple_images_for_post, name='upload_image_for_post'),  # TODO: doar test deocamdată - normal e la /api/social/upload-image/
    
    path('api/auth/', include('dj_rest_auth.urls')), # Oferă endpoint-uri ca /api/auth/login/, /api/auth/logout/
    path('api/auth/register/', include('dj_rest_auth.registration.urls')), # Oferă endpoint-ul /api/auth/register/

    # Ecommerce URLs
    path('api/v2/ecommerce/', include('ecommerce_core.urls')), # Vom adăuga acest fișier în etapa 3
    path('api/v2/ecommerce/trendyol/', include('ecommerce_trendyol.urls')),
    
]
