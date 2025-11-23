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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, FileText, Truck, CheckCircle, Package, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { useState, useEffect } from "react"
import { toast } from "sonner" // Optional: pentru notificari, sau foloseste alert simplu

// --- CONFIGURARE API ---
const API_BASE_URL = "http://localhost:8000/api/v2/ecommerce"
// Folosim token-ul din contextul anterior (sau din env in mod ideal)
const TEMPORARY_USER_TOKEN = "98f91c94d678d96df72f2ff5f04683b18c5dc0c3"

// --- INTERFEȚE UI ---
interface OrderItem {
  sku: string
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

interface OrderDetail {
  id: string // ID-ul intern sau platform number
  dbId: number // ID-ul de baza de date (pentru apeluri API)
  channel: string
  channelName: string
  channelLogo: string
  date: Date
  status: "new" | "processing" | "completed" | "canceled"
  total: number
  subtotal: number
  shipping: number
  tax: number
  currency: string
  customer: {
    name: string
    email: string
    phone: string
  }
  shippingAddress: {
    fullAddress: string
    city: string
    country: string
  }
  billingAddress: {
    fullAddress: string
    city: string
    country: string
  }
  items: OrderItem[]
}

// --- LOGICA DE MAPARE (Backend -> Frontend Detail) ---
const mapBackendToDetail = (data: any): OrderDetail => {
  // 1. Status Mapping
  let mappedStatus: OrderDetail['status'] = 'new';
  const s = data.status?.toLowerCase() || '';
  if (['created', 'pending', 'new', 'waiting'].includes(s)) mappedStatus = 'new';
  else if (['picking', 'invoiced', 'processing', 'shipped'].includes(s)) mappedStatus = 'processing';
  else if (['delivered', 'completed'].includes(s)) mappedStatus = 'completed';
  else if (['cancelled', 'canceled', 'returned'].includes(s)) mappedStatus = 'canceled';

  // 2. Platform Info
  const pName = (data.platform_account?.name || data.platform_name || '').toLowerCase();
  let logo = "??";
  let name = data.platform_account?.name || "Unknown Platform";
  if (pName.includes('trendyol')) { logo = "TR"; name = "Trendyol"; }
  else if (pName.includes('emag')) { logo = "eM"; name = "eMAG"; }
  else if (pName.includes('woo')) { logo = "WC"; name = "WooCommerce"; }

  // 3. Address Parsing (Backend sends JSON usually)
  // Trendyol/Emag JSON structure varies, so we try to extract common fields safely
  const ship = data.shipping_address || {};
  const bill = data.invoice_address || {};

  const formatAddress = (addr: any) => {
    // Incearca diverse chei posibile din JSON-ul platformei
    const street = addr.address1 || addr.addressLine1 || addr.fullAddress || addr.address || "-";
    const city = addr.city || addr.town || "-";
    const country = addr.countryCode || addr.country || "-";
    return { fullAddress: street, city, country };
  };

  const shippingAddr = formatAddress(ship);
  const billingAddr = formatAddress(bill);

  // 4. Items Mapping
  const items: OrderItem[] = (data.items || []).map((item: any) => ({
    sku: item.sku || "N/A",
    name: item.product_name || "Produs necunoscut",
    quantity: item.quantity || 0,
    unitPrice: parseFloat(item.price || "0"),
    subtotal: (item.quantity || 0) * parseFloat(item.price || "0")
  }));

  // 5. Totals Calculation
  const total = parseFloat(data.total_price || "0");
  // Daca backendul nu trimite subtotal/tax separat, le estimam din iteme
  const calculatedSubtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
  const estimatedShipping = total - calculatedSubtotal > 0 ? total - calculatedSubtotal : 0; 

  return {
    id: data.platform_order_number || data.id?.toString(),
    dbId: data.id, // ID-ul necesar pentru actiuni API (/orders/{id}/...)
    channel: name.toLowerCase(),
    channelName: name,
    channelLogo: logo,
    date: new Date(data.order_date || data.created_at || new Date()),
    status: mappedStatus,
    total: total,
    subtotal: calculatedSubtotal,
    shipping: estimatedShipping, // Sau data.shipping_total daca exista in API
    tax: 0, // Sau data.tax_total daca exista
    currency: data.currency || "RON",
    customer: {
      name: `${data.customer_first_name || ''} ${data.customer_last_name || ''}`.trim() || "Client Necunoscut",
      email: data.customer_email || "-",
      phone: ship.phone || ship.phoneNumber || "-"
    },
    shippingAddress: shippingAddr,
    billingAddress: billingAddr,
    items: items
  };
}

const statusConfig = {
  new: { label: "Nou", variant: "default" as const, color: "bg-blue-100 text-blue-800" },
  processing: { label: "În Procesare", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Finalizat", variant: "default" as const, color: "bg-green-100 text-green-800" },
  canceled: { label: "Anulat", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
}

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string // Acesta trebuie sa fie ID-ul din baza de date (PK)

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- FETCH ORDER DETAILS ---
  const fetchOrderDetails = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Endpoint: GET /api/v2/ecommerce/orders/{id}/
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${TEMPORARY_USER_TOKEN}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) throw new Error("Comanda nu a fost găsită. Verifică dacă ID-ul este corect.")
        throw new Error(`Eroare server: ${response.status}`)
      }

      const data = await response.json()
      const mappedData = mapBackendToDetail(data)
      setOrder(mappedData)

    } catch (err: any) {
      console.error("Fetch detail error:", err)
      setError(err.message || "Eroare la încărcarea comenzii.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  // --- ACTIONS (Mark Picking, Invoice, etc) ---
  const handleOrderAction = async (action: 'mark_picking' | 'mark_invoiced') => {
    if (!order) return;
    setActionLoading(true)
    
    try {
      // Exemplu de body, pentru facturare poate fi nevoie de invoice number
      const body = action === 'mark_invoiced' ? { invoice_number: `INV-${order.id}` } : {};

      const response = await fetch(`${API_BASE_URL}/orders/${order.dbId}/${action}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${TEMPORARY_USER_TOKEN}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error("Acțiunea a eșuat.")
      
      // Reîncărcăm comanda pentru a vedea noul status
      await fetchOrderDetails()
      alert("Status actualizat cu succes!") // Sau foloseste un toast

    } catch (err: any) {
      alert(`Eroare: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // --- RENDERING ---

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Se încarcă detaliile...</span>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-semibold">Nu am putut încărca comanda</h2>
        <p className="text-muted-foreground">{error}</p>
        <Link href="/orders">
          <Button variant="outline">Înapoi la Listă</Button>
        </Link>
      </div>
    )
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
                  <BreadcrumbLink href="/orders">Comenzi</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{order.id}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          
          {/* Header Zona Titlu */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/orders">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Înapoi
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Comanda #{order.id}</h1>
                <p className="text-muted-foreground">
                   Plasată pe {format(order.date, "dd MMM yyyy, HH:mm")} prin {order.channelName}
                </p>
              </div>
            </div>
            
            {/* Status Badge Mare */}
            <div className="flex items-center gap-2">
                 Status curent: 
                 <Badge
                    variant={statusConfig[order.status].variant}
                    className={`${statusConfig[order.status].color} text-base px-4 py-1`}
                  >
                    {statusConfig[order.status].label}
                  </Badge>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            
            {/* Column 1: Order Info & Items (Spans 2 cols on LG) */}
            <div className="md:col-span-2 space-y-6">
                
                {/* Products Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Articole Comandă</CardTitle>
                    <CardDescription>{order.items.length} produse în coș</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>NUME PRODUS</TableHead>
                            <TableHead className="text-right">CANT.</TableHead>
                            <TableHead className="text-right">PREȚ</TableHead>
                            <TableHead className="text-right">TOTAL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                              <TableCell className="font-medium text-sm">{item.name}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{item.unitPrice.toFixed(2)} {order.currency}</TableCell>
                              <TableCell className="text-right font-bold">{item.subtotal.toFixed(2)} {order.currency}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Totals Section */}
                    <div className="mt-6 flex flex-col items-end gap-2 text-sm">
                      <div className="flex justify-between w-full max-w-[250px]">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{order.subtotal.toFixed(2)} {order.currency}</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[250px]">
                        <span className="text-muted-foreground">Transport:</span>
                        <span>{order.shipping.toFixed(2)} {order.currency}</span>
                      </div>
                      <Separator className="my-2 max-w-[250px]" />
                      <div className="flex justify-between w-full max-w-[250px] font-bold text-lg">
                        <span>Total:</span>
                        <span>{order.total.toFixed(2)} {order.currency}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Procesare Comandă</CardTitle>
                    <CardDescription>Acțiuni disponibile pentru schimbarea statusului în platformă.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        onClick={() => handleOrderAction('mark_picking')} 
                        disabled={actionLoading || order.status !== 'new'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Package className="h-4 w-4 mr-2" />}
                        Marchează "În Pregătire"
                      </Button>

                      <Button 
                        onClick={() => handleOrderAction('mark_invoiced')}
                        disabled={actionLoading || order.status === 'completed'}
                        variant="outline"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <FileText className="h-4 w-4 mr-2" />}
                        Generează Factură & AWB
                      </Button>

                      <Button disabled variant="secondary">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Finalizează Comandă (Auto)
                      </Button>
                    </div>
                    {order.status !== 'new' && (
                        <p className="text-xs text-muted-foreground mt-2">
                            * Unele acțiuni sunt dezactivate deoarece comanda este deja în procesare sau finalizată.
                        </p>
                    )}
                  </CardContent>
                </Card>
            </div>

            {/* Column 2: Customer & Shipping Info */}
            <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detalii Client</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Nume</span>
                      <div className="font-medium">{order.customer.name}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Email</span>
                      <div className="text-sm truncate" title={order.customer.email}>{order.customer.email}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Telefon</span>
                      <div className="text-sm">{order.customer.phone}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Livrare & Facturare</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Adresă Livrare</span>
                      </div>
                      <div className="text-sm text-muted-foreground ml-6">
                        <p>{order.shippingAddress.fullAddress}</p>
                        <p>{order.shippingAddress.city}, {order.shippingAddress.country}</p>
                      </div>
                    </div>
                    
                    <Separator />

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Adresă Facturare</span>
                      </div>
                      <div className="text-sm text-muted-foreground ml-6">
                        <p>{order.billingAddress.fullAddress}</p>
                        <p>{order.billingAddress.city}, {order.billingAddress.country}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            </div>

          </div>
        </div>
      </SidebarInset>
    </>
  )
}