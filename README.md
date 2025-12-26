# AtlasAI Commerce - Intelligent Automation for SME Retailers

**Atlas AI Team Presentation - UiPath Hackathon** [View Presentation on Canva](https://www.canva.com/design/DAG5f5eyQHk/ohg0Oo7xts99KgNABtFuWQ/edit?utm_content=DAG5f5eyQHk&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)

---

## 📌 Mission & Vision
The project stems from a personal reality: my family has been active in retail since 1991, and today, SMEs are being suffocated by the expansion of major retailers. Transitioning to e-commerce is vital for survival, yet it is often blocked by the lack of internal IT teams and the prohibitive costs of ERP solutions. 

**AtlasAI's mission** is to democratize access to technology by providing small entrepreneurs with a "digital employee" capable of autonomously managing complex online sales operations, effectively removing technical barriers.

## 💡 The Problem
Manually managing inventory across multiple platforms (eMAG, Trendyol, etc.) is a logistical nightmare. Fear of "over-ordering" (selling products without physical stock) leads merchants to declare lower stock levels, resulting in lost sales. 

Our platform solves the problem of data fragmentation (invoices in emails, stocks in Excel, disparate orders) and eliminates human error. We transform a manual, error-prone process into an automated, real-time synchronized workflow that maximizes profit.

## 🤖 The System: An Ecosystem of Intelligent Agents
AtlasAI consists of collaborative agents that work autonomously:

* **Supply Agent (Invoice Processing):** Monitors emails and processes supplier invoices. If the product exists, it updates the stock. If it identifies a new product (non-existent SKU), the agent becomes proactive: it searches the web for specifications and high-resolution images, automatically creating the product file in the database without human intervention.
* **Inventory Manager (Synchronization):** Acts as the "Single Source of Truth." Any change in stock or price within the internal system is instantly propagated across all sales channels (eMAG, Trendyol, WooCommerce), completely eliminating the risk of overselling.
* **Growth Agent (AI Bundling):** Analyzes order history using "Market Basket Analysis" to identify products frequently bought together. Based on available stock, it automatically proposes promotional bundles. Furthermore, it uses LLMs (Large Language Models) to generate attractive titles and persuasive marketing descriptions, ready to be published with a single click.

## 🛠 Tech Stack
The solution is built on a modern, modular, and scalable architecture:

* **Backend & Logic:** Python with Django REST Framework for APIs and business logic.
* **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI.
* **Database:** PostgreSQL for storing complex relationships between products and orders.
* **AI & Data Science:**
    * **LLMs (Generative AI):** For automated marketing content creation.
    * **Pandas/NumPy:** For statistical data analysis and bundle generation.
* **DevOps:** Docker for containerization and rapid deployment.
