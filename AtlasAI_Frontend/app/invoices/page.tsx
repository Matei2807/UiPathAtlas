"use client"

import type React from "react"
import { useState } from "react"

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

// --- CONFIGURARE API ---
// Înlocuiește cu URL-ul real sau process.env.NEXT_PUBLIC_API_BASE_URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

const TEMPORARY_USER_TOKEN = "132c0560ba71c28a3a06c46ab01bf2cc73a02353" 

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
    // ... alte date mock
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

  // --- LOGICA DE UPLOAD INTEGRATĂ ---
  // --- LOGICA DE UPLOAD INTEGRATĂ ---
  const handleUpload = async () => {
    if (!uploadedFile) return

    setIsUploading(true)
    
    const tempId = `INV-${Date.now()}`
    const fileType = uploadedFile.type === "application/pdf" ? "pdf" : "jpg"
    
    const newInvoice: Invoice = {
      id: tempId,
      fileName: uploadedFile.name,
      uploadDate: new Date(),
      status: "uploading",
      fileType: fileType as "pdf" | "jpg",
    }

    setInvoices((prev) => [newInvoice, ...prev])

    const formData = new FormData()
    formData.append("file", uploadedFile)

    try {
      const token = localStorage.getItem("accessToken") 

      // 1. CORECȚIE URL: Adăugăm '/process/' la final
      const response = await fetch(`${API_BASE_URL}/api/v2/ecommerce/invoices/process/`, {
        method: "POST",
        headers: {
          // 2. Adaugam Token-ul de autentificare obligatoriu
          'Authorization': `Token ${TEMPORARY_USER_TOKEN}`
        },
        body: formData,
      })

      // 2. DEBUG AVANSAT: Verificăm dacă răspunsul e JSON valid
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Dacă serverul ne-a dat HTML (eroare 500 galbenă), îl citim ca text să vedem ce zice
        const textError = await response.text();
        console.error("Serverul a returnat HTML (probabil eroare 500):", textError);
        throw new Error("Eroare de server. Verificați consola browserului.");
      }

      const data = await response.json()

      console.log("Răspuns API:", data);

      if (!response.ok) {
        throw new Error(data.error || "Eroare la procesarea facturii")
      }

      // 3. MAPARE DATE: Backend-ul returnează acum o structură complexă
      // data = { status: "success", data: { summary: { total_processed: 5 }, new_products: [], updated_products: [] } }
      const count = data.data?.summary?.total_processed || 0;

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === tempId
            ? {
                ...inv,
                status: "completed",
                productsUpdated: count, 
              }
            : inv
        )
      )

      setShowSuccess(true)
      setUploadedFile(null)
      setTimeout(() => setShowSuccess(false), 4000)

    } catch (error: any) {
      console.error("Upload failed:", error)
      
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === tempId
            ? {
                ...inv,
                status: "error",
                error: error.message || "Eroare necunoscută",
              }
            : inv
        )
      )
      // alert(`Eroare la încărcare: ${error.message}`) // Opțional, poți scoate alerta dacă afișezi eroarea în tabel
    } finally {
      setIsUploading(false)
    }
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
                    disabled={isUploading}
                  >
                    Anulare
                  </Button>
                  <Button onClick={handleUpload} disabled={!uploadedFile || isUploading} className="flex-1">
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Se procesează...
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
                    <p className="font-medium text-green-900">Factură procesată cu succes!</p>
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
                      <TableHead>PRODUSE PROCESATE</TableHead>
                      <TableHead>ACȚIUNI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                            <div className="flex flex-col">
                                <span>{invoice.fileName}</span>
                                {invoice.error && (
                                    <span className="text-xs text-red-500 truncate max-w-[200px]">{invoice.error}</span>
                                )}
                            </div>
                        </TableCell>
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