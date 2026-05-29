import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeurAudit AI — Auditor de Contratos Públicos",
  description: "Sistema de auditoría inteligente para contratos públicos de Colombia — SECOP II",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
