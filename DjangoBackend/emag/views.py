from django.shortcuts import render
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
# Create your views here.

# emag/views.py
from django.http import JsonResponse
from .client import EmagApiClient  # Importă clasa ta

def test_emag_connection(request):
    """
    Un view simplu pentru a testa conexiunea și autentificarea la eMAG.
    """
    print("INFO: S-a apelat view-ul de testare a conexiunii eMAG...")
    
    try:
        client = EmagApiClient()
        # Acesta este request-ul propriu-zis:
        # Trimitem un POST la /category/read cu date goale 
        response_data = client.post('category', 'read')
        
        if response_data:
            # Dacă primim un răspuns (chiar și cu eroare de la eMAG), îl afișăm 
            print(response_data)
            return JsonResponse(response_data)
        else:
            # Asta se întâmplă dacă request-ul a eșuat complet (ex: eroare de conexiune)
            return JsonResponse({'error': 'Request-ul a eșuat. Verifică consola serverului.'}, status=500)
    
    except Exception as e:
        # Prinde orice eroare neașteptată (ex: clientul nu s-a putut inițializa)
        print(f"EROARE CRITICĂ în view: {e}")
        return JsonResponse({'error': str(e)}, status=500)
    

def get_new_orders(request):
    """
    Un view pentru a citi comenzile noi (status 1) de la eMAG.
    """
    print("INFO: S-a apelat view-ul de citire a comenzilor...")
    
    try:
        client = EmagApiClient()
        
        # Pregătim filtrul pentru comenzi noi
        data_payload = {
            'status': 1
        }
        
        # Apelăm API-ul order/read
        response_data = client.post('order', 'read', data=data_payload)
        
        return JsonResponse(response_data)
    
    except Exception as e:
        print(f"EROARE CRITICĂ în view: {e}")
        return JsonResponse({'error': str(e)}, status=500)
    
def get_vat_rates(request):
    """
    Un view pentru a citi ID-urile de TVA disponibile.
    (Necesar pentru a crea un produs)
    """
    print("INFO: S-a apelat view-ul de citire TVA...")
    try:
        client = EmagApiClient()
        # Apelăm API-ul vat/read 
        response_data = client.post('vat', 'read')
        return JsonResponse(response_data)
    
    except Exception as e:
        print(f"EROARE CRITICĂ în view: {e}")
        return JsonResponse({'error': str(e)}, status=500)
    
def get_handling_times(request):
    """
    Un view pentru a citi valorile de handling_time disponibile.
    (Necesar pentru a crea un produs)
    """
    print("INFO: S-a apelat view-ul de citire handling_time...")
    try:
        client = EmagApiClient()
        # Apelăm API-ul handling_time/read 
        response_data = client.post('handling_time', 'read')
        return JsonResponse(response_data)
    
    except Exception as e:
        print(f"EROARE CRITICĂ în view: {e}")
        return JsonResponse({'error': str(e)}, status=500)
    
# ... funcțiile de mai sus ...

# emag/views.py
# ... (păstrează celelalte funcții intacte: test_emag_connection, get_vat_rates, etc.)

def create_product_view(request):
    """
    View-ul care trimite o imprimantă de test la eMAG.
    Accesează: /emag/creare-produs/
    """
    print("INFO: Se încearcă crearea unui produs (imprimantă test)...")
    
    try:
        client = EmagApiClient()

        # --- Produs de test pentru categoria "Imprimante cu jet" (ID: 1) ---
        product_data = [
            {
                # !!! ID-ul tău intern. TREBUIE să fie UNIC
                # Dacă ai mai rulat, schimbă-l (ex: 99990003)
                "id": 99990002, 
                
                # --- DOCUMENTAȚIA PRODUSULUI ---
                
                "category_id": 1,  # Am setat ID-ul categoriei "Imprimante cu jet"
                
                "name": "Imprimanta Test API (Ignoră)",
                "part_number": "SKU-DJANGO-IMPRIMANTA-01", # SKU-ul tău
                "brand": "TestBrand",
                "description": "Descriere de test pentru imprimanta Django.",
                "images": [
                    {
                        "display_type": 1,
                        "url": "https://via.placeholder.com/600x600.png?text=Imprimanta+Test" 
                    }
                ],
                
                # Nu mai trimitem EAN, deoarece "is_ean_mandatory": false
                
                # --- OFERTA PRODUSULUI ---
                "status": 1,
                "sale_price": 149.99,
                "min_sale_price": 140.00,
                "max_sale_price": 160.00,
                
                "stock": [
                    { "warehouse_id": 1, "value": 5 }
                ],
                
                "handling_time": [
                    { "warehouse_id": 1, "value": 0 }
                ],
                
                "vat_id": 9, # Presupunem 1 (19%)
                
                "warranty": 0 # Nu este obligatorie, deci trimitem 0
            }
        ]
        # -----------------------------------------------------------------

        response_data = client.post('product_offer', 'save', data=product_data)
        
        return JsonResponse(response_data)
    
    except Exception as e:
        print(f"EROARE CRITICĂ în view: {e}")
        return JsonResponse({'error': str(e)}, status=500)