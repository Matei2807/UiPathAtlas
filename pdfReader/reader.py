import os
import time
import pandas as pd
from typing import List
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.tools import DuckDuckGoSearchRun
from duckduckgo_search import DDGS 
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

os.environ["GOOGLE_API_KEY"] = "AIzaSyDBm6k-nfP7uYINhToiOXatYndAFpfrwxk"

class LinieProdus(BaseModel):
    cod: str = Field(..., description="Codul produsului")
    nume: str = Field(..., description="Numele produsului")
    bucati_totale: int = Field(..., description="Numărul din coloana 'BUC.' sau 'BUC'")
    valoare_totala_fara_tva: float = Field(..., description="Suma din coloana 'TOTAL FARA TVA'")

class FacturaData(BaseModel):
    produse: List[LinieProdus]

class DetaliiMarketing(BaseModel):
    nume_comercial: str = Field(..., description="Nume corectat și curat pentru site")
    descriere: str = Field(..., description="Descriere marketing (50-80 cuvinte)")
    beneficii: str = Field(..., description="Lista beneficii separate prin virgula")
    categorie: str = Field(..., description="Categoria produsului")

def proceseaza_factura(cale_fisier: str):
    print(f"📄 [1/3] Citesc factura: {cale_fisier} ...")
    
    loader = PyPDFLoader(cale_fisier)
    docs = loader.load()
    text = "\n\n".join([p.page_content for p in docs])

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

def cerceteaza_produs(nume_produs: str):
    llm_research = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)
    structured_llm = llm_research.with_structured_output(DetaliiMarketing)
    
    search = DuckDuckGoSearchRun()
    
    try:
        query = f"{nume_produs} descriere pret magazin online"
        rezultate_web = search.invoke(query)

        print(f"Astea sunt {rezultate_web}")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Ești un expert copywriter. Pe baza rezultatelor web, scrie o descriere atractivă în Română pentru produs."),
            ("human", f"Produs: {nume_produs}\nInfo Web: {rezultate_web}")
        ])
        
        chain = prompt | structured_llm
        return chain.invoke({})
        
    except Exception:
        return DetaliiMarketing(nume_comercial=nume_produs, descriere="Nu s-au găsit date", beneficii="", categorie="Necunoscut")

def cauta_imagine_produs(nume_produs: str) -> str:
    """Caută prima imagine relevantă pe DuckDuckGo și returnează URL-ul."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(
                keywords=f"{nume_produs} product photo", 
                region="ro-ro", 
                safesearch="off", 
                max_results=1
            ))
            
            if results:
                return results[0]['image']
            else:
                return "Fara imagine"
    except Exception as e:
        return "Eroare cautare"

if __name__ == "__main__":
    fisier = "/home/cmplesa/Desktop/UiPathAtlas/pdfReader/test2.pdf"
    fisier_excel_iesire = "produse_procesate_cu_poze.xlsx"

    try:
        date_factura = proceseaza_factura(fisier)
        print(f"✅ Am găsit {len(date_factura.produse)} produse în factură.\n")
        print(date_factura)

        lista_finala = []

        print("🌍 [2/3] Încep cercetarea (Text + Imagini)...")
        
        total_produse = len(date_factura.produse)
        
        for i, p in enumerate(date_factura.produse, 1):
            if i > 10:
                break
            
            if p.bucati_totale > 0:
                pret_net = p.valoare_totala_fara_tva / p.bucati_totale
                pret_final_raft = pret_net * 1.21
                
                print(f"   Processing ({i}/{total_produse}): {p.nume[:30]}...")
                
                detalii_marketing = cerceteaza_produs(p.nume)
                
                link_poza = cauta_imagine_produs(p.nume)
                nume_split = p.nume.split(" ")
                
                lista_finala.append({
                    "Cod intern":p.cod, # sku
                    "Nume Factura": p.nume, 
                    "Nume Comercial": detalii_marketing.nume_comercial, # title 
                    "Categorie": detalii_marketing.categorie,
                    "Cantitate": p.bucati_totale,
                    "Pret Achizitie Total": p.valoare_totala_fara_tva,
                    "PRET FINAL (cu TVA)": round(pret_final_raft, 2), # price
                    "Link Imagine": link_poza,
                    "Descriere Site": detalii_marketing.descriere, # description
                    "Beneficii": detalii_marketing.beneficii,
                    "Brand": nume_split[0]
                })
                
                time.sleep(1.5)

        print(f"\n💾 [3/3] Salvez datele în {fisier_excel_iesire}...")
        df = pd.DataFrame(lista_finala)
        df.to_excel(fisier_excel_iesire, index=False)
        
        print("🎉 GATA! Verifică fișierul Excel.")

    except Exception as e:
        print(f"Eroare critică: {e}")