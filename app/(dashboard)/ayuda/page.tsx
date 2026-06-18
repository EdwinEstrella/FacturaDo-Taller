"use client"

import { Info } from "lucide-react"
import VideoPlayer from "@/components/ui/video-player"

const helpModules = [
  {
    title: "Facturación",
    description: "Aprende a crear facturas, cotizaciones y manejar el cobro a clientes.",
    videos: [
      { id: "1", title: "Cómo crear una factura desde cero", duration: "3:45", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "2", title: "Convertir una cotización en factura", duration: "2:20", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "3", title: "Gestión de notas de crédito", duration: "4:15", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
    ]
  },
  {
    title: "Operaciones e Inventario",
    description: "Domina el catálogo de productos y el control del almacén.",
    videos: [
      { id: "4", title: "Agregar un nuevo producto al catálogo", duration: "1:50", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "5", title: "Registrar entradas y salidas de almacén", duration: "3:10", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "6", title: "Creación de un pedido de producción", duration: "5:30", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
    ]
  },
  {
    title: "Desglose",
    description: "Tutoriales para cotizar ventanas P65 y Tradicional.",
    videos: [
      { id: "7", title: "Calculadora de Ventana P65", duration: "4:00", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "8", title: "Configurar opciones de Ventana Tradicional", duration: "3:40", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "9", title: "Cómo leer el historial de desgloses", duration: "2:10", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
    ]
  },
  {
    title: "Finanzas y Contabilidad",
    description: "Herramientas de cuadre de caja y comprobantes fiscales.",
    videos: [
      { id: "10", title: "Realizar el cierre de caja diario", duration: "2:50", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
      { id: "11", title: "Emisión de comprobantes fiscales", duration: "3:15", url: "https://videos.pexels.com/video-files/30333849/13003128_2560_1440_25fps.mp4" },
    ]
  }
]

export default function AyudaPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Centro de Ayuda</h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Encuentra tutoriales en video para sacar el máximo provecho de cada módulo del sistema.
          </p>
        </div>
      </div>
      
      <div className="grid gap-6 mt-6">
        {helpModules.map((module, index) => (
          <div key={index} className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">{module.title}</h3>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </div>
            <div className="flex flex-col gap-8">
              {module.videos.map((video) => (
                <div key={video.id} className="flex flex-col space-y-2">
                  <h4 className="text-lg font-medium">{video.title}</h4>
                  <VideoPlayer src={video.url} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
