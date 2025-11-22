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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Package, ShoppingCart, DollarSign } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

const kpiData = [
  {
    title: "Vânzări Totale",
    value: "45.231,89 Lei",
    change: "+20.1%",
    icon: DollarSign,
    trend: "up",
  },
  {
    title: "Comenzi Noi",
    value: "156",
    change: "+12.5%",
    icon: ShoppingCart,
    trend: "up",
  },
  {
    title: "Produse în Stoc",
    value: "2.847",
    change: "-2.3%",
    icon: Package,
    trend: "down",
  },
]

const salesData = [
  { name: "eMAG", value: 40, color: "#2563eb" }, // Blue
  { name: "Trendyol", value: 35, color: "#f97316" }, // Orange
  { name: "WooCommerce", value: 25, color: "#a855f7" }, // Purple
]

const recentOrders = [
  { id: "CMD-001", channel: "eMAG", customer: "Andrei Ionescu", total: "234,50 Lei", logo: "eM" },
  { id: "CMD-002", channel: "WooCommerce", customer: "Cristina Popescu", total: "156,75 Lei", logo: "WC" },
  { id: "CMD-003", channel: "Trendyol", customer: "Marian Tascu", total: "89,99 Lei", logo: "TR" },
  { id: "CMD-004", channel: "eMAG", customer: "Matei Plesa", total: "312,25 Lei", logo: "eM" },
  { id: "CMD-005", channel: "WooCommerce", customer: "Daniel Hutu", total: "198,50 Lei", logo: "WC" },
]

export default function DashboardPage() {
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
                  <BreadcrumbPage>Prezentare generală</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            {kpiData.map((kpi, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className={`h-3 w-3 ${kpi.trend === "up" ? "text-green-500" : "text-red-500"}`} />
                    {kpi.change} față de luna anterioară
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuția Vânzărilor pe Canaluri</CardTitle>
                <CardDescription>Descompunerea veniturilor pe piețe</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={salesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {salesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, "Cotă"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Comenzi Recente</CardTitle>
                <CardDescription>Ultimele 5 comenzi din toate canalurile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {order.logo}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{order.id}</p>
                          <p className="text-xs text-muted-foreground">{order.customer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{order.total}</p>
                        <Badge variant="secondary" className="text-xs">
                          {order.channel}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
