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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RefreshCw, Plus, Loader2, Layers, Package } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// --- CONFIGURARE API ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
const TEMPORARY_USER_TOKEN = "98f91c94d678d96df72f2ff5f04683b18c5dc0c3" // În producție ia-l din AuthContext

// Interfața Backend Django
interface ProductData {
  id: number
  sku: string
  product_name: string
  brand: string
  stock: number
  price: string // Vine ca string din Django Decimal
  // Adăugăm un flag opțional pentru viitor când backend-ul va suporta bundle-uri explicit
  is_bundle?: boolean 
  channels: {
    emag: { active: boolean; mapped: boolean }
    trendyol: { active: boolean; mapped: boolean }
  }
}

const channelsList = [
  { id: "emag", name: "eMAG", logo: "eM" },
  { id: "trendyol", name: "Trendyol", logo: "TR" },
]

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<string>("all")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])

  // --- FETCH DATA ---
  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("accessToken") || TEMPORARY_USER_TOKEN
      
      const response = await fetch(`${API_BASE_URL}/api/v2/ecommerce/products/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Token ${token}`
        },
      })

      if (!response.ok) throw new Error("Eroare la preluarea produselor")

      const data = await response.json()
      // Suport pentru paginare Django (results) sau listă directă
      const results = Array.isArray(data) ? data : data.results || []
      
      // Mapare pentru a se potrivi cu interfața ProductData
      const mappedProducts: ProductData[] = results.map((item: any) => ({
        id: item.id,
        sku: item.sku,
        product_name: item.product_title || 'Nume indisponibil',
        brand: item.brand || 'Brand indisponibil',
        stock: item.stock,
        price: item.price,
        is_bundle: item.is_bundle,
        channels: (item.listings || []).reduce((acc: any, listing: any) => {
            const channelName = listing.channel?.toLowerCase();
            if (channelName && (channelName === 'emag' || channelName === 'trendyol')) {
                acc[channelName] = { active: listing.is_active, mapped: true };
            }
            return acc;
        }, { emag: { active: false, mapped: false }, trendyol: { active: false, mapped: false } })
      }));
      setProducts(mappedProducts)
      
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // --- FILTRARE ---
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      (product.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesChannel =
      selectedChannel === "all" || 
      // @ts-ignore - Acces dinamic sigur
      product.channels?.[selectedChannel]?.mapped

    return matchesSearch && matchesChannel
  })

  // --- SELECȚIE ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedProducts(filteredProducts.map((p) => p.id))
    else setSelectedProducts([])
  }

  const handleSelectProduct = (productId: number, checked: boolean) => {
    if (checked) setSelectedProducts([...selectedProducts, productId])
    else setSelectedProducts(selectedProducts.filter((id) => id !== productId))
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
                  <BreadcrumbPage>Produse</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Produse</h1>
              <p className="text-muted-foreground">
                Gestionați catalogul de produse și maparea pe canale
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchProducts} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizare Depozit
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adăugați Produs
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Catalog Produse</CardTitle>
              <CardDescription>
                Vizualizați {products.length} produse din depozitul PIM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Căutați după nume sau SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrare pe canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate Canalurile</SelectItem>
                    {channelsList.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedProducts.length === filteredProducts.length &&
                            filteredProducts.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>TIP</TableHead>
                      <TableHead>SKU LOCAL</TableHead>
                      <TableHead>NUME PRODUS</TableHead>
                      <TableHead>STOC</TableHead>
                      <TableHead>PREȚ BAZĂ</TableHead>
                      <TableHead>CANALE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          <span className="sr-only">Se încarcă...</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`/products/${product.id}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={(checked) =>
                                handleSelectProduct(product.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell>
                             {/* Detecție simplă Bundle după SKU sau flag */}
                             {(product.sku.startsWith("SET") || product.sku.startsWith("BUNDLE") || product.is_bundle) ? (
                                <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200">
                                    <Layers className="h-3 w-3"/> Bundle
                                </Badge>
                             ) : (
                                <Badge variant="outline" className="gap-1 text-muted-foreground border-dashed">
                                    <Package className="h-3 w-3"/> Produs
                                </Badge>
                             )}
                          </TableCell>
                          <TableCell className="font-mono font-medium text-xs">
                            {product.sku}
                          </TableCell>
                          <TableCell className="font-medium max-w-[300px] truncate" title={product.product_name}>
                            {/* Link către pagina de editare */}
                            <Link href={`/products/${product.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline text-primary">
                                {product.product_name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{product.brand}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={product.stock > 0 ? "default" : "destructive"}
                              className={
                                product.stock > 0
                                  ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
                                  : ""
                              }
                            >
                              {product.stock} buc
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {parseFloat(product.price).toFixed(2)} Lei
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {channelsList.map((channel) => {
                                // @ts-ignore
                                const channelData = product.channels?.[channel.id]
                                return (
                                  <div
                                    key={channel.id}
                                    className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium border transition-colors ${
                                      channelData?.active
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : channelData?.mapped 
                                            ? "bg-blue-50 text-blue-600 border-blue-200"
                                            : "bg-muted text-muted-foreground border-border opacity-50"
                                    }`}
                                    title={`${channel.name} - ${
                                      channelData?.active ? "Activ" : channelData?.mapped ? "Mapat (Inactiv)" : "Nemapata"
                                    }`}
                                  >
                                    {channel.logo}
                                  </div>
                                )
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {!isLoading && filteredProducts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">Nu am găsit produse.</p>
                  <p className="text-sm">Încercați să încărcați o factură sau să schimbați filtrele.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </>
  )
}