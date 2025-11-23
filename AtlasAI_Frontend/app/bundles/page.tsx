"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Loader2, CheckCircle2, Upload, Sparkles, AlertCircle, ArrowRight } from "lucide-react"
import { useState } from "react"
import Image from "next/image"

// --- CONFIG API ---
const API_BASE_URL = "http://localhost:8000/api/v2/ecommerce"

// Helper pentru token (înlocuiește cu logica ta reală de auth)
const getToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("userToken") || "132c0560ba71c28a3a06c46ab01bf2cc73a02353"
  }
  return ""
}

// --- INTERFEȚE ---

// Structura payload-ului pentru crearea bundle-ului (exact ce vine din API)
interface CreateBundlePayload {
  sku: string
  title: string
  description: string
  price: number
  list_price: number
  images: string[]
  components: {
    sku: string
    quantity: number
  }[]
}

// Structura sugestiei primită de la backend
interface BundleSuggestion {
  id: string
  sku: string
  title: string
  description: string
  products: string[]
  imageUrl: string | null
  price: number
  base_price: number
  savings: number
  score: number
  create_payload: CreateBundlePayload
  
  // Status local pentru UI
  uiStatus: "suggested" | "creating" | "created" | "error"
  uiError?: string
}

export default function BundlesPage() {
  const [isSearching, setIsSearching] = useState(false)
  const [bundles, setBundles] = useState<BundleSuggestion[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // --- 1. GENERARE SUGESTII ---
  const handleSearchBundles = async () => {
    setIsSearching(true)
    setGlobalError(null)
    setBundles([])

    try {
      const response = await fetch(`${API_BASE_URL}/bundles/generate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${getToken()}`
        },
        // Putem cere un limit specific dacă vrem
        body: JSON.stringify({ limit: 8 }) 
      })

      if (!response.ok) {
        throw new Error(`Eroare server: ${response.status}`)
      }

      const data = await response.json()
      console.log("Generare API response:", data)

      if (data.status === "success" && Array.isArray(data.suggestions)) {
        // Mapăm răspunsul și adăugăm statusul UI inițial
        const mappedBundles: BundleSuggestion[] = data.suggestions.map((item: any) => ({
          ...item,
          uiStatus: "suggested"
        }))
        setBundles(mappedBundles)
      } else {
        throw new Error("Format răspuns invalid de la server.")
      }
      
      setHasSearched(true)

    } catch (err: any) {
      console.error("Generate error:", err)
      setGlobalError(err.message || "Nu am putut genera pachetele. Verifică conexiunea.")
    } finally {
      setIsSearching(false)
    }
  }

  // --- 2. APROBARE & CREARE BUNDLE ---
  const handleApproveBundle = async (bundle: BundleSuggestion) => {
    // 1. Setăm status UI la "creating"
    setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, uiStatus: "creating", uiError: undefined } : b))

    try {
      // 2. Apelăm endpoint-ul de creare produs (ProductVariantViewSet -> create_bundle)
      // Endpoint-ul este pe ProductVariantViewSet, deci probabil ruta este /products/create_bundle/
      // SAU, dacă folosești router-ul default, poate fi /products/ (dar ai zis @action create_bundle)
      // Verifică urls.py din backend. De obicei actions pe ViewSet sunt: /prefix/{pk}/action/ sau /prefix/action/
      // Dacă e @action(detail=False), ruta e: .../ecommerce/products/create_bundle/ 
      // (Presupunând că ProductVariantViewSet e mapat la 'products')
      
      // Nota: În codul tău backend nu am văzut router-ul pentru ProductVariantViewSet în urls.py trimis.
      // Voi presupune că este mapat la '/products'. Dacă e altfel, schimbă aici.
      const createUrl = `${API_BASE_URL}/products/create_bundle/` 

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${getToken()}`
        },
        body: JSON.stringify(bundle.create_payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Eroare la crearea pachetului.")
      }

      // 3. Succes
      console.log("Bundle created:", result)
      setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, uiStatus: "created" } : b))

    } catch (err: any) {
      console.error("Create error:", err)
      setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, uiStatus: "error", uiError: err.message } : b))
    }
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="/">Panou de Control</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem><BreadcrumbPage>Pachete AI</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
          
          {/* Header Secțiune */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
                <Sparkles className="h-8 w-8 text-purple-600 fill-purple-100"/> 
                Generator Pachete Inteligente
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                AI-ul analizează istoricul comenzilor și stocul pentru a propune bundle-uri profitabile.
              </p>
            </div>
            
            <Button 
              onClick={handleSearchBundles} 
              disabled={isSearching} 
              size="lg" 
              className="bg-purple-600 hover:bg-purple-700 shadow-md transition-all hover:scale-105"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analizăm datele...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Generează Sugestii Noi
                </>
              )}
            </Button>
          </div>

          {/* Mesaj Eroare Globală */}
          {globalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>{globalError}</span>
            </div>
          )}

          {/* Mesaj Empty State (după căutare) */}
          {hasSearched && bundles.length === 0 && !isSearching && !globalError && (
            <Card className="border-dashed border-2 text-center py-12 bg-gray-50/50">
              <CardContent>
                <p className="text-lg text-muted-foreground">Nu am găsit combinații noi evidente momentan.</p>
                <p className="text-sm text-gray-500">Încearcă să imporți mai multe comenzi sau produse în baza de date.</p>
              </CardContent>
            </Card>
          )}

          {/* Grid Pachete */}
          {bundles.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {bundles.map((bundle) => (
                  <Card 
                    key={bundle.id} 
                    className={`flex flex-col overflow-hidden border transition-all duration-200 ${
                      bundle.uiStatus === 'created' 
                        ? 'border-green-200 bg-green-50/30' 
                        : 'hover:shadow-lg hover:border-purple-300'
                    }`}
                  >
                    {/* Imagine (dacă există) */}
                    <div className="aspect-video relative bg-gray-100 w-full overflow-hidden">
                      {bundle.imageUrl ? (
                        <img 
                          src={bundle.imageUrl} 
                          alt={bundle.title} 
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          Fără imagine
                        </div>
                      )}
                      
                      {/* Badge Economie */}
                      {bundle.savings < 0 && (
                        <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                          Economisești {Math.abs(bundle.savings).toFixed(2)} Lei
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <Badge variant="outline" className="font-mono text-xs text-gray-500">
                          {bundle.sku}
                        </Badge>
                        {bundle.uiStatus === "created" && (
                          <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Creat
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg leading-snug line-clamp-2 mt-2">
                        {bundle.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {bundle.description || "Fără descriere generată."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1">
                      {/* Lista Produse */}
                      <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm">
                        <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Conține:</p>
                        <ul className="space-y-1.5">
                          {bundle.products.map((prod, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-600">
                              <span className="text-purple-500 mt-0.5">•</span>
                              <span className="line-clamp-1">{prod}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prețuri */}
                      <div className="flex items-baseline justify-between mt-auto">
                        <div>
                          <p className="text-xs text-muted-foreground line-through">
                            {bundle.base_price.toFixed(2)} Lei
                          </p>
                          <p className="text-2xl font-bold text-purple-700">
                            {bundle.price.toFixed(2)} <span className="text-sm font-normal text-gray-500">Lei</span>
                          </p>
                        </div>
                        <div className="text-right">
                           {/* Scor sau alte metrice */}
                           {bundle.score > 0 && (
                             <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                               Scor AI: {bundle.score.toFixed(1)}
                             </Badge>
                           )}
                        </div>
                      </div>
                      
                      {/* Eroare locală la creare */}
                      {bundle.uiStatus === "error" && (
                        <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                          Eroare: {bundle.uiError}
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-0">
                      <Button 
                        onClick={() => handleApproveBundle(bundle)} 
                        disabled={bundle.uiStatus !== "suggested"}
                        className={`w-full font-semibold ${
                          bundle.uiStatus === 'created' ? 'opacity-50' : ''
                        }`}
                        variant={bundle.uiStatus === "created" ? "outline" : "default"}
                      >
                        {bundle.uiStatus === "creating" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Se creează...
                          </>
                        ) : bundle.uiStatus === "created" ? (
                          "Pachetul există în catalog"
                        ) : (
                          <>
                            Aprobă și Publică <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}