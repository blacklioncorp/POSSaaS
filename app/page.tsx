import { redirect } from 'next/navigation'

export default function Home() {
  // Redirigir por defecto al tenant "demo" para evitar el 404
  redirect('/demo/dashboard')
}
