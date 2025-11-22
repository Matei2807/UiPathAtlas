"use client"

import type React from "react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Upload, Eye, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { useState } from "react"

interface Invoice {
  id: string
  fileName: string
  uploadDate: Date
  status: "uploading" | "processing" | "completed" | "error"
  fileType: "pdf" | "jpg"
  productsUpdated?: number
  error?: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([
    {
      id: "INV-001",
      fileName: "Invoice_2024_01_15.pdf",
      uploadDate: new Date("2024-01-15T10:30:00"),
      status: "completed",
      fileType: "pdf",
      productsUpdated: 3,
    },
    {
      id: "INV-002",
      fileName: "Invoice_2024_01_14.jpg",
      uploadDate: new Date("2024-01-14T14:20:00"),
      status: "completed",
      fileType: "jpg",
      productsUpdated: 5,
    },
  ])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleFileSelect = (file: File) => {
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg"]
    if (!validTypes.includes(file.type)) {
      alert("Vă rugăm să încărcați doar fișiere PDF sau JPG")
      return
    }
    setUploadedFile(file)
  }

  const handleUpload = async () => {
    if (!uploadedFile) return

    setIsUploading(true)
    const fileType = uploadedFile.type === "application/pdf" ? "pdf" : "jpg"
    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      fileName: uploadedFile.name,
      uploadDate: new Date(),
      status: "uploading",
      fileType: fileType as "pdf" | "jpg",
    }

    setInvoices([newInvoice, ...invoices])

    // Simulate upload and processing
    setTimeout(() => {
      setInvoices((prev) => prev.map((inv) => (inv.id === newInvoice.id ? { ...inv, status: "processing" } : inv)))
    }, 1500)

    setTimeout(() => {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === newInvoice.id
            ? { ...inv, status: "completed", productsUpdated: Math.floor(Math.random() * 8) + 1 }
            : inv,
        ),
      )
      setIsUploading(false)
      setShowSuccess(true)
      setUploadedFile(null)

      // Hide success message after 4 seconds
      setTimeout(() => setShowSuccess(false), 4000)
    }, 3000)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.classList.add("border-primary", "bg-primary/5")
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.classList.remove("border-primary", "bg-primary/5")
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.classList.remove("border-primary", "bg-primary/5")
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
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
                  <BreadcrumbPage>Facturi</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Facturi</h1>
              <p className="text-muted-foreground">Încărcați și gestionați facturile pentru actualizarea stocurilor</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Upload className="mr-2 h-4 w-4" />
                  Încarcă Factură
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Încarcă Factură</DialogTitle>
                  <DialogDescription>
                    Încărcați un fișier PDF sau JPG. Sistemul va extrage datele și va actualiza stocurile.
                  </DialogDescription>
                </DialogHeader>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors"
                >
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="font-medium mb-1">Trageți fișierul aici</p>
                  <p className="text-sm text-muted-foreground mb-4">sau</p>
                  <label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileSelect(e.target.files[0])
                        }
                      }}
                      className="hidden"
                    />
                    <Button variant="outline" size="sm" type="button">
                      Selectați Fișier
                    </Button>
                  </label>
                </div>

                {uploadedFile && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Fișier selectat:</p>
                    <p className="text-sm text-blue-700">{uploadedFile.name}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Dimensiune: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      setIsDialogOpen(false)
                      setUploadedFile(null)
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Anulare
                  </Button>
                  <Button onClick={handleUpload} disabled={!uploadedFile || isUploading} className="flex-1">
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Se încarcă...
                      </>
                    ) : (
                      "Încarcă"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {showSuccess && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Factură încărcată cu succes!</p>
                    <p className="text-sm text-green-700">Datele au fost extrase și stocurile au fost actualizate.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Facturile Încărcate</CardTitle>
              <CardDescription>Istoric al facturilor și statutul procesării</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>FIȘIER</TableHead>
                      <TableHead>TIP</TableHead>
                      <TableHead>DATA ÎNCĂRCĂRII</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>PRODUSE ACTUALIZATE</TableHead>
                      <TableHead>ACȚIUNI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.fileName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.fileType.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.uploadDate.toLocaleDateString("ro-RO")}{" "}
                          {invoice.uploadDate.toLocaleTimeString("ro-RO")}
                        </TableCell>
                        <TableCell>
                          {invoice.status === "uploading" && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              <span className="text-sm text-blue-600">Se încarcă...</span>
                            </div>
                          )}
                          {invoice.status === "processing" && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                              <span className="text-sm text-amber-600">Se procesează...</span>
                            </div>
                          )}
                          {invoice.status === "completed" && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600">Finalizat</span>
                            </div>
                          )}
                          {invoice.status === "error" && (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <span className="text-sm text-red-600">Eroare</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.status === "completed" ? (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              {invoice.productsUpdated} produse
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" disabled={invoice.status !== "completed"}>
                            <Eye className="h-4 w-4 mr-2" />
                            Vizualizare
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </>
  )
}
