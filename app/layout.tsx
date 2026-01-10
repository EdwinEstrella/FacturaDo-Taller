import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Mejora el rendimiento de carga de fuentes
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Solo precharge la fuente principal
});

// Viewport configuración (Next.js 16+ requiere export separado)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "FacturaDO - Sistema de Facturación",
    template: "%s | FacturaDO"
  },
  description: "Sistema de Facturación e Inventario Inteligente para República Dominicana",
  keywords: ["facturación", "inventario", "RD", "NCF", "facturas"],
  authors: [{ name: "FacturaDO" }],
  robots: {
    index: false, // Es una aplicación privada
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
