"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus, History, GitCompare, Settings, Home, Database } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SidebarProps {
  onNewInvestigation: () => void
}

export function Sidebar({ onNewInvestigation }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { icon: Home, label: "Inicio", href: "/" },
    { icon: Plus, label: "Nueva Investigación", onClick: onNewInvestigation, primary: true },
    { icon: GitCompare, label: "Comparar Entidades", href: "/comparar" },
    { icon: History, label: "Historial", href: "/historial" },
    { icon: Database, label: "Bases de Datos", href: "/bases-datos" },
    { icon: Settings, label: "Configuración", href: "/configuracion" },
  ]

  return (
    <aside className="w-16 h-screen flex flex-col items-center py-6 border-r border-border bg-sidebar">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-8"
      >
        <Link href="/" title="NeurAudit AI — Inicio">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow">
            <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </Link>
      </motion.div>

      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item, index) => {
          const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + "/") : false
          const className = cn(
            "group relative size-10 rounded-xl flex items-center justify-center transition-all",
            item.primary
              ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              : isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )

          const inner = <item.icon className="size-5" />

          const tooltip = (
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-border z-50">
              {item.label}
            </span>
          )

          if (item.href) {
            return (
              <motion.div key={item.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                <Link href={item.href} className={className} title={item.label}>
                  {inner}
                  {tooltip}
                </Link>
              </motion.div>
            )
          }

          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={item.onClick || (() => router.push("/"))}
              className={className}
              title={item.label}
            >
              {inner}
              {tooltip}
            </motion.button>
          )
        })}
      </nav>
    </aside>
  )
}
