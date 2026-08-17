import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data || null)
  }

  useEffect(() => {
    // Filet de sécurité : si getSession() ne répond jamais (réseau capricieux, verrou du SDK
    // malgré le contournement dans lib/supabase.js), ne pas bloquer l'app indéfiniment sur
    // "Chargement…" — onAuthStateChange, abonné juste après, mettra à jour la session dès
    // qu'elle sera réellement connue.
    let settled = false
    const timeout = setTimeout(() => { if (!settled) setLoading(false) }, 6000)
    supabase.auth.getSession().then(async ({ data }) => {
      settled = true; clearTimeout(timeout)
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      await loadProfile(s?.user?.id)
    })
    return () => { clearTimeout(timeout); sub.subscription.unsubscribe() }
  }, [])

  const value = {
    session,
    profile,
    loading,
    role: profile?.role,
    isAdmin: profile?.role === 'admin',
    isPompiste: profile?.role === 'pompiste',
    isVendeuse: profile?.role === 'vendeuse',
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, full_name) =>
      supabase.auth.signUp({ email, password, options: { data: { full_name } } }),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
