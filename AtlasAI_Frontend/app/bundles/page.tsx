"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, Upload, Sparkles } from "lucide-react"
import { useState } from "react"

// --- CONFIG API ---
const API_BASE_URL = "http://localhost:8000/api/v2/ecommerce"
// TODO: Token management (context sau localStorage)
const TEMPORARY_USER_TOKEN = "c8b8415c0a6634cf446a7b319750380beeea07b6"

interface Bundle {
  id: string
  products: string[] // Aici vor veni ["Detergent...", "Balsam..."] din excel
  frequency: number
  status: "suggested" | "approved" | "processing" | "created"
  price?: number
  bundleCode?: string
  bundleTitle?: string
  // Poți adăuga și asta dacă vrei să afișezi descrierea generată din Excel/AI
  bundleDescription?: string 
  savings?: number
}

export default function BundlesPage() {
  const [isSearching, setIsSearching] = useState(false)
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- API CALL ---
  const handleSearchBundles = async () => {
    setIsSearching(true)
    setError(null)
    setBundles([])

    try {
      const response = await fetch(`${API_BASE_URL}/bundles/generate/post/`, {
        method: 'POST', // POST pentru ca declansam o actiune de generare
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${TEMPORARY_USER_TOKEN}`
        }
      })

      if (!response.ok) {
        throw new Error(`Eroare server: ${response.status}`)
      }

      const data = await response.json()
      // Backend-ul returneaza direct lista de sugestii
      setBundles(data)
      setHasSearched(true)

    } catch (err: any) {
      console.error("Bundle gen error:", err)
      setError("Nu am putut genera pachetele. Verifică conexiunea cu serverul.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleApproveBundle = async (bundleId: string) => {
    // Logic to approve/create bundle in DB
    setBundles(bundles.map((b) => (b.id === bundleId ? { ...b, status: "processing" } : b)))
    
    // Simulare delay procesare (sau call catre endpoint /bundles/create/)
    setTimeout(() => {
        setBundles(prev => prev.map(b => {
            if (b.id === bundleId) {
                return {
                    ...b, 
                    status: "created",
                    bundleCode: `BND-${Math.floor(Math.random()*10000)}`,
                    bundleTitle: `Pachet Promo: ${b.products[0]} + ...`
                }
            }
            return b
        }))
    }, 1500)
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
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600"/> Pachete Inteligente
              </h1>
              <p className="text-muted-foreground">Agentul AI analizează comenzile și propune combinații profitabile.</p>
            </div>
            <Button onClick={handleSearchBundles} disabled={isSearching} size="lg" className="bg-purple-600 hover:bg-purple-700">
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agentul lucrează...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Generează Pachete Noi
                </>
              )}
            </Button>
          </div>

          {/* Zona Erori */}
          {error && (
            <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6 text-red-800">{error}</CardContent>
            </Card>
          )}

          {isSearching && (
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900">Analiză în curs...</p>
                    <p className="text-sm text-purple-700">
                      Căutăm corelații în comenzile eMAG și Trendyol. Calculăm marjele de profit.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {hasSearched && bundles.length === 0 && !isSearching && !error && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <p className="text-amber-900">Nu am găsit pachete noi evidente. Încearcă să vinzi mai multe produse individuale întâi.</p>
              </CardContent>
            </Card>
          )}

          {bundles.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bundles.map((bundle) => (
                  <Card key={bundle.id} className="flex flex-col border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge variant="secondary" className="mb-2">Frecvență: {bundle.frequency} comenzi</Badge>
                        {bundle.status === "created" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      </div>
                      <CardTitle className="text-base leading-tight">{bundle.bundleTitle || "Sugestie Pachet Nou"}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        <div className="flex-1">
                            <ul className="space-y-2">
                                {bundle.products.map((prod, i) => (
                                    <li key={i} className="text-sm flex gap-2">
                                        <span className="text-purple-600 font-bold">+</span> {prod}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="bg-muted/30 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Preț Promo propus:</span>
                                <span className="font-bold text-lg">{bundle.price?.toFixed(2)} Lei</span>
                            </div>
                        </div>

                        <Button 
                            onClick={() => handleApproveBundle(bundle.id)} 
                            disabled={bundle.status !== "suggested"}
                            className="w-full"
                            variant={bundle.status === "created" ? "outline" : "default"}
                        >
                            {bundle.status === "created" ? "Pachet Creat" : "Aprobă & Creează"}
                        </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}