"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

interface AppShellProps {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  children: React.ReactNode
}

export function AppShell({
  title,
  subtitle,
  backHref = "/",
  backLabel = "Volver al inicio",
  children,
}: AppShellProps) {
  const router = useRouter()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar onNewInvestigation={() => router.push("/")} />

      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between px-8 py-6 border-b border-border">
          <div className="flex items-center gap-4">
            <Link
              href={backHref}
              className="size-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={backLabel}
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h1 className="font-semibold text-foreground">{title}</h1>
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1 ml-11">{subtitle}</p>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            NeurAudit AI · Inteligencia Anticorrupción
          </span>
        </header>

        <div className="p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
