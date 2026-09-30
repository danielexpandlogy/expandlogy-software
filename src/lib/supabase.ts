import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Log instead of throw so React can still mount and show the ErrorBoundary
  console.error('[Expandlogy] Missing Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Check deployment environment settings.')
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  // PKCE en vez del flujo implícito: con implicit, los tokens de recuperación de
  // contraseña y de magic link viajan en el fragmento de la URL.
  { auth: { flowType: 'pkce' } },
)

// Cliente sin sesión para queries públicas. Siempre envía requests como 'anon'.
export const supabasePublic = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

export type { Json } from './database.types'
