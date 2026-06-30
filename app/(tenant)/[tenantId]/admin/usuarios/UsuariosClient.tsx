'use client'

import { useState, useEffect } from 'react'
import { 
  Users, Plus, Pencil, ShieldAlert, Shield, 
  UserSquare, Save, X, Loader2 
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppNavBar } from '@/components/pos/AppNavBar'
import type { Usuario, RolUsuario } from '@/types/pos.types'

interface UsuariosClientProps {
  tenantId: string
}

export function UsuariosClient({ tenantId }: UsuariosClientProps) {
  const supabase = createClient(tenantId)
  
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Edición/Creación
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [formId, setFormId] = useState<string | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formRol, setFormRol] = useState<RolUsuario>('cajero')
  const [formPin, setFormPin] = useState('')
  const [formActivo, setFormActivo] = useState(true)

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const fetchUsuarios = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, tenant_id, nombre, rol, activo, creado_en')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: true })
      
    if (!error && data) {
      setUsuarios(data as Usuario[])
    }
    setLoading(false)
  }

  const openModal = (usuario?: Usuario) => {
    if (usuario) {
      setFormId(usuario.id)
      setFormNombre(usuario.nombre)
      setFormRol(usuario.rol)
      setFormActivo(usuario.activo ?? true)
      setFormPin('') // Nunca mostramos el PIN actual
    } else {
      setFormId(null)
      setFormNombre('')
      setFormRol('cajero')
      setFormActivo(true)
      setFormPin('')
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNombre.trim()) return
    
    // Si es nuevo, el PIN es obligatorio
    if (!formId && !formPin.trim()) {
      alert("El PIN es obligatorio para usuarios nuevos.")
      return
    }

    setSaving(true)

    try {
      if (formId) {
        // Editar (Usamos RPC)
        const { error } = await supabase.rpc('actualizar_usuario_pos', {
          p_usuario_id: formId,
          p_tenant_id: tenantId,
          p_nombre: formNombre,
          p_rol: formRol,
          p_pin: formPin || null,
          p_activo: formActivo
        })
        if (error) throw error
      } else {
        // Crear (Usamos RPC)
        const { error } = await supabase.rpc('crear_usuario_pos', {
          p_tenant_id: tenantId,
          p_nombre: formNombre,
          p_rol: formRol,
          p_pin: formPin,
          p_activo: formActivo
        })
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchUsuarios()
    } catch (err: any) {
      console.error(err)
      alert("Error al guardar el usuario: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const getRolBadge = (rol: RolUsuario) => {
    switch(rol) {
      case 'admin': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><ShieldAlert className="w-3 h-3"/> Administrador</span>
      case 'supervisor': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Shield className="w-3 h-3"/> Supervisor</span>
      case 'cajero': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><UserSquare className="w-3 h-3"/> Cajero</span>
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex flex-col">
      <AppNavBar tenantId={tenantId} />

      <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-emerald-500" />
              Gestión de Usuarios
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Administra los accesos, roles y PINs de seguridad de tu personal.
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Usuario
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/50 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Nombre</th>
                  <th className="px-6 py-4 font-medium">Rol</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Fecha de Alta</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                ) : (
                  usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">
                        {u.nombre}
                      </td>
                      <td className="px-6 py-4">
                        {getRolBadge(u.rol)}
                      </td>
                      <td className="px-6 py-4">
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-zinc-500/10 text-zinc-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric'}) : '--'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openModal(u)}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors inline-flex"
                          title="Editar usuario"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/50">
              <h2 className="text-lg font-bold text-white">
                {formId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button 
                onClick={() => !saving && setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={e => setFormNombre(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Rol del Sistema
                </label>
                <select
                  value={formRol}
                  onChange={e => setFormRol(e.target.value as RolUsuario)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="cajero">Cajero (Ventas y cortes)</option>
                  <option value="supervisor">Supervisor (Inventario y reportes básicos)</option>
                  <option value="admin">Administrador (Acceso total)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  PIN de Acceso {formId && <span className="text-xs text-zinc-500">(Opcional: déjalo en blanco para no cambiarlo)</span>}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required={!formId}
                  value={formPin}
                  onChange={e => setFormPin(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  placeholder={formId ? "••••" : "Ej. 1234"}
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={formActivo}
                      onChange={e => setFormActivo(e.target.checked)}
                    />
                    <div className="block w-10 h-6 bg-zinc-800 rounded-full peer-checked:bg-emerald-500 transition-colors"></div>
                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4"></div>
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                    Usuario Activo (Puede iniciar sesión)
                  </span>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Guardar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
