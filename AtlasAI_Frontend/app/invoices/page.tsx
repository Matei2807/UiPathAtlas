"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"

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
import { Loader2, Upload, Eye, FileText, CheckCircle2, AlertCircle, Mail } from "lucide-react"

// --- CONFIGURARE API ---
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
  source?: "manual" | "email" // Ca să știm de unde a venit
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
      source: "manual"
    },
  ])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  // State pentru a urmări ultimul eveniment procesat și a nu-l duplica
  const [lastEventId, setLastEventId] = useState<number | null>(null)
  const processedEventIds = useRef(new Set<number>())

  // --- 1. LISTENER AUTOMAT PENTRU EMAIL-URI (POLLING CORECTAT) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v2/ecommerce/events/latest/`);
        if (!res.ok) return;
        
        const event = await res.json();
        
        // Dacă nu avem eveniment, ieșim
        if (!event.id) return;

        // ID-ul unic pe care îl folosim în frontend
        const autoId = `AUTO-${event.id}`;

        setInvoices(prevInvoices => {
            // Căutăm dacă factura există deja în tabel
            const existingIndex = prevInvoices.findIndex(inv => inv.id === autoId);
            const existingInvoice = prevInvoices[existingIndex];

            // CAZ 1: EVENIMENT NOU (PROCESSING) -> Adăugăm în tabel
            if (event.status === 'processing' && existingIndex === -1) {
                // Extragem numele fișierului din mesaj
                const fileNameMatch = event.message.match(/factura: (.*?).pdf/i) || event.message.match(/factura: (.*?)/i);
                const fileName = fileNameMatch ? `${fileNameMatch[1]}.pdf` : "Factura_Email.pdf";

                const newInvoice: Invoice = {
                    id: autoId,
                    fileName: fileName,
                    uploadDate: new Date(),
                    status: "processing",
                    fileType: "pdf",
                    source: "email"
                };
                // O punem prima în listă
                return [newInvoice, ...prevInvoices];
            }

            // CAZ 2: ACTUALIZARE STATUS (COMPLETED)
            // Dacă există în tabel ȘI era 'processing' ȘI acum backend-ul zice 'completed'
            if (existingIndex !== -1 && existingInvoice.status === 'processing' && event.status === 'completed') {
                const updatedList = [...prevInvoices];
                updatedList[existingIndex] = {
                    ...existingInvoice,
                    status: "completed",
                    productsUpdated: 5 // Sau extragi numărul din event.message dacă ai pus acolo
                };
                
                // Trigger UI feedback
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 5000);
                
                return updatedList;
            }

            // CAZ 3: EROARE
            if (existingIndex !== -1 && existingInvoice.status === 'processing' && event.status === 'error') {
                const updatedList = [...prevInvoices];
                updatedList[existingIndex] = {
                    ...existingInvoice,
                    status: "error",
                    error: event.message
                };
                return updatedList;
            }

            // Dacă nu s-a schimbat nimic relevant, returnăm starea neschimbată
            return prevInvoices;
        });

      } catch (e) {
        // Silent fail
      }
    }, 1000); // Verifică la fiecare secundă pentru demo rapid

    return () => clearInterval(interval);
  }, []);

  // --- 2. UPLOAD MANUAL (Rămâne la fel) ---
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
    const tempId = `INV-${Date.now()}`
    const fileType = uploadedFile.type === "application/pdf" ? "pdf" : "jpg"
    
    const newInvoice: Invoice = {
      id: tempId,
      fileName: uploadedFile.name,
      uploadDate: new Date(),
      status: "uploading",
      fileType: fileType as "pdf" | "jpg",
      source: "manual"
    }

    setInvoices((prev) => [newInvoice, ...prev])

    const formData = new FormData()
    formData.append("file", uploadedFile)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/ecommerce/invoices/process/`, {
        method: "POST",
        headers: {
          'Authorization': `Token ${TEMPORARY_USER_TOKEN}`
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Eroare")

      const count = data.data?.summary?.total_processed || 0;

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === tempId
            ? { ...inv, status: "completed", productsUpdated: count }
            : inv
        )
      )
      setShowSuccess(true)
      setUploadedFile(null)
      setTimeout(() => setShowSuccess(false), 4000)

    } catch (error: any) {
      setInvoices((prev) =>
        prev.map((inv) => inv.id === tempId ? { ...inv, status: "error", error: error.message } : inv)
      )
    } finally {
      setIsUploading(false)
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5") }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5") }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5");
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0])
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
              <p className="text-muted-foreground">Monitorizare automată email și încărcare manuală</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Upload className="mr-2 h-4 w-4" />
                  Încarcă Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Încarcă Factură</DialogTitle>
                  <DialogDescription>
                    PDF-ul va fi analizat de AI pentru actualizarea stocurilor.
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
                  <label>
                    <input type="file" accept=".pdf,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
                    <Button variant="outline" size="sm" type="button" className="mt-2">Selectați Fișier</Button>
                  </label>
                </div>

                {uploadedFile && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                    Fișier: {uploadedFile.name}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button onClick={() => setIsDialogOpen(false)} variant="outline" className="flex-1">Anulare</Button>
                  <Button onClick={handleUpload} disabled={!uploadedFile || isUploading} className="flex-1">
                    {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesare AI...</> : "Încarcă"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {showSuccess && (
            <Card className="border-green-200 bg-green-50 animate-in slide-in-from-top-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Succes!</p>
                    <p className="text-sm text-green-700">Factura a fost procesată și produsele au fost actualizate.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Istoric Facturi</CardTitle>
              <CardDescription>Facturi detectate automat pe email sau încărcate manual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SURSA</TableHead>
                      <TableHead>FIȘIER</TableHead>
                      <TableHead>DATA</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>UPDATE</TableHead>
                      <TableHead>ACȚIUNI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                            {invoice.source === 'email' ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 gap-1">
                                    <Mail className="h-3 w-3" /> Email
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="gap-1">
                                    <Upload className="h-3 w-3" /> Manual
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className="font-medium">
                            <div className="flex flex-col">
                                <span>{invoice.fileName}</span>
                                {invoice.error && <span className="text-xs text-red-500">{invoice.error}</span>}
                            </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.uploadDate.toLocaleTimeString("ro-RO")}
                        </TableCell>
                        <TableCell>
                          {invoice.status === "processing" || invoice.status === "uploading" ? (
                            <div className="flex items-center gap-2 text-amber-600 font-medium animate-pulse">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              AI Analyzing...
                            </div>
                          ) : invoice.status === "completed" ? (
                            <div className="flex items-center gap-2 text-green-600 font-medium">
                              <CheckCircle2 className="h-4 w-4" />
                              Finalizat
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-600">
                              <AlertCircle className="h-4 w-4" /> Eroare
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invoice.status === "completed" ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                              +{invoice.productsUpdated} stoc
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" disabled={invoice.status !== "completed"}>
                            <Eye className="h-4 w-4 mr-2" /> Detalii
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