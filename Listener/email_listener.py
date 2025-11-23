import time
import imaplib
import email
import requests
import os
import sys
from email.header import decode_header

# --- CONFIGURARE ---
# Pune aici adresa ta de Gmail
EMAIL_USER = "EMAIL"

# Pune aici parola de aplicație de 16 caractere (fără spații)
EMAIL_PASS = "PASS" 

# Serverul IMAP pentru Gmail
IMAP_SERVER = "imap.gmail.com"

# API-ul tău Django local (nu ai nevoie de ngrok)
API_URL = "http://127.0.0.1:8000/api/v2/ecommerce/invoices/process/"

# Token-ul tău de autentificare din Django
AUTH_TOKEN = "Token ..." 

SUBIECTE_ACCEPTATE = ["Factura", "Invoice", "factura", "invoice"]

def get_decoded_header(header_value):
    """Funcție helper pentru a decoda subiectele de email care au caractere speciale."""
    if not header_value:
        return ""
    decoded_list = decode_header(header_value)
    text = ""
    for bytes_part, encoding in decoded_list:
        if isinstance(bytes_part, bytes):
            try:
                text += bytes_part.decode(encoding or "utf-8")
            except:
                text += bytes_part.decode("utf-8", errors="ignore")
        else:
            text += str(bytes_part)
    return text

def run_listener():
    print(f"Pornire Listener pentru {EMAIL_USER}...")
    print(f"Ținta API: {API_URL}")
    print("Aștept email-uri noi cu facturi PDF...")

    while True:
        try:
            mail = imaplib.IMAP4_SSL(IMAP_SERVER)
            mail.login(EMAIL_USER, EMAIL_PASS)
            mail.select("inbox")

            status, messages = mail.search(None, '(OR (UNSEEN SUBJECT "Factura") (UNSEEN SUBJECT "Invoice"))')
            email_ids = messages[0].split()

            if email_ids:
                print(f"\n📨 Găsit {len(email_ids)} email-uri noi!")

                for e_id in email_ids:
                    # Citim email-ul
                    _, msg_data = mail.fetch(e_id, "(RFC822)")
                    raw_email = msg_data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    
                    subject = get_decoded_header(msg["Subject"])
                    print(f"Analizez email: '{subject}'")

                    if subject not in SUBIECTE_ACCEPTATE:
                        print(f"Ignorat: '{subject}' (Nu este în lista permisă)")
                        continue

                    files_found = False
                    for part in msg.walk():
                        if part.get_content_maintype() == 'multipart' or part.get('Content-Disposition') is None:
                            continue

                        filename = part.get_filename()
                        if filename:
                            filename = get_decoded_header(filename)
                            
                        if filename and filename.lower().endswith(".pdf"):
                            print(f"Găsit fișier: {filename}")
                            
                            file_content = part.get_payload(decode=True)
                            
                            try:
                                print(" Trimit la Django API...", end="")
                                
                                response = requests.post(
                                    API_URL,
                                    headers={'Authorization': AUTH_TOKEN},
                                    files={'file': (filename, file_content, 'application/pdf')}
                                )
                                
                                if response.status_code == 200:
                                    print("SUCCES!")
                                    print(f" Răspuns Server: {response.json()}")
                                else:
                                    print(f" EROARE {response.status_code}")
                                    print(f" Detalii: {response.text}")
                                    
                                files_found = True
                                
                            except Exception as e:
                                print(f"Eroare conexiune API: {e}")

                    if not files_found:
                        print("      (Acest email nu are PDF-uri valide)")

            mail.close()
            mail.logout()

        except Exception as e:
            print(f"Eroare IMAP (posibil conexiune picată): {e}")
            print("Reîncerc în 5 secunde...")
        
        time.sleep(5)

if __name__ == "__main__":
    try:
        run_listener()
    except KeyboardInterrupt:
        print("\nListener oprit manual.")