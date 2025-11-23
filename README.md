Prezentare echipa Atlas AI - UiPath Hackathon
https://www.canva.com/design/DAG5f5eyQHk/ohg0Oo7xts99KgNABtFuWQ/edit?utm_content=DAG5f5eyQHk&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton

**AtlasAI Commerce - Automatizare Inteligenta pentru Retailerii IMM**

Proiectul pleaca dintr-o realitate personala: familia mea activeaza in retail din 1991, iar astazi, IMM-urile sunt sufocate de expansiunea marilor retaileri. Trecerea in e-commerce este vitala pentru supravietuire, dar este blocata de lipsa echipelor IT interne si costurile prohibitive ale solutiilor ERP. Misiunea AtlasAI este sa democratizeze accesul la tehnologie, oferind micilor antreprenori un "angajat digital" capabil sa gestioneze autonom operatiunile complexe de vanzare online, eliminand barierele tehnice.

Gestionarea manuala a stocurilor pe platforme multiple (eMAG, Trendyol) este un cosmar logistic. De frica "overordering-ului" (vanzarea produselor fara stoc fizic), comerciantii declara stocuri mai mici, pierzand vanzari. Platforma noastra rezolva problema fragmentarii datelor (facturi pe mail, stocuri in Excel, comenzi disparate) si elimina riscul uman. Transformam un proces manual si predispus la eroare intr-un flux automatizat, sincronizat in timp real, care maximizeaza profitul.

Sistemul este un ecosistem de agenti inteligenti care colaboreaza autonom:

- **Agentul de Aprovizionare (Invoice Processing):** Monitorizeaza emailul si proceseaza facturile de la furnizori. Daca produsul exista, actualizeaza stocul. Daca identifica un produs nou (SKU inexistent), agentul devine proactiv: cauta pe web specificatii, imagini de inalta rezolutie si creeaza automat fisa produsului in baza de date, fara interventie umana.
- **Inventory Manager (Sincronizare):** Actioneaza ca "Single Source of Truth". Orice modificare de stoc sau pret in sistemul intern se propaga instantaneu pe toate canalele de vanzare (eMAG, Trendyol, WooCommerce), eliminand complet riscul de overselling.
- **Agentul de Crestere (Bundling AI):** Analizeaza istoric comenzile folosind "Market Basket Analysis" pentru a identifica produse cumparate frecvent impreuna. Pe baza stocului disponibil, propune automat pachete promotionale (Bundles). Mai mult, foloseste LLMs (Large Language Models) pentru a genera titluri atractive si descrieri de marketing persuasive, gata de publicare cu un singur click.

Solutia este construita pe o arhitectura moderna, modulara si scalabila:

- **Backend & Logic:** Python cu Django REST Framework pentru API-uri si logica de business.
- **Frontend:** **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI
- **Data:** PostgreSQL pentru stocarea relatiilor complexe intre produse si comenzi.
- **AI & Data Science:**
  - **LLMs (Generative AI):** Pentru crearea automata a continutului de marketing.
  - **Pandas/NumPy:** Pentru analiza statistica a datelor si generarea de bundles.
- **DevOps:** Docker pentru containerizare si deployment rapid.
