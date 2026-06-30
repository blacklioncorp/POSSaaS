import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Extraer el tenantId de la URL si es de la forma /[tenantId]/...
  const urlParts = pathname.split('/').filter(Boolean)
  const isTenantRoute = urlParts.length > 0 && 
                        urlParts[0] !== 'api' && 
                        urlParts[0] !== '_next' && 
                        !pathname.includes('.') // saltar archivos estáticos

  if (isTenantRoute) {
    const tenantId = urlParts[0]
    const subRoute = '/' + urlParts.slice(1).join('/')
    
    const isPublic = publicRoutes.some(r => subRoute.startsWith(r))
    
    if (!isPublic) {
      // Verificar sesión
      const sessionCookie = request.cookies.get('pos_session')?.value
      const session = sessionCookie ? await decrypt(sessionCookie) : null
      
      // Si no hay sesión o es de otro tenant
      if (!session || session.tenantId !== tenantId) {
        return NextResponse.redirect(new URL(`/${tenantId}/login`, request.url))
      }

      // ── RBAC (Control de Acceso Basado en Roles) ──
      const role = session.rol
      
      // Reglas de acceso
      if (role === 'cajero') {
        // Un cajero SOLO puede acceder a Ventas
        if (!subRoute.startsWith('/ventas') && !subRoute.startsWith('/dashboard')) {
          // Bloquear y mandar a Ventas
          return NextResponse.redirect(new URL(`/${tenantId}/ventas`, request.url))
        }
      } else if (role === 'supervisor') {
        // Supervisor puede acceder a Ventas, Inventario e Historiales, pero no a Usuarios ni Dashboard principal
        if (subRoute.startsWith('/admin/usuarios') || subRoute.startsWith('/admin/productos')) {
           return NextResponse.redirect(new URL(`/${tenantId}/ventas`, request.url))
        }
      }
      // Admin tiene acceso total
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
