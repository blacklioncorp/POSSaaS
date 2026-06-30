'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, LogIn, AlertCircle } from 'lucide-react'

interface LoginClientProps {
  tenantId: string
}

export function LoginClient({ tenantId }: LoginClientProps) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, pin })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error de autenticación')
      }

      // Redirigir según el rol
      if (data.user.rol === 'cajero') {
        router.push(`/${tenantId}/ventas`)
      } else {
        router.push(`/${tenantId}/dashboard`)
      }
    } catch (err: any) {
      setError(err.message)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // Teclado numérico rápido
  const handleKeypad = (num: string) => {
    if (pin.length < 10) {
      setPin(prev => prev + num)
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-8 overflow-hidden relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-emerald-500/10 blur-[100px] pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="mx-auto w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4 shadow-inner shadow-zinc-800/50">
            <Lock className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">POS SaaS</h1>
          <p className="text-zinc-400 text-sm">Ingresa tu PIN de seguridad para acceder al sistema</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm relative z-10">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="relative z-10">
          <div className="mb-8">
            <input
              type="password"
              value={pin}
              readOnly
              className="w-full text-center bg-zinc-950 border border-zinc-800 rounded-2xl py-4 text-3xl font-mono text-white tracking-[0.5em] focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              placeholder="••••"
            />
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypad(num.toString())}
                className="h-14 bg-zinc-800/50 hover:bg-zinc-800 text-white text-xl font-medium rounded-xl transition-colors active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleDelete}
              className="h-14 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 text-sm font-medium rounded-xl transition-colors active:scale-95"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => handleKeypad('0')}
              className="h-14 bg-zinc-800/50 hover:bg-zinc-800 text-white text-xl font-medium rounded-xl transition-colors active:scale-95"
            >
              0
            </button>
            <button
              type="submit"
              disabled={loading || !pin}
              className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
