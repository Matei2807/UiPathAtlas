import requests
import base64
from django.conf import settings

class EmagApiClient:
    """
    Client pentru a interacționa cu eMAG Marketplace API v4.
    """
    def __init__(self):
        self.base_url = settings.EMAG_API_URL
        self.username = settings.EMAG_USER
        self.password = settings.EMAG_PASS
        
        if not all([self.base_url, self.username, self.password]):
            raise ValueError("Datele de autentificare eMAG (URL, USER, PASS) nu sunt setate în settings.py")
        
        self.auth_hash = self._generate_auth_hash()

    def _generate_auth_hash(self):
        """
        Generează hash-ul Base64 pentru Basic Authorization.
        """
        auth_string = f"{self.username}:{self.password}"
        auth_bytes = auth_string.encode('ascii')
        hash_bytes = base64.b64encode(auth_bytes)
        return hash_bytes.decode('ascii') # Returnează string-ul final

    def post(self, resource, action, data={}):
        """
        Metoda principală pentru a trimite un request POST la API.
        
        :param resource: Resursa API (ex: 'category', 'product_offer')
        :param action: Acțiunea API (ex: 'read', 'save')
        :param data: Payload-ul JSON (datele) de trimis
        """
        
        url = f"{self.base_url}/{resource}/{action}"
        
        headers = {
            'Authorization': f'Basic {self.auth_hash}',
            'Content-Type': 'application/json'
        }
        
        print(f"DEBUG: Trimitere request către {url}...")
        
        try:
            response = requests.post(url, json=data, headers=headers)
            
            response.raise_for_status() 

            response_data = response.json()
            
            if response_data.get('isError', True):
                print(f"Eroare API eMAG: {response_data.get('messages')}")
            
            return response_data

        except requests.exceptions.HTTPError as e:
            print(f"Eroare HTTP: {e.response.status_code} - {e.response.text}")
            return {'isError': True, 'messages': [f"Eroare HTTP: {e.response.status_code}", e.response.text]}
        except requests.exceptions.RequestException as e:
            print(f"Eroare de conexiune: {e}")
            return {'isError': True, 'messages': [f"Eroare de conexiune: {e}"]}