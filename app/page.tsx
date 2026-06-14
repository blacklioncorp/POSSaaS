import { redirect } from 'next/navigation'

export default function Home() {
  // Redirigir directamente al CRUD de Productos — página principal del sistema
  redirect('/c231cde2-5a88-4619-bbd2-c73b90f22c47/admin/productos')
}
