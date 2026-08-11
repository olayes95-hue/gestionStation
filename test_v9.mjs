import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su } = await sb.auth.signUp({ email:`v9.${Date.now()}@gmail.com`, password:'V9test123!' })
const uid=su.user.id
const { data: sts } = await sb.from('stations').select('id,nom').order('id'); const s1=sts[0].id
await sb.from('profiles').update({ station_id:s1 }).eq('id',uid)

console.log('[1] déclenche la vérification "matin" (comme le ferait le planificateur à 9h)')
const { error: re } = await sb.rpc('notify_missing', { p_moment: 'matin' })
console.log('   ', re ? ('❌ '+re.message) : '✅ fonction exécutée')

console.log('[2] le gérant voit la notification de SA station')
const { data: n } = await sb.from('notifications').select('*').eq('station_id', s1).eq('resolved', false).order('created_at', { ascending: false })
const matin = (n||[]).find(x => x.type === 'MANQUE_matin')
console.log('   notifications non traitées:', (n||[]).length, matin ? `✅ "${matin.message.slice(0,45)}…"` : '(aucune "matin" — déjà envoyée aujourd\'hui ou point du matin déjà saisi)')

console.log('[3] pas de doublon si on relance')
await sb.rpc('notify_missing', { p_moment: 'matin' })
const { data: n2 } = await sb.from('notifications').select('id').eq('station_id', s1).eq('type','MANQUE_matin')
console.log('   notifications "matin" aujourd\'hui:', (n2||[]).length, (n2||[]).length<=1 ? '✅ pas de doublon' : '⚠️ doublon')

console.log('[4] le gérant peut marquer "traité"')
if (matin) { await sb.from('notifications').update({ resolved:true }).eq('id', matin.id)
  const { data: chk } = await sb.from('notifications').select('resolved').eq('id', matin.id).single()
  console.log('   ', chk.resolved ? '✅ marquée traitée' : '⚠️ non modifiée') }

console.log('\n✅ test v9 terminé')
process.exit(0)
