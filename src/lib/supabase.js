import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('⚠️ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. Copie .env.example en .env.')
}

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: {
    // Évite le verrou navigator.locks de gotrue-js (bug connu du SDK) : il peut rester bloqué
    // indéfiniment quand l'onglet a été mis en arrière-plan (courant sur téléphone), figeant
    // getSession() — l'app restait alors bloquée sur "Chargement…" jusqu'à un rechargement manuel.
    lock: async (name, acquireTimeout, fn) => fn(),
  },
})
export const BORDEREAUX_BUCKET = 'bordereaux'
