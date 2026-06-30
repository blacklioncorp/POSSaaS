import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { RolUsuario } from '@/types/pos.types'

// Clave secreta para firmar los JWT. En producción debe venir de una variable de entorno segura.
const secretKey = process.env.JWT_SECRET_KEY || 'default_pos_secret_key_123456789'
const key = new TextEncoder().encode(secretKey)

export interface SessionPayload {
  userId: string
  tenantId: string
  nombre: string
  rol: RolUsuario
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h') // Sesión dura 12 horas
    .sign(key)
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch (error) {
    return null
  }
}

export async function createSession(payload: SessionPayload) {
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 horas
  const session = await encrypt(payload)
  
  const cookieStore = await cookies()
  cookieStore.set('pos_session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete('pos_session')
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('pos_session')?.value
  if (!session) return null
  return await decrypt(session)
}
