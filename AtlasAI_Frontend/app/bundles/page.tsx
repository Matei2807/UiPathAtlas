"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, Upload } from "lucide-react"
import { useState } from "react"

interface Bundle {
  id: string
  products: string[]
  frequency: number
  status: "suggested" | "approved" | "processing" | "created"
  price?: number
  bundleCode?: string
  bundleTitle?: string
}

export default function BundlesPage() {
  const [isSearching, setIsSearching] = useState(false)
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearchBundles = async () => {
    setIsSearching(true)
    // Simulate API call to analyze orders from eMAG and Trendyol
    setTimeout(() => {
      setBundles([
        {
          id: "bundle-1",
          products: ["Detergent Chanteclair Bicarbonat 600ml", "Degresant Chanteclair Color 1575ml"],
          frequency: 47,
          status: "suggested",
          price: 39.99,
        },
        {
          id: "bundle-2",
          products: ["Balsam rufe albe Chanteclair 1800ml", "Detergent pardoseli Mosc alb 750ml"],
          frequency: 32,
          status: "suggested",
          price: 35.5,
        },
        {
          id: "bundle-3",
          products: [
            "Detergent Chanteclair Bicarbonat 600ml",
            "Balsam rufe albe Chanteclair 1800ml",
            "Degresant vase Chanteclair cu rodie 500ml",
          ],
          frequency: 28,
          status: "suggested",
          price: 54.99,
        },
        {
          id: "bundle-4",
          products: ["Degresant vase Chanteclair cu rodie 500ml", "Detergent pardoseli Mosc alb 750ml"],
          frequency: 19,
          status: "suggested",
          price: 27.25,
        },
      ])
      setIsSearching(false)
      setHasSearched(true)
    }, 3000)
  }

  const handleApproveBundle = async (bundleId: string) => {
    setBundles(bundles.map((b) => (b.id === bundleId ? { ...b, status: "processing" } : b)))

    // Simulate backend processing to generate bundle data
    setTimeout(() => {
      setBundles(
        bundles.map((b) => {
          if (b.id === bundleId) {
            return {
              ...b,
              status: "created",
              bundleCode: `BUNDLE-${Math.random().toString(36).substring(7).toUpperCase()}`,
              bundleTitle: `Set Curățenie Chanteclair - ${b.products.length} Produse`,
            }
          }
          return b
        }),
      )
    }, 2000)
  }

  const handleExportToChannel = (bundleId: string, channel: "emag" | "trendyol") => {
    const bundle = bundles.find((b) => b.id === bundleId)
    if (bundle) {
      console.log(`Exporting bundle ${bundleId} to ${channel}`)
      // API call to export bundle to marketplace
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
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Panou de Control</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Pachete</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pachete Produse</h1>
              <p className="text-muted-foreground">Detectare și creație de pachete din date de comenzi</p>
            </div>
            <Button onClick={handleSearchBundles} disabled={isSearching} size="lg">
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se caută pachete...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Cauta Pachete
                </>
              )}
            </Button>
          </div>

          {isSearching && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Analizez comenzile...</p>
                    <p className="text-sm text-blue-700">
                      Se analizează datele din eMAG și Trendyol pentru a detecta produsele frecvent cumpărate împreună.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {hasSearched && bundles.length === 0 && !isSearching && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <p className="text-amber-900">Nu au fost găsite pachete sugerate pe baza comenzilor actuale.</p>
              </CardContent>
            </Card>
          )}

          {bundles.length > 0 && (
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Pachete Sugerate</h2>
                  <p className="text-sm text-muted-foreground">{bundles.length} combinații de produse detectate</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bundles.map((bundle) => (
                  <Card key={bundle.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">Set de {bundle.products.length} Produse</CardTitle>
                          <CardDescription>Cumpărat împreună de {bundle.frequency} ori</CardDescription>
                        </div>
                        {bundle.status === "created" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">PRODUSE</p>
                          <ul className="space-y-1">
                            {bundle.products.map((product, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary font-bold mt-0.5">•</span>
                                <span>{product}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t">
                          <p className="text-xs font-semibold text-muted-foreground">PREȚ PACHET</p>
                          <p className="text-lg font-bold">{bundle.price?.toFixed(2) || "..."} Lei</p>
                        </div>

                        {bundle.status === "created" && (
                          <div className="space-y-2 pt-2 border-t">
                            <p className="text-xs font-semibold text-muted-foreground">INFORMAȚII GENERATE</p>
                            <div className="text-sm space-y-1">
                              <p>
                                <span className="font-medium">Cod:</span> {bundle.bundleCode}
                              </p>
                              <p className="text-xs text-muted-foreground">{bundle.bundleTitle}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardHeader className="pt-0 border-t">
                      <div className="flex gap-2">
                        {bundle.status === "suggested" && (
                          <Button onClick={() => handleApproveBundle(bundle.id)} size="sm" className="flex-1">
                            Aproba Pachet
                          </Button>
                        )}
                        {bundle.status === "processing" && (
                          <Button size="sm" disabled className="flex-1">
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Se procesează...
                          </Button>
                        )}
                        {bundle.status === "created" && (
                          <div className="flex gap-2 w-full">
                            <Button
                              onClick={() => handleExportToChannel(bundle.id, "emag")}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              Export eMAG
                            </Button>
                            <Button
                              onClick={() => handleExportToChannel(bundle.id, "trendyol")}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              Export Trendyol
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
