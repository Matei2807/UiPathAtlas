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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Save, Settings, Bell, Users, Key } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

const channels = [
  { id: "emag", name: "eMAG", logo: "eM", connected: true },
  { id: "woocommerce", name: "WooCommerce", logo: "WC", connected: true },
  { id: "trendyol", name: "Trendyol", logo: "TR", connected: true },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    notifications: {
      newOrders: true,
      lowStock: true,
      priceChanges: false,
      systemUpdates: true,
    },
    general: {
      companyName: "Afacerea Mea E-commerce",
      defaultCurrency: "RON",
      timezone: "Europe/Bucharest",
      language: "ro",
    },
    channels: {
      emag: { globalPriceRule: { type: "percentage", value: 40 } },
      woocommerce: { globalPriceRule: { type: "percentage", value: 35 } },
      trendyol: { globalPriceRule: { type: "fixed", value: 25 } },
    },
  })

  const handleSave = (section: string) => {
    toast({
      title: "Setări salvate",
      description: `Setările ${section} au fost actualizate cu succes.`,
    })
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
                  <BreadcrumbPage>Setări</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Setări</h1>
              <p className="text-muted-foreground">Gestionați configurația și preferințele platformei</p>
            </div>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Generale
              </TabsTrigger>
              <TabsTrigger value="channels" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Canale
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificări
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Utilizatori
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Setări Generale</CardTitle>
                  <CardDescription>Configurația de bază a platformei</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nume Companie</Label>
                      <Input
                        id="companyName"
                        value={settings.general.companyName}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            general: { ...prev.general, companyName: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Monedă Implicită</Label>
                      <Select
                        value={settings.general.defaultCurrency}
                        onValueChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            general: { ...prev.general, defaultCurrency: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RON">RON (Lei)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Fus Orar</Label>
                      <Select
                        value={settings.general.timezone}
                        onValueChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            general: { ...prev.general, timezone: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Europe/Bucharest">Europe/Bucharest</SelectItem>
                          <SelectItem value="Europe/London">Europe/London</SelectItem>
                          <SelectItem value="America/New_York">America/New_York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Limbă</Label>
                      <Select
                        value={settings.general.language}
                        onValueChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            general: { ...prev.general, language: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ro">Română</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={() => handleSave("Generale")} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Salvare Setări Generale
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="channels" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurarea Canalelor</CardTitle>
                  <CardDescription>Gestionați conexiunile piețelor și regulile de preț globale</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {channels.map((channel) => (
                    <div key={channel.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded text-sm font-medium border ${
                              channel.connected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {channel.logo}
                          </div>
                          <div>
                            <h3 className="font-medium">{channel.name}</h3>
                            <p className="text-sm text-muted-foreground">Integrare piață</p>
                          </div>
                        </div>
                        <Badge variant={channel.connected ? "default" : "secondary"}>
                          {channel.connected ? "Conectat" : "Deconectat"}
                        </Badge>
                      </div>
                      {channel.connected && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tip Regulă Preț Global</Label>
                            <Select
                              value={
                                settings.channels[channel.id as keyof typeof settings.channels].globalPriceRule.type
                              }
                              onValueChange={(value) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  channels: {
                                    ...prev.channels,
                                    [channel.id]: {
                                      ...prev.channels[channel.id as keyof typeof prev.channels],
                                      globalPriceRule: {
                                        ...prev.channels[channel.id as keyof typeof prev.channels].globalPriceRule,
                                        type: value,
                                      },
                                    },
                                  },
                                }))
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
                          </div>
                          <div className="space-y-2">
                            <Label>Valoare</Label>
                            <Input
                              type="number"
                              value={
                                settings.channels[channel.id as keyof typeof settings.channels].globalPriceRule.value
                              }
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  channels: {
                                    ...prev.channels,
                                    [channel.id]: {
                                      ...prev.channels[channel.id as keyof typeof prev.channels],
                                      globalPriceRule: {
                                        ...prev.channels[channel.id as keyof typeof prev.channels].globalPriceRule,
                                        value: Number.parseFloat(e.target.value),
                                      },
                                    },
                                  },
                                }))
                              }
                              placeholder={
                                settings.channels[channel.id as keyof typeof settings.channels].globalPriceRule.type ===
                                "percentage"
                                  ? "%"
                                  : "Lei"
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button onClick={() => handleSave("Canale")} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Salvare Setări Canale
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferințe Notificări</CardTitle>
                  <CardDescription>Configurați când și cum primiți notificări</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Comenzi Noi</Label>
                      <p className="text-sm text-muted-foreground">Primiți notificare pentru comenzi noi</p>
                    </div>
                    <Switch
                      checked={settings.notifications.newOrders}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifications: { ...prev.notifications, newOrders: checked },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Alerte Stoc Scăzut</Label>
                      <p className="text-sm text-muted-foreground">
                        Primiți notificare când produsele sunt pe sfârșite
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.lowStock}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifications: { ...prev.notifications, lowStock: checked },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Modificări Preț</Label>
                      <p className="text-sm text-muted-foreground">
                        Primiți notificare când se schimbă prețurile piețelor
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.priceChanges}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifications: { ...prev.notifications, priceChanges: checked },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Actualizări Sistem</Label>
                      <p className="text-sm text-muted-foreground">
                        Primiți notificare despre actualizări și întreținere
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications.systemUpdates}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifications: { ...prev.notifications, systemUpdates: checked },
                        }))
                      }
                    />
                  </div>
                  <Button onClick={() => handleSave("Notificări")} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Salvare Preferințe Notificări
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gestionarea Utilizatorilor</CardTitle>
                  <CardDescription>Gestionați membrii echipei și permisiunile acestora</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Gestionarea Utilizatorilor - În Curând</h3>
                    <p>Funcționalități de colaborare în echipă vor fi disponibile într-o actualizare viitoare.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </>
  )
}
