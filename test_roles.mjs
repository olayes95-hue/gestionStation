import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

// crée un compte gérant
const { data: su, error: se } = await sb.auth.signUp({ email:`role.test.${Date.now()}@gmail.com`, password:'Role123456!' })
if (se || !su.session){ console.log('❌ auth:', se?.message); process.exit(1) }
const uid = su.user.id
const { data: p0 } = await sb.from('profiles').select('role').eq('id',uid).single()
console.log('Compte créé — rôle initial:', p0.role)

// TENTATIVE de self-promotion en admin (doit échouer)
const { error: ue } = await sb.from('profiles').update({ role:'admin' }).eq('id', uid)
const { data: p1 } = await sb.from('profiles').select('role').eq('id',uid).single()

if (ue) console.log('✅ Bloqué au niveau base (erreur):', ue.message)
if (p1.role === 'admin') console.log('❌ FAILLE : le rôle est passé à admin !')
else console.log(`✅ VERROU OK — le rôle est resté "${p1.role}" malgré la tentative.`)

// vérifie qu'une mise à jour LÉGITIME (ex. nom) passe toujours
const { error: ne } = await sb.from('profiles').update({ full_name:'Nom modifié OK' }).eq('id', uid)
console.log(ne ? '❌ maj nom bloquée: '+ne.message : '✅ Mise à jour du nom (non-rôle) toujours autorisée.')
process.exit(0)
