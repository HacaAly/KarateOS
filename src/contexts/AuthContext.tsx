import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, toMessage } from '../lib/supabase'
import { fetchOrCreateProfile } from '../services/profiles'
import type { Profile } from '../types/database'

export interface AuthResult { ok: boolean; message?: string; needsConfirmation?: boolean }

export interface AuthContextValue {
  configured: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  profileError: string | null
  recoveryMode: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (fullName: string, email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  refreshProfile: () => Promise<void>
  setProfile: (p: Profile) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null)

function authMessage(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return 'Email atau password salah.'
  if (/email not confirmed/i.test(msg)) return 'Email belum diverifikasi. Periksa kotak masuk Anda lalu klik tautan verifikasi.'
  if (/already registered|already been registered/i.test(msg)) return 'Email ini sudah terdaftar. Silakan masuk.'
  if (/password should be at least|weak password/i.test(msg)) return 'Password terlalu lemah. Gunakan minimal 8 karakter.'
  if (/rate limit|too many/i.test(msg)) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
  if (/invalid email|unable to validate email/i.test(msg)) return 'Format email tidak valid.'
  return toMessage(err)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)

  // Pemulihan sesi saat halaman dimuat + mendengarkan perubahan status autentikasi.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })

    // Callback dibuat sinkron: jangan memanggil API supabase lain di sini (risiko deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') { setProfile(null); setRecoveryMode(false) }
      setLoading(false)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const userId = session?.user.id ?? null
  const fallbackName = (session?.user.user_metadata?.full_name as string | undefined) ?? ''

  const loadProfile = useCallback(async () => {
    if (!userId) return
    setProfileLoading(true)
    setProfileError(null)
    try {
      setProfile(await fetchOrCreateProfile(userId, fallbackName))
    } catch (e) {
      setProfileError(toMessage(e))
    } finally {
      setProfileLoading(false)
    }
  }, [userId, fallbackName])

  useEffect(() => {
    if (userId) void loadProfile()
    else setProfile(null)
  }, [userId, loadProfile])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    profileError,
    recoveryMode,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return error ? { ok: false, message: authMessage(error) } : { ok: true }
    },
    async signUp(fullName, email, password) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin + '/login' },
      })
      if (error) return { ok: false, message: authMessage(error) }
      // Email yang sudah terdaftar dikembalikan tanpa error tetapi dengan identities kosong.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { ok: false, message: 'Email ini sudah terdaftar. Silakan masuk.' }
      }
      return { ok: true, needsConfirmation: !data.session }
    },
    async signOut() {
      await supabase.auth.signOut()
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset-password' })
      return error ? { ok: false, message: authMessage(error) } : { ok: true }
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (!error) setRecoveryMode(false)
      return error ? { ok: false, message: authMessage(error) } : { ok: true }
    },
    async resendConfirmation(email) {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
      return error ? { ok: false, message: authMessage(error) } : { ok: true }
    },
    refreshProfile: loadProfile,
    setProfile,
  }), [session, profile, loading, profileLoading, profileError, recoveryMode, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
