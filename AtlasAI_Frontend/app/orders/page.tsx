"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, CalendarIcon, Loader2, RefreshCcw } from "lucide-react"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"

const API_BASE_URL = "http://localhost:8000/api/v2/ecommerce" 
const TEMPORARY_USER_TOKEN = "c8b8415c0a6634cf446a7b319750380beeea07b6" 

// --- INTERFETE ---
export interface Order {
  id: string       // ID-ul vizual (ex: 107...)
  dbId: number     // ID-ul real din baza de date (pentru link)
  channel: string      
  channelName: string  
  channelLogo: string  
  customer: string
  customerEmail: string
  date: Date
  total: number
  status: "new" | "processing" | "completed" | "canceled"
}

// --- LOGICA DE MAPARE ---
const mapBackendToFrontend = (backendData: any): Order => {
  let mappedStatus: Order['status'] = 'new';
  const s = backendData.status?.toLowerCase() || '';
  
  if (['created', 'pending', 'new', 'waiting'].includes(s)) mappedStatus = 'new';
  else if (['picking', 'invoiced', 'processing', 'shipped'].includes(s)) mappedStatus = 'processing';
  else if (['delivered', 'completed'].includes(s)) mappedStatus = 'completed';
  else if (['cancelled', 'canceled', 'returned'].includes(s)) mappedStatus = 'canceled';

  // --- LOGICA NOUA PENTRU SURSA ---
  const orderNum = String(backendData.platform_order_number || "");
  
  // Default eMAG
  let logo = "eM"; 
  let name = "eMAG"; 
  let channelKey = "emag";

  // REGULA NOUA: Daca incepe cu "10" SI are 11 cifre -> Trendyol
  if (orderNum.startsWith("10") && orderNum.length === 11) {
      logo = "TR";
      name = "Trendyol";
      channelKey = "trendyol";
  } 
  // Pastram logica pentru WooCommerce daca e cazul
  else if (backendData.platform_account?.platform === 'woocommerce') {
      logo = "WC";
      name = "WooCommerce";
      channelKey = "woocommerce";
  }
  // Orice altceva ramane eMAG (Default setat mai sus)

  const firstName = backendData.customer_first_name || "";
  const lastName = backendData.customer_last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || "Client";

  const rawDate = backendData.order_date || backendData.created_at;
  const parsedDate = rawDate ? new Date(rawDate) : new Date();

  return {
    id: orderNum || backendData.id?.toString() || "-", 
    dbId: backendData.id,
    
    channel: channelKey,
    channelName: name,
    channelLogo: logo,
    
    customer: fullName,
    customerEmail: backendData.customer_email || "-",
    
    date: parsedDate, 
    total: parseFloat(backendData.total_price || "0"),
    
    status: mappedStatus
  };
}

const statusConfig = {
  new: { label: "Nou", variant: "default" as const, color: "bg-blue-100 text-blue-800" },
  processing: { label: "În Procesare", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Finalizat", variant: "default" as const, color: "bg-green-100 text-green-800" },
  canceled: { label: "Anulat", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
}

const channels = [
  { id: "emag", name: "eMAG", logo: "eM" },
  { id: "woocommerce", name: "WooCommerce", logo: "WC" },
  { id: "trendyol", name: "Trendyol", logo: "TR" },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const fetchOrders = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/orders/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${TEMPORARY_USER_TOKEN}`
        }
      })
      
      if (response.status === 401) throw new Error('Autentificare eșuată.')
      if (!response.ok) throw new Error(`Eroare server: ${response.status}`)

      const data = await response.json()
      const rawList = Array.isArray(data) ? data : (data.results || [])
      const processedOrders = rawList.map(mapBackendToFrontend)

      setOrders(processedOrders)
    } catch (err: any) {
      console.error("Fetch error:", err)
      setError(err.message || "Nu am putut încărca comenzile.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 60000)
    return () => clearInterval(interval)
  }, [])

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = activeTab === "all" || order.status === activeTab
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesChannel = selectedChannel === "all" || order.channel === selectedChannel

    let matchesDate = true
    if (dateRange?.from && dateRange?.to) {
      const orderDate = order.date
      matchesDate = orderDate >= dateRange.from && orderDate <= dateRange.to
    }
    return matchesStatus && matchesSearch && matchesChannel && matchesDate
  })

  const statusCounts = {
    all: orders.length,
    new: orders.filter((o) => o.status === "new").length,
    processing: orders.filter((o) => o.status === "processing").length,
    completed: orders.filter((o) => o.status === "completed").length,
    canceled: orders.filter((o) => o.status === "canceled").length,
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
                  <BreadcrumbPage>Comenzi</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Comenzi</h1>
              <p className="text-muted-foreground">Gestionați comenzile din toate canalurile de vânzare</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizare
            </Button>
          </div>
          
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md border border-destructive/20">
              <strong>Eroare:</strong> {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Gestionarea Comenzilor</CardTitle>
              <CardDescription>Sincronizare automată cu platformele conectate.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all">Toate <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge></TabsTrigger>
                  <TabsTrigger value="new">Noi <Badge variant="secondary" className="ml-1">{statusCounts.new}</Badge></TabsTrigger>
                  <TabsTrigger value="processing">Procesare <Badge variant="secondary" className="ml-1">{statusCounts.processing}</Badge></TabsTrigger>
                  <TabsTrigger value="completed">Finalizate <Badge variant="secondary" className="ml-1">{statusCounts.completed}</Badge></TabsTrigger>
                  <TabsTrigger value="canceled">Anulate <Badge variant="secondary" className="ml-1">{statusCounts.canceled}</Badge></TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-4 my-6">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Căutați ID sau client..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-48 justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? <>{format(dateRange.from, "dd.MM")} - {format(dateRange.to, "dd.MM")}</> : format(dateRange.from, "dd.MM.yyyy")
                        ) : <span>Interval date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                    </PopoverContent>
                  </Popover>
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Canal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toate</SelectItem>
                      {channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <TabsContent value={activeTab} className="mt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID COMANDĂ</TableHead>
                          <TableHead>SURSĂ</TableHead>
                          <TableHead>CLIENT</TableHead>
                          <TableHead>DATA</TableHead>
                          <TableHead>TOTAL</TableHead>
                          <TableHead>STATUS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading && filteredOrders.length === 0 ? (
                           <TableRow>
                             <TableCell colSpan={6} className="h-24 text-center">
                               <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                 <Loader2 className="h-5 w-5 animate-spin" /> Se încarcă...
                               </div>
                             </TableCell>
                           </TableRow>
                        ) : filteredOrders.length > 0 ? (
                          filteredOrders.map((order) => (
                            <TableRow 
                                key={order.dbId} 
                                className="cursor-pointer hover:bg-muted/50" 
                                onClick={() => window.location.href = `/orders/${order.dbId}`}
                            >
                              <TableCell className="font-mono font-medium">{order.id}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded text-xs font-medium bg-primary text-primary-foreground">
                                    {order.channelLogo}
                                  </div>
                                  <span className="text-sm hidden lg:inline">{order.channelName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{order.customer}</div>
                                  <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>{format(order.date, "dd MMM yyyy")}</div>
                                  <div className="text-xs text-muted-foreground">{format(order.date, "HH:mm")}</div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{order.total.toFixed(2)} Lei</TableCell>
                              <TableCell>
                                <Badge variant={statusConfig[order.status].variant} className={statusConfig[order.status].color}>
                                  {statusConfig[order.status].label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                             <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                Nu am găsit comenzi.
                             </TableCell>
                           </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </>
  )
}