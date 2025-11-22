import os
from typing import List
from langchain_community.document_loaders import PyPDFLoader
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

os.environ["GOOGLE_API_KEY"] = "AIzaSyBI_4814osf_dzmUu4kYFkVgLVUlCThkuA"

class LinieProdus(BaseModel):
    cod: str = Field(..., description="Codul produsului")
    nume: str = Field(..., description="Numele produsului")
    bucati_totale: int = Field(..., description="Numărul din coloana 'BUC.' sau 'BUC'")
    valoare_totala_fara_tva: float = Field(..., description="Suma din coloana 'TOTAL FARA TVA'")

class FacturaData(BaseModel):
    produse: List[LinieProdus]

def proceseaza_si_calculeaza(cale_fisier: str):
    print(f"--- Procesez factura (PyPDFLoader): {cale_fisier} ---")
    
    loader = PyPDFLoader(cale_fisier)
    docs = loader.load()
    
    text = "\n\n".join([p.page_content for p in docs])

    if not text.strip():
        print("⚠️ ATENȚIE: PyPDFLoader nu a găsit text! E posibil ca PDF-ul să fie scanat.")

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0)
    structured_llm = llm.with_structured_output(FacturaData)

    system_prompt = """Analizează textul facturii linie cu linie.
    
    Trebuie să identifici corect coloanele bazându-te pe ordinea lor în pagină.
    Structura tipică a unei linii este:
    [NR] [COD] [NUME PRODUS] [CANTITATE] [UM/BOX] [BUC] [PRET UNITAR] [TOTAL FARA TVA] ...

    IGNORA PARTEA DE CANTITATE, GASESTE CUVANTUL BUC SI SELECTEAZA ACEL NUMAR

    REGULI DE EXTRAGERE STRICTE:
    1. Găsește cuvântul "BOX" (sau unitatea de măsură).
    2. Numărul IMEDIAT următor după "BOX" este 'bucati_totale' (Coloana 5).
    3. Urmează Prețul Unitar (pe care îl ignori).
    4. Numărul de după Prețul Unitar este 'valoare_totala_fara_tva' (Coloana 7).
    
    Exemplu de logică:
    Text: "11017N | TRIM VASE LAMAIE SI OTET 4L | 10.00 | BOX8 | 40 | 200,00 | 2.000,00"
    -> Văd BOX.
    -> Imediat după BOX este 40. Deci bucati_totale = 40.
    -> Apoi vine 200,00 (Preț).
    -> Apoi vine 2.000,00 (Total). Deci valoare_totala = 2000.00.
    Mereu valoarea totala se afla dupa PRET/U.M

    Atenție la formatul numerelor: "2.000,00" înseamnă 2000.00 float.
    Extrage doar produsele, ignoră totalurile de jos sau liniile de discount.
    """

    prompt = ChatPromptTemplate.from_messages([("system", system_prompt), ("human", "{input_text}")])
    chain = prompt | structured_llm
    
    return chain.invoke({"input_text": text})

if __name__ == "__main__":
    fisier = "/home/cmplesa/Desktop/UiPathAtlas/pdfReader/test2.pdf" 

    try:
        rezultat = proceseaza_si_calculeaza(fisier)
        
        print(f"\n{'NUME PRODUS':<35} | {'BUC':<5} | {'VAL. TOTALA':<10} | {'PRET/BUC (TVA INCLUS)':<20}")
        print("=" * 80)

        for p in rezultat.produse:
            if p.bucati_totale > 0:
                pret_net = p.valoare_totala_fara_tva / p.bucati_totale
                pret_final = pret_net * 1.21

                print(f"{p.nume[:35]:<35} | {p.bucati_totale:<5} | {p.valoare_totala_fara_tva:<10.2f} | {pret_final:.2f} RON")
            else:
                print(f"{p.nume[:35]:<35} | 0     | {p.valoare_totala_fara_tva:<10.2f} | EROARE (0 buc)")

    except Exception as e:
        print(f"Eroare: {e}")