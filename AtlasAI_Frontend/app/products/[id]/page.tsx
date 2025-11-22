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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Save, ArrowLeft } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

const mockProduct = {
  id: "1",
  sku: "CHT-001",
  name: "Detergent Chanteclair Bicarbonat, 600 ml",
  description:
    "Detergent universal de înaltă calitate cu bicarbonat, perfect pentru îngrijirea rufelor. Acțiune puternică de curățare și îndepărtare a petelor.",
  basePrice: 24.99,
  stock: 45,
  channels: {
    emag: {
      active: true,
      marketplaceId: "EMAG-12345",
      overrideGlobalRule: false,
      priceRule: { type: "percentage", value: 40 },
    },
    woocommerce: {
      active: true,
      marketplaceId: "WC-67890",
      overrideGlobalRule: true,
      priceRule: { type: "fixed", value: 25 },
    },
    trendyol: {
      active: true,
      marketplaceId: "TR-54321",
      overrideGlobalRule: false,
      priceRule: { type: "percentage", value: 45 },
    },
  },
}

const channels = [
  { id: "emag", name: "eMAG", logo: "eM" },
  { id: "woocommerce", name: "WooCommerce", logo: "WC" },
  { id: "trendyol", name: "Trendyol", logo: "TR" },
]

export default function ProductEditPage() {
  const params = useParams()
  const [product, setProduct] = useState(mockProduct)

  const updateChannelSetting = (channelId: string, field: string, value: any) => {
    setProduct((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channelId]: {
          ...prev.channels[channelId as keyof typeof prev.channels],
          [field]: value,
        },
      },
    }))
  }

  const calculateChannelPrice = (channelId: string) => {
    const channel = product.channels[channelId as keyof typeof product.channels]
    if (channel.priceRule.type === "percentage") {
      return product.basePrice * (1 + channel.priceRule.value / 100)
    } else {
      return product.basePrice + channel.priceRule.value
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
                  <BreadcrumbLink href="/products">Produse</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{product.sku}</BreadcrumbPage>
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
                  Înapoi la Produse
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Editare Produs</h1>
                <p className="text-muted-foreground">Gestionați detaliile produsului și setările canalelor</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Core Product Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informații Produs de Bază</CardTitle>
                <CardDescription>Detalii produs din depozit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU Local</Label>
                  <Input id="sku" value={product.sku} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nume Produs</Label>
                  <Input
                    id="name"
                    value={product.name}
                    onChange={(e) => setProduct((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descriere Produs</Label>
                  <Textarea
                    id="description"
                    value={product.description}
                    onChange={(e) => setProduct((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Preț de Bază (Lei)</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={product.basePrice}
                      onChange={(e) =>
                        setProduct((prev) => ({ ...prev, basePrice: Number.parseFloat(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Cantitate Stoc</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={product.stock}
                      onChange={(e) => setProduct((prev) => ({ ...prev, stock: Number.parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <Button className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Salvare Detalii de Bază
                </Button>
              </CardContent>
            </Card>

            {/* Right Column - Channel Listings & Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Listări pe Canale și Preț</CardTitle>
                <CardDescription>Configurați setările produsului pentru fiecare piață</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {channels.map((channel) => {
                    const channelData = product.channels[channel.id as keyof typeof product.channels]
                    return (
                      <AccordionItem key={channel.id} value={channel.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium border ${
                                channelData.active
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {channel.logo}
                            </div>
                            <span>{channel.name}</span>
                            {channelData.active && (
                              <span className="text-sm text-muted-foreground">
                                {calculateChannelPrice(channel.id).toFixed(2)} Lei
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${channel.id}-active`}
                              checked={channelData.active}
                              onCheckedChange={(checked) => updateChannelSetting(channel.id, "active", checked)}
                            />
                            <Label htmlFor={`${channel.id}-active`}>Activare produs pe {channel.name}</Label>
                          </div>

                          {channelData.active && (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor={`${channel.id}-id`}>ID Produs pe Piață</Label>
                                <Input
                                  id={`${channel.id}-id`}
                                  value={channelData.marketplaceId}
                                  onChange={(e) => updateChannelSetting(channel.id, "marketplaceId", e.target.value)}
                                  placeholder={`Introduceți ID-ul produsului ${channel.name}`}
                                />
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${channel.id}-override`}
                                    checked={channelData.overrideGlobalRule}
                                    onCheckedChange={(checked) =>
                                      updateChannelSetting(channel.id, "overrideGlobalRule", checked)
                                    }
                                  />
                                  <Label htmlFor={`${channel.id}-override`}>
                                    Suprascrieți regula globală de preț canal
                                  </Label>
                                </div>

                                {channelData.overrideGlobalRule && (
                                  <div className="grid grid-cols-2 gap-2 ml-6">
                                    <Select
                                      value={channelData.priceRule.type}
                                      onValueChange={(value) =>
                                        updateChannelSetting(channel.id, "priceRule", {
                                          ...channelData.priceRule,
                                          type: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentage">Adaugă Procent</SelectItem>
                                        <SelectItem value="fixed">Adaugă Sumă Fixă</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      value={channelData.priceRule.value}
                                      onChange={(e) =>
                                        updateChannelSetting(channel.id, "priceRule", {
                                          ...channelData.priceRule,
                                          value: Number.parseFloat(e.target.value),
                                        })
                                      }
                                      placeholder={channelData.priceRule.type === "percentage" ? "%" : "Lei"}
                                    />
                                  </div>
                                )}

                                <div className="text-sm text-muted-foreground">
                                  Preț final: {calculateChannelPrice(channel.id).toFixed(2)} Lei
                                </div>
                              </div>
                            </>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
                <Button className="w-full mt-4">
                  <Save className="h-4 w-4 mr-2" />
                  Salvare Setări Canale
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
