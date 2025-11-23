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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Save, ArrowLeft, Package, Layers, Info, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner" // Recomand să instalezi sonner sau folosești alert simplu

// --- API CONFIG ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
const TEMPORARY_USER_TOKEN = "132c0560ba71c28a3a06c46ab01bf2cc73a02353"

// Tipuri pentru datele de la Backend
interface ProductDetail {
  id: number;
  sku: string;
  stock: number;
  price: string;
  is_bundle: boolean;
  product_details: {
    id: number;
    title: string;
    brand: string;
    description: string;
  };
  components: Array<{
    id: number;
    component_variant: number;
    component_sku: string;
    component_name: string;
    component_image: string;
    quantity: number;
    current_stock: number;
  }>;
  listings: Array<{
      channel: string;
      is_active: boolean;
  }>;
  // Câmpurile de mai jos sunt adăugate local, nu vin de la API
  channels: {
    emag: { active: boolean; mapped: boolean };
    trendyol: { active: boolean; mapped: boolean };
  };
}

const channels = [
  { id: "emag", name: "eMAG", logo: "eM" },
  { id: "trendyol", name: "Trendyol", logo: "TR" },
]

export default function ProductEditPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // --- FETCH PRODUS ---
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const token = localStorage.getItem("accessToken") || TEMPORARY_USER_TOKEN
        // Endpoint: /api/v2/ecommerce/products/{id}/
        const res = await fetch(`${API_BASE_URL}/api/v2/ecommerce/products/${params.id}/`, {
          headers: { 'Authorization': `Token ${token}` }
        })
        
        if (!res.ok) throw new Error("Produsul nu a fost găsit.")
        
        const data = await res.json()
        
        // Procesăm canalele din listings
        const channelsData = (data.listings || []).reduce((acc: any, listing: any) => {
            const channelName = listing.channel?.toLowerCase();
            if (channelName) {
                acc[channelName] = { active: listing.is_active, mapped: true };
            }
            return acc;
        }, { emag: { active: false, mapped: false }, trendyol: { active: false, mapped: false } });

        // Normalizăm datele
        setProduct({
            ...data,
            channels: channelsData,
            // Asigurăm existența obiectului product_details
            product_details: data.product_details || { title: 'N/A', brand: 'N/A', description: '' }
        })
      } catch (error) {
        console.error(error)
        alert("Eroare la încărcarea produsului!")
        router.push("/products")
      } finally {
        setIsLoading(false)
      }
    }

    if (params.id) fetchProduct()
  }, [params.id, router])

  // --- SAVE ---
  const handleSave = async () => {
    if (!product) return
    setIsSaving(true)
    try {
        const token = localStorage.getItem("accessToken") || TEMPORARY_USER_TOKEN
        // PATCH request
        const res = await fetch(`${API_BASE_URL}/api/v2/ecommerce/products/${product.id}/`, {
            method: "PATCH",
            headers: { 
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stock: product.stock,
                // Trimitem prețul doar dacă s-a schimbat
                price: product.price 
            })
        })

        if (!res.ok) throw new Error("Eroare la salvare")
        
        // Feedback vizual simplu (poți înlocui cu Toast)
        alert("Modificările au fost salvate cu succes!")
        
    } catch (error) {
        console.error(error)
        alert("Nu s-a putut salva.")
    } finally {
        setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  if (!product) return null

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
                  <BreadcrumbLink href="/">Panou</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/products">Produse</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-mono">{product.sku}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/products">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Înapoi
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    {product.is_bundle ? "Editare Bundle" : "Editare Produs"}
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    {product.is_bundle ? <Layers className="h-4 w-4"/> : <Package className="h-4 w-4"/>}
                    <span>
                        {product.is_bundle ? "Produs compus (Bundle)" : "Produs individual (Stoc Fizic)"}
                    </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            
            {/* STÂNGA: Informații Produs */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Informații de Bază</CardTitle>
                <CardDescription>Editează detaliile produsului din PIM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 space-y-2">
                        <Label htmlFor="sku">SKU</Label>
                        <Input id="sku" value={product.sku} disabled className="bg-muted font-mono" />
                    </div>
                    <div className="col-span-2 space-y-2">
                        <Label htmlFor="name">Nume Produs</Label>
                        <Input 
                            id="name" 
                            value={product.product_details.title} 
                            disabled // Numele vine din Părinte, deocamdată read-only aici
                        />
                    </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descriere (Marketing)</Label>
                  <Textarea
                    id="description"
                    value={product.product_details.description}
                    disabled // Readonly momentan
                    className="resize-none bg-muted/20"
                    rows={4}
                  />
                </div>

                <Separator />

                {/* ZONA STOC & PREȚ */}
                <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        {product.is_bundle ? <Layers className="h-4 w-4 text-purple-600"/> : <Package className="h-4 w-4 text-green-600"/>}
                        Gestiune Stoc & Preț
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border">
                        <div className="space-y-2">
                            <Label>Preț de Bază (Lei)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={product.price}
                                onChange={(e) => setProduct({ ...product, price: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                              Stoc Fizic
                              {product.is_bundle && (
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" title="La bundle, stocul se calculează automat." />
                              )}
                          </Label>
                          <Input
                              type="number"
                              value={product.stock}
                              onChange={(e) => setProduct({ ...product, stock: parseInt(e.target.value) || 0 })}
                              className={product.is_bundle ? "bg-purple-50 border-purple-200" : ""}
                          />
                      </div>
                    </div>
                </div>

                <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                  Salvare Modificări
                </Button>
              </CardContent>
            </Card>

            {/* DREAPTA: Canale (Mockup UI - Backend-ul încă nu suportă scriere pe canale direct de aici) */}
            <Card>
              <CardHeader>
                <CardTitle>Disponibilitate Canale</CardTitle>
                <CardDescription>Statusul sincronizării pe platforme externe</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full" defaultValue={["trendyol", "emag"]}>
                  {channels.map((channel) => {
                    // @ts-ignore
                    const channelData = product.channels?.[channel.id] || { active: false, mapped: false }

                    return (
                      <AccordionItem key={channel.id} value={channel.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium border ${channelData.active ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                              {channel.logo}
                            </div>
                            <span>{channel.name}</span>
                            {channelData.active && (
                              <Badge variant="outline" className="ml-2 text-xs border-green-200 bg-green-50 text-green-700">Activ</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4 px-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch id={`${channel.id}-active`} checked={channelData.active} disabled />
                                <Label htmlFor={`${channel.id}-active`} className="text-muted-foreground">
                                    {channelData.active ? "Sincronizare Activă" : "Sincronizare Oprită"}
                                </Label>
                            </div>
                            {channelData.mapped ? (
                                <span className="text-xs text-blue-600 font-medium">Produs Mapat</span>
                            ) : (
                                <span className="text-xs text-gray-400">Nemapata</span>
                            )}
                          </div>
                          
                          {/* Placeholder pentru viitoare setări de preț per canal */}
                          <div className="bg-muted/30 p-3 rounded text-xs text-muted-foreground">
                            Setările avansate de preț pentru {channel.name} vor fi disponibile curând.
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </CardContent>
            </Card>

            {product.is_bundle && (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Componente Bundle</CardTitle>
                  <CardDescription>Produsele incluse în acest pachet</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {product.components?.map((comp) => (
                      <div key={comp.id} className="flex items-center gap-4 border p-3 rounded-lg">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img 
                              src={comp.component_image || "/placeholder.png"} 
                              alt={comp.component_name}
                              className="h-full w-full object-cover"
                           />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2" title={comp.component_name}>{comp.component_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{comp.component_sku}</p>
                        </div>
                        <div className="text-right text-sm shrink-0">
                            <div className="font-medium">x{comp.quantity}</div>
                            <div className={`text-xs ${comp.current_stock > 0 ? "text-green-600" : "text-red-600"}`}>
                                Stoc: {comp.current_stock}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  )
}