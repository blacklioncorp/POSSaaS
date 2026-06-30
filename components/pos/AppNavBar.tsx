// =============================================================
//  components/pos/AppNavBar.tsx
//  Barra de navegación global — aparece en TODAS las páginas.
//  Props:
//    tenantId     — ID del tenant activo
//    activeSection — 'productos' | 'ventas' | 'inventario' | 'dashboard' | 'usuarios'
//    compact      — true en POS para reducir altura
// =============================================================
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, ShoppingCart, Warehouse, LayoutDashboard,
  Users, ChevronRight, Store, TrendingDown,
  LogOut, History
} from 'lucide-react'

export type NavSection =
  | 'productos'
  | 'ventas'
  | 'inventario'
  | 'dashboard'
  | 'usuarios'
  | 'historial-precios'
  | 'historial-ventas'

interface NavItem {
  key: NavSection
  label: string
  shortLabel: string
  icon: React.ReactNode
  href: string
}

interface AppNavBarProps {
  tenantId: string
  activeSection?: NavSection
  /** Reduce height in POS screen */
  compact?: boolean
  /** User name to show on the right */
  userName?: string
  /** User role */
  userRole?: string
  /** Right-side slot (e.g. operator selector in POS) */
  rightSlot?: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'productos',
    label: 'Productos',
    shortLabel: 'Productos',
    icon: <Package className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
  {
    key: 'ventas',
    label: 'POS / Ventas',
    shortLabel: 'Ventas',
    icon: <ShoppingCart className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
  {
    key: 'inventario',
    label: 'Inventario',
    shortLabel: 'Inventario',
    icon: <Warehouse className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
  {
    key: 'historial-precios',
    label: 'Historial de Precios',
    shortLabel: 'Precios',
    icon: <TrendingDown className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
  {
    key: 'historial-ventas',
    label: 'Historial de Ventas',
    shortLabel: 'Ventas (H)',
    icon: <History className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    shortLabel: 'Usuarios',
    icon: <Users className="h-4 w-4" />,
    href: 'DYNAMIC',
  },
]

function getHref(key: NavSection, tenantId: string): string {
  switch (key) {
    case 'productos':  return `/${tenantId}/admin/productos`
    case 'ventas':     return `/${tenantId}/ventas`
    case 'inventario': return `/${tenantId}/admin/inventario`
    case 'dashboard':  return `/${tenantId}/dashboard`
    case 'usuarios':   return `/${tenantId}/admin/usuarios`
    case 'historial-precios': return `/${tenantId}/admin/historial-precios`
    case 'historial-ventas':  return `/${tenantId}/admin/historial-ventas`
  }
}

export function AppNavBar({
  tenantId,
  activeSection,
  compact = false,
  userName: initialUserName,
  userRole: initialUserRole,
  rightSlot,
}: AppNavBarProps) {
  const router = useRouter()
  const [session, setSession] = useState<{ nombre: string, rol: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setSession(data.user)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push(`/${tenantId}/login`)
  }

  const py = compact ? 'py-1.5' : 'py-2.5'
  const displayUserName = session?.nombre || initialUserName
  const displayUserRole = session?.rol || initialUserRole

  return (
    <nav
      className={`
        flex items-center gap-1 border-b border-zinc-800/80
        bg-zinc-950/95 backdrop-blur-md px-3 shrink-0 z-40
        ${py}
      `}
      style={{ WebkitBackdropFilter: 'blur(12px)' }}
    >
      {/* ── Logo / Brand ── */}
      <button
        onClick={() => router.push(getHref('productos', tenantId))}
        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 mr-1 text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all"
        title="Inicio — Catálogo de Productos"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-900/40">
          <Store className="h-4 w-4 text-black" />
        </span>
        <span className="hidden sm:block text-xs font-bold tracking-wide text-white">
          POS<span className="text-emerald-400">SaaS</span>
        </span>
      </button>

      {/* ── Separator ── */}
      <ChevronRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />

      {/* ── Nav Items ── */}
      <div className="flex items-center gap-0.5 flex-1">
        {NAV_ITEMS.filter(item => {
          if (!session) return true // Show all if session not loaded yet, middleware handles security
          if (session.rol === 'admin') return true
          if (session.rol === 'supervisor') {
            return ['ventas', 'inventario', 'historial-precios', 'historial-ventas'].includes(item.key)
          }
          if (session.rol === 'cajero') {
            return item.key === 'ventas'
          }
          return false
        }).map((item) => {
          const href = getHref(item.key, tenantId)
          const isActive = activeSection === item.key

          return (
            <button
              key={item.key}
              onClick={() => router.push(href)}
              title={item.label}
              className={`
                relative flex items-center gap-2 rounded-xl px-3 py-1.5
                text-xs font-semibold transition-all duration-150
                ${isActive
                  ? 'bg-emerald-500/15 text-emerald-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                }
              `}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-emerald-500" />
              )}
              {item.icon}
              <span className="hidden md:inline">{item.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* ── Right slot (operator, custom content) ── */}
      {rightSlot ? (
        <div className="flex items-center gap-2 ml-auto">
          {rightSlot}
          <button onClick={handleLogout} className="ml-2 p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : displayUserName ? (
        <div className="ml-auto flex items-center gap-3 pl-3 border-l border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-zinc-800 text-xs font-bold text-emerald-400 uppercase">
              {displayUserName.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-xs font-semibold text-zinc-300">{displayUserName}</span>
              {displayUserRole && (
                <span className="text-[10px] text-zinc-600 capitalize">{displayUserRole}</span>
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="ml-auto">
          <button onClick={handleLogout} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </nav>
  )
}
