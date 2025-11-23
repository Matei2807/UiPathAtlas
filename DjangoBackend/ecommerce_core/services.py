import os
import time
import warnings
import tempfile
import logging
import pathlib
from pathlib import Path
from typing import List, Dict, Any
from django.db import transaction
from langchain_community.document_loaders import PyPDFLoader
# 1. Importăm unealta Tavily
from tavily import TavilyClient
from langchain_community.tools import TavilySearchResults 
from duckduckgo_search import DDGS
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from django.conf import settings
from .models import Product, ProductVariant 
# from .bundling_core.logic import generate_bundles
# from .bundling_core.ai import rank_bundles
# from .bundling_core.models import PricingConfig, BundleConfig
# from .bundling_core.io import read_products, read_orders
from .bundling_core import (
    BundleConfig,
    CollageConfig,
    CloudinaryConfig,
    PricingConfig,
    generate_bundles,
    read_orders,
    read_products,
)
from .bundling_core.ai import (
    enrich_bundle_with_marketing_text,
    rank_bundles,
)
from .bundling_core.images import download_product_image, generate_collage, upload_to_cloudinary
from .bundling_core.llm_client import LLMClient

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)

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

class InvoiceProcessorService:
    def __init__(self, user):
        self.user = user
        # Cheile API
        os.environ["GOOGLE_API_KEY"] = "GOOGLE API KEY HERE"
        # 2. Setăm cheia Tavily
        os.environ["TAVILY_API_KEY"] = "API KEY TAVILY HERE"

    def _extract_data_from_pdf(self, file_path: str) -> FacturaData:
        print("--- [STEP 1] Încep citirea PDF-ului...")
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        text = "\n\n".join([p.page_content for p in docs])
        print(f"--- [STEP 1] PDF Citit ({len(text)} caractere). Trimit la Gemini pt structurare...")
        
        # Folosim 1.5-pro pentru stabilitate (2.5 dă erori de structură momentan)
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
        result = chain.invoke({"input_text": text})
        print(f"--- [STEP 1] Structurare finalizată. Am găsit {len(result.produse)} produse.")
        return result

    def _research_product_text(self, product_name: str) -> DetaliiMarketing:
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)
        structured_llm = llm.with_structured_output(DetaliiMarketing)
        
        search = TavilySearchResults(max_results=3)
        
        try:
            query = f"{product_name} descriere pret specificatii"
            print(f"   >>> [Tavily Text] Caut: {query}")
            
            web_results = search.invoke(query)
            
            # --- FIX: Folosim variabile în prompt, nu f-string direct ---
            prompt = ChatPromptTemplate.from_messages([
                ("system", "Ești un copywriter expert. Scrie o descriere atractivă în Română."),
                ("human", "Produs: {product_name}\n\nInformații de pe web:\n{web_info}")
            ])
            
            chain = prompt | structured_llm
            
            # Trimitem datele aici, în invoke
            return chain.invoke({
                "product_name": product_name,
                "web_info": str(web_results) # Convertim lista în string ca să nu fie interpretată greșit
            })
            
        except Exception as e:
            print(f"⚠️ Eroare Tavily Text: {e}")
            return DetaliiMarketing(
                nume_comercial=product_name, 
                descriere="Nu s-au găsit date", 
                beneficii="-", 
                categorie="Necunoscut"
            )

    def _search_product_image(self, product_name: str) -> str:
        """Caută imagine folosind Tavily (mult mai stabil decât DDG)."""
        print(f"   >>> [Tavily Image] Caut imagine pt: '{product_name}'")
        
        try:
            # Folosim clientul Tavily direct pentru imagini
            tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
            
            response = tavily_client.search(
                query=f"{product_name} product photo white background", 
                search_depth="basic", 
                include_images=True, # <--- Asta cerem
                max_results=1
            )
            
            images = response.get("images", [])
            
            if images:
                print("   >>> [Tavily Image] Imagine găsită!")
                return images[0] # Returnăm primul URL
            else:
                print("   >>> [Tavily Image] Nicio imagine găsită.")
                return None
                
        except Exception as e:
            print(f"⚠️ Eroare Tavily Image: {e}")
            return None

    def process_invoice(self, file_path: str, max_items: int = 10) -> Dict[str, Any]:
        raw_data = self._extract_data_from_pdf(file_path)
        
        created_products_log = []
        updated_products_log = []

        valid_products = [p for p in raw_data.produse if p.bucati_totale > 0]
        # Procesăm doar un număr limitat pentru început
        items_to_process = valid_products[:max_items]
        
        print(f"\n🔍 [PROCESS] Încep procesarea a {len(items_to_process)} produse valide...\n")

        for i, p in enumerate(items_to_process, 1):
            sku_curat = p.cod.strip()
            print(f"--- Produs {i}/{len(items_to_process)}: [{sku_curat}] {p.nume} ---")

            try:
                # CAZ 1: Există
                variant = ProductVariant.objects.get(sku__iexact=sku_curat)
                print(f"   ✅ [DB Check] Produsul există deja (Stoc curent: {variant.stock}). Fac update...")
                
                with transaction.atomic():
                    variant.stock += p.bucati_totale
                    variant.save()
                
                print(f"   ✅ [DB Update] Stoc actualizat la {variant.stock}.")
                updated_products_log.append({
                    "sku": variant.sku,
                    "name": variant.product.title,
                    "added": p.bucati_totale,
                    "new_stock": variant.stock
                })

            except ProductVariant.DoesNotExist:
                # CAZ 2: Nou -> Research
                print(f"   🆕 [DB Check] Produsul NU există. Încep procedura de creare...")
                
                pret_net = p.valoare_totala_fara_tva / p.bucati_totale
                pret_final = pret_net * 1.21 
                
                # Research
                marketing = self._research_product_text(p.nume)
                image_url = self._search_product_image(p.nume)
                
                nume_split = p.nume.split(" ")
                brand_detectat = nume_split[0] if len(nume_split) > 0 else "Generic"

                print(f"   💾 [DB Save] Salvez produsul nou în baza de date...")
                with transaction.atomic():
                    product_parent, _ = Product.objects.get_or_create(
                        sku=sku_curat, 
                        account=self.user,
                        defaults={
                            "title": marketing.nume_comercial or p.nume,
                            "brand": brand_detectat,
                            "description": marketing.descriere or ""
                        }
                    )

                    new_variant = ProductVariant.objects.create(
                        product=product_parent,
                        sku=sku_curat,
                        barcode=sku_curat,
                        stock=p.bucati_totale,
                        price=round(pret_final, 2),
                        images=[image_url] if image_url else [],
                        attributes={"sursa": "import_pdf_auto"}
                    )
                
                print(f"   ✨ [Success] Produs creat cu ID: {new_variant.id}")
                created_products_log.append({
                    "sku": new_variant.sku,
                    "name": product_parent.title,
                    "price": new_variant.price,
                    "stock": new_variant.stock,
                    "image": image_url
                })
                
                # Cu Tavily nu e nevoie de pauze lungi, e un API comercial
                time.sleep(0.5)

        print("\n✅ [DONE] Procesare finalizată.")
        return {
            "summary": {
                "total_processed": len(items_to_process),
                "updated": len(updated_products_log),
                "created": len(created_products_log)
            },
            "created_products": created_products_log,
            "updated_products": updated_products_log
        }

def run_bundle_generation_service(limit=5):
    """
    Generează sugestii de pachete folosind logica AI și Image Processing.
    Returnează un JSON gata de trimis la frontend.
    
    Args:
        limit (int): Numărul maxim de sugestii de returnat (pentru a evita timeout-ul).
    """
    
    # 1. Configurare Căi și Mediu
    # Presupunem că data.xlsx este în rădăcina proiectului
    excel_path = os.path.join(settings.BASE_DIR, 'data.xlsx')
    
    if not os.path.exists(excel_path):
        logger.error(f"Nu am găsit data.xlsx la: {excel_path}")
        return []

    # 2. Configurare Parametri (Preluati din env sau hardcodati temporar)
    pricing_cfg = PricingConfig(commission_rate=0.15, fixed_cost=5.0, min_price=30.0)
    bundle_cfg = BundleConfig(max_multiplier_per_brand=5)
    collage_cfg = CollageConfig()
    
    # Configurare Cloudinary din Django Settings
    cloud_cfg = CloudinaryConfig(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )

    # 3. Citirea Datelor
    try:
        # TODO Pe viitor: În loc de read_products, poți interoga DB-ul Django: ProductVariant.objects.all()
        # și să le mapezi la obiectele așteptate de bundling_core.
        products = read_products(excel_path)
        orders = read_orders(excel_path)
        
        # Mapare pentru acces rapid la descrieri originale
        products_by_sku = {p.sku: p for p in products}
    except Exception as e:
        logger.error(f"Eroare la citirea datelor: {e}")
        raise e

    # 4. Generare Pachete (Logica Core)
    logger.info("Generare bundle-uri brute...")
    raw_bundles = generate_bundles(products, pricing_cfg, bundle_cfg, orders=orders)
    
    # Păstrăm doar cele cu stoc pozitiv
    valid_bundles = [b for b in raw_bundles if getattr(b, "max_bundle_stock", 0) > 0]
    
    # 5. Ranking & Sortare
    logger.info("Ranking bundle-uri...")
    ranked_data = rank_bundles(valid_bundles, orders=orders, top_n=20) # Luăm top 20 pentru analiză
    top_bundles = [b for b, score in ranked_data]
    
    # Limităm procesarea grea (AI + Imagini) la primele 'limit' rezultate
    top_bundles = top_bundles[:limit]

    # 6. Procesare Imagini & AI (Heavy Lifting)
    
    # Pregătim imaginile produselor (Download o singură dată)
    product_images_cache = {}
    # Descărcăm doar imaginile necesare pentru bundle-urile selectate
    needed_skus = set()
    for bundle in top_bundles:
        for item in bundle.items:
            needed_skus.add(item.product.sku)
            
    logger.info("Descărcare imagini produse...")
    for product in products:
        if product.sku in needed_skus:
            try:
                product_images_cache[product.sku] = download_product_image(product)
            except Exception as e:
                logger.warning(f"Nu am putut descărca imaginea pentru {product.sku}: {e}")

    # Inițializare AI Client
    ai_client = LLMClient.from_env()

    results = []
    
    # Folder temporar pentru colaje
    with tempfile.TemporaryDirectory() as temp_dir:
        for idx, bundle in enumerate(top_bundles):
            logger.info(f"Procesare bundle {idx+1}/{len(top_bundles)}: {bundle.sku}")
            
            # A. Generare Text Marketing (AI)
            marketing_title = bundle.title
            marketing_desc = ""
            
            if ai_client:
                try:
                    # Funcția enrich modifică bundle-ul in-place sau returnează unul nou
                    enriched = enrich_bundle_with_marketing_text(bundle, products, client=ai_client)
                    marketing_title = enriched.title
                    marketing_desc = enriched.description
                except Exception as e:
                    logger.warning(f"AI enrichment failed: {e}")
                    marketing_desc = _fallback_description(bundle, products_by_sku)
            else:
                marketing_desc = _fallback_description(bundle, products_by_sku)

            # B. Generare Colaj & Upload
            collage_url = None
            if cloud_cfg.is_configured:
                try:
                    collage_path = generate_collage(bundle, product_images_cache, collage_cfg, temp_dir)
                    collage_url = upload_to_cloudinary(collage_path, cloud_cfg)
                except Exception as e:
                    logger.error(f"Image generation failed for {bundle.sku}: {e}")
            
            # C. Formatare pentru Frontend
            # Calculăm componentele pentru request-ul de creare
            components_payload = [
                {
                    "variant_id": _find_variant_id_by_sku(item.product.sku), # Helper necesar
                    "sku": item.product.sku,
                    "quantity": item.quantity,
                    "name": item.product.name
                }
                for item in bundle.items
            ]
            
            # Calculăm economia
            savings = bundle.base_price - bundle.final_price

            aux = bundle.base_price
            bundle.base_price = bundle.final_price
            bundle.final_price = aux

            results.append({
                "id": f"sugg-{idx}-{bundle.sku}",
                "sku": bundle.sku, # SKU-ul sugerat
                
                # Date pentru UI
                "title": marketing_title,
                "description": marketing_desc,
                "products": [item.product.name for item in bundle.items],
                "imageUrl": collage_url,
                
                # Date Financiare
                "price": float(bundle.final_price),
                "base_price": float(bundle.base_price),
                "savings": round(float(savings), 2),
                "score": float(getattr(bundle, 'score', 0)),
                
                # Payload complet pentru butonul "Creează Bundle" din Frontend
                "create_payload": {
                    "sku": bundle.sku,
                    "title": marketing_title,
                    "description": marketing_desc,
                    "price": float(bundle.final_price),
                    "list_price": float(bundle.base_price),
                    "images": [collage_url] if collage_url else [],
                    # Frontend-ul va trebui să mapeze SKU-urile la ID-uri reale dacă helper-ul de mai jos nu le găsește
                    "components": [
                        {"sku": c['sku'], "quantity": c['quantity']} for c in components_payload
                    ]
                }
            })

    return results

def _fallback_description(bundle, products_by_sku):
    """Generare descriere simplă dacă AI-ul nu e disponibil."""
    descs = []
    seen = set()
    for item in bundle.items:
        sku = item.product.sku
        if sku in seen: continue
        seen.add(sku)
        prod = products_by_sku.get(sku)
        if prod and prod.description:
            descs.append(str(prod.description)[:100] + "...")
    return "\n".join(descs)

def _find_variant_id_by_sku(sku):
    """
    Încearcă să găsească ID-ul variantei din DB pe baza SKU-ului din Excel.
    Returnează None dacă nu găsește (Frontend-ul va trebui să gestioneze asta).
    """
    from ecommerce_core.models import ProductVariant
    try:
        # Atenție: Aici presupunem că SKU-ul din Excel este identic cu cel din DB
        variant = ProductVariant.objects.filter(sku=sku).first()
        return variant.id if variant else None
    except:
        return None