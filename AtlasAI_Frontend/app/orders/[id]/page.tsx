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
import { ArrowLeft, FileText, Truck, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"

// Mock order data
const mockOrderDetails = {
  id: "CMD-001",
  channel: "emag",
  channelName: "eMAG",
  channelLogo: "eM",
  date: new Date("2024-01-15T10:30:00"),
  status: "new",
  total: 98.5,
  customer: {
    name: "Andrei Ionescu",
    email: "andrei.ionescu@email.com",
    phone: "+40 123 456 789",
  },
  shippingAddress: {
    street: "Strada Victoriei 123",
    city: "București",
    postalCode: "010065",
    country: "România",
  },
  billingAddress: {
    street: "Strada Victoriei 123",
    city: "București",
    postalCode: "010065",
    country: "România",
  },
  items: [
    {
      sku: "CHT-001",
      name: "Detergent Chanteclair Bicarbonat 600ml",
      quantity: 1,
      unitPrice: 24.99,
      subtotal: 24.99,
    },
    {
      sku: "CHT-005",
      name: "Degresant vase Chanteclair cu rodie 500ml",
      quantity: 2,
      unitPrice: 13.25,
      subtotal: 26.5,
    },
    {
      sku: "CHT-003",
      name: "Balsam rufe albe Chanteclair 1800ml",
      quantity: 1,
      unitPrice: 22.75,
      subtotal: 22.75,
    },
  ],
  subtotal: 74.24,
  shipping: 15.99,
  tax: 8.27,
}

const statusConfig = {
  new: { label: "Nou", variant: "default" as const, color: "bg-blue-100 text-blue-800" },
  processing: { label: "În Procesare", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Finalizat", variant: "default" as const, color: "bg-green-100 text-green-800" },
  canceled: { label: "Anulat", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
}

export default function OrderDetailsPage() {
  const params = useParams()
  const order = mockOrderDetails

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/orders">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Înapoi la Comenzi
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Detalii Comandă</h1>
                <p className="text-muted-foreground">Vizualizați și gestionați informații comandă</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Rezumat Comandă</CardTitle>
                <CardDescription>Informații de bază despre comandă</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ID Comandă:</span>
                  <span className="font-mono">{order.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sursă:</span>
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded text-xs font-medium bg-primary text-primary-foreground">
                      {order.channelLogo}
                    </div>
                    <span>{order.channelName}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data:</span>
                  <div className="text-right">
                    <div>{format(order.date, "MMM dd, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">{format(order.date, "HH:mm")}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge
                    variant={statusConfig[order.status as keyof typeof statusConfig].variant}
                    className={statusConfig[order.status as keyof typeof statusConfig].color}
                  >
                    {statusConfig[order.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Suma Totală:</span>
                  <span className="text-lg font-bold">{order.total.toFixed(2)} Lei</span>
                </div>
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detalii Client</CardTitle>
                <CardDescription>Informații client și contact</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium">Nume Client:</span>
                  <div className="mt-1">{order.customer.name}</div>
                </div>
                <div>
                  <span className="text-sm font-medium">Email:</span>
                  <div className="mt-1">{order.customer.email}</div>
                </div>
                <div>
                  <span className="text-sm font-medium">Telefon:</span>
                  <div className="mt-1">{order.customer.phone}</div>
                </div>
                <div>
                  <span className="text-sm font-medium">Adresă Livrare:</span>
                  <div className="mt-1 text-sm">
                    {order.shippingAddress.street}
                    <br />
                    {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                    <br />
                    {order.shippingAddress.country}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Adresă Facturare:</span>
                  <div className="mt-1 text-sm">
                    {order.billingAddress.street}
                    <br />
                    {order.billingAddress.city}, {order.billingAddress.postalCode}
                    <br />
                    {order.billingAddress.country}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle>Articole Comandă</CardTitle>
              <CardDescription>Produsele incluse în această comandă</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>NUME PRODUS</TableHead>
                      <TableHead>CANTITATE</TableHead>
                      <TableHead>PREȚ UNITAR</TableHead>
                      <TableHead>SUBTOTAL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unitPrice.toFixed(2)} Lei</TableCell>
                        <TableCell className="font-medium">{item.subtotal.toFixed(2)} Lei</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{order.subtotal.toFixed(2)} Lei</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport:</span>
                  <span>{order.shipping.toFixed(2)} Lei</span>
                </div>
                <div className="flex justify-between">
                  <span>Impozit:</span>
                  <span>{order.tax.toFixed(2)} Lei</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{order.total.toFixed(2)} Lei</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acțiuni Comandă</CardTitle>
              <CardDescription>Acțiuni disponibile pentru această comandă</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Generare Factură
                </Button>
                <Button variant="outline">
                  <Truck className="h-4 w-4 mr-2" />
                  Creare AWB
                </Button>
                <Button variant="outline">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcare Finalizat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </>
  )
}
