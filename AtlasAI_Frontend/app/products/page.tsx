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
import { Search, RefreshCw, Plus } from "lucide-react"
import { useState } from "react"

const mockProducts = [
  {
    id: "1",
    sku: "CHT-001",
    name: "Detergent Chanteclair Bicarbonat, 600 ml",
    stock: 45,
    basePrice: 24.99,
    channels: {
      emag: { active: true, mapped: true },
      woocommerce: { active: true, mapped: true },
      trendyol: { active: true, mapped: true },
    },
  },
  {
    id: "2",
    sku: "CHT-002",
    name: "Degresant Chanteclair Color, 1575 ml",
    stock: 32,
    basePrice: 18.5,
    channels: {
      emag: { active: true, mapped: true },
      woocommerce: { active: false, mapped: false },
      trendyol: { active: true, mapped: true },
    },
  },
  {
    id: "3",
    sku: "CHT-003",
    name: "Balsam rufe albe Chanteclair, 1800 ml",
    stock: 67,
    basePrice: 22.75,
    channels: {
      emag: { active: true, mapped: true },
      woocommerce: { active: true, mapped: true },
      trendyol: { active: true, mapped: true },
    },
  },
  {
    id: "4",
    sku: "CHT-004",
    name: "Detergent pardoseli Chanteclair Mosc alb, 750 ml",
    stock: 23,
    basePrice: 15.99,
    channels: {
      emag: { active: false, mapped: false },
      woocommerce: { active: true, mapped: true },
      trendyol: { active: true, mapped: true },
    },
  },
  {
    id: "5",
    sku: "CHT-005",
    name: "Degresant vase Chanteclair, cu rodie, 500 ml",
    stock: 78,
    basePrice: 13.25,
    channels: {
      emag: { active: true, mapped: true },
      woocommerce: { active: true, mapped: true },
      trendyol: { active: false, mapped: false },
    },
  },
]

const channels = [
  { id: "emag", name: "eMAG", logo: "eM" },
  { id: "woocommerce", name: "WooCommerce", logo: "WC" },
  { id: "trendyol", name: "Trendyol", logo: "TR" },
]

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<string>("all")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesChannel =
      selectedChannel === "all" || product.channels[selectedChannel as keyof typeof product.channels]?.active

    return matchesSearch && matchesChannel
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map((p) => p.id))
    } else {
      setSelectedProducts([])
    }
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId])
    } else {
      setSelectedProducts(selectedProducts.filter((id) => id !== productId))
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
              <p className="text-muted-foreground">Gestionați catalogul de produse și maparea pe canale</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
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
              <CardDescription>Vizualizați și gestionați produsele din toate canalurile de vânzare</CardDescription>
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
                    {channels.map((channel) => (
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
                          checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>SKU LOCAL</TableHead>
                      <TableHead>NUME PRODUS</TableHead>
                      <TableHead>STOC</TableHead>
                      <TableHead>PREȚ BAZĂ</TableHead>
                      <TableHead>CANALE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => (window.location.href = `/products/${product.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-medium">{product.sku}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={product.stock > 0 ? "default" : "destructive"}
                            className={product.stock > 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                          >
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{product.basePrice.toFixed(2)} Lei</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {channels.map((channel) => {
                              const channelData = product.channels[channel.id as keyof typeof product.channels]
                              return (
                                <div
                                  key={channel.id}
                                  className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium border ${
                                    channelData?.active
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted text-muted-foreground border-border"
                                  }`}
                                  title={`${channel.name} - ${channelData?.active ? "Activ" : "Inactiv"}`}
                                >
                                  {channel.logo}
                                </div>
                              )
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nu au fost găsite produse care să corespundă criteriilor.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </>
  )
}
