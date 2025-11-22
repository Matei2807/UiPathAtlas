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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, CalendarIcon } from "lucide-react"
import { useState } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"

const mockOrders = [
  {
    id: "CMD-001",
    channel: "emag",
    channelName: "eMAG",
    channelLogo: "eM",
    customer: "Andrei Ionescu",
    customerEmail: "andrei.ionescu@email.com",
    date: new Date("2024-01-15T10:30:00"),
    total: 234.5,
    status: "new",
  },
  {
    id: "CMD-002",
    channel: "woocommerce",
    channelName: "WooCommerce",
    channelLogo: "WC",
    customer: "Cristina Popescu",
    customerEmail: "cristina.popescu@email.com",
    date: new Date("2024-01-15T14:20:00"),
    total: 156.75,
    status: "processing",
  },
  {
    id: "CMD-003",
    channel: "trendyol",
    channelName: "Trendyol",
    channelLogo: "TR",
    customer: "Marian Tascu",
    customerEmail: "marian.tascu@email.com",
    date: new Date("2024-01-14T16:45:00"),
    total: 89.99,
    status: "completed",
  },
  {
    id: "CMD-004",
    channel: "emag",
    channelName: "eMAG",
    channelLogo: "eM",
    customer: "Matei Plesa",
    customerEmail: "matei.plesa@email.com",
    date: new Date("2024-01-14T09:15:00"),
    total: 312.25,
    status: "new",
  },
  {
    id: "CMD-005",
    channel: "woocommerce",
    channelName: "WooCommerce",
    channelLogo: "WC",
    customer: "Daniel Hutu",
    customerEmail: "daniel.hutu@email.com",
    date: new Date("2024-01-13T11:30:00"),
    total: 198.5,
    status: "processing",
  },
  {
    id: "CMD-006",
    channel: "trendyol",
    channelName: "Trendyol",
    channelLogo: "TR",
    customer: "Nicola Andrei",
    customerEmail: "nicola.andrei@email.com",
    date: new Date("2024-01-13T15:20:00"),
    total: 445.8,
    status: "completed",
  },
  {
    id: "CMD-007",
    channel: "emag",
    channelName: "eMAG",
    channelLogo: "eM",
    customer: "Ion Marian",
    customerEmail: "ion.marian@email.com",
    date: new Date("2024-01-12T13:45:00"),
    total: 67.25,
    status: "canceled",
  },
  {
    id: "CMD-008",
    channel: "woocommerce",
    channelName: "WooCommerce",
    channelLogo: "WC",
    customer: "Anca Cristina",
    customerEmail: "anca.cristina@email.com",
    date: new Date("2024-01-12T08:30:00"),
    total: 523.99,
    status: "new",
  },
]

const channels = [
  { id: "emag", name: "eMAG", logo: "eM" },
  { id: "woocommerce", name: "WooCommerce", logo: "WC" },
  { id: "trendyol", name: "Trendyol", logo: "TR" },
]

const statusConfig = {
  new: { label: "Nou", variant: "default" as const, color: "bg-blue-100 text-blue-800" },
  processing: { label: "În Procesare", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Finalizat", variant: "default" as const, color: "bg-green-100 text-green-800" },
  canceled: { label: "Anulat", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  // Filter orders based on current filters
  const filteredOrders = mockOrders.filter((order) => {
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

  // Count orders by status
  const statusCounts = {
    all: mockOrders.length,
    new: mockOrders.filter((o) => o.status === "new").length,
    processing: mockOrders.filter((o) => o.status === "processing").length,
    completed: mockOrders.filter((o) => o.status === "completed").length,
    canceled: mockOrders.filter((o) => o.status === "canceled").length,
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gestionarea Comenzilor</CardTitle>
              <CardDescription>Vizualizați și procesați comenzile din toate piețele</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all" className="flex items-center gap-2">
                    Toate
                    <Badge variant="secondary" className="ml-1">
                      {statusCounts.all}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="new" className="flex items-center gap-2">
                    Noi
                    <Badge variant="secondary" className="ml-1">
                      {statusCounts.new}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="processing" className="flex items-center gap-2">
                    Procesare
                    <Badge variant="secondary" className="ml-1">
                      {statusCounts.processing}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center gap-2">
                    Finalizate
                    <Badge variant="secondary" className="ml-1">
                      {statusCounts.completed}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="canceled" className="flex items-center gap-2">
                    Anulate
                    <Badge variant="secondary" className="ml-1">
                      {statusCounts.canceled}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-4 my-6">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Căutați după ID comandă sau client..."
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
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Selectați interval de date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>

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
                        {filteredOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => (window.location.href = `/orders/${order.id}`)}
                          >
                            <TableCell className="font-mono font-medium">{order.id}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded text-xs font-medium bg-primary text-primary-foreground">
                                  {order.channelLogo}
                                </div>
                                <span className="text-sm">{order.channelName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{order.customer}</div>
                                <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{format(order.date, "MMM dd, yyyy")}</div>
                                <div className="text-sm text-muted-foreground">{format(order.date, "HH:mm")}</div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{order.total.toFixed(2)} Lei</TableCell>
                            <TableCell>
                              <Badge
                                variant={statusConfig[order.status as keyof typeof statusConfig].variant}
                                className={statusConfig[order.status as keyof typeof statusConfig].color}
                              >
                                {statusConfig[order.status as keyof typeof statusConfig].label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {filteredOrders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nu au fost găsite comenzi care să corespundă criteriilor.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </>
  )
}
