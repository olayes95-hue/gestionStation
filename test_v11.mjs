import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
let pass=0,fail=0
const ok=m=>{console.log('  ✅',m);pass++}; const ko=m=>{console.log('  ❌',m);fail++}
const { data:su } = await sb.auth.signUp({ email:`v11.${Date.now()}@gmail.com`, password:'V11test123!' })
const uid=su.user.id
const { data:sts } = await sb.from('stations').select('id').order('id'); const s1=sts[0].id, s2=sts[1]?.id
await sb.from('profiles').update({ station_id:s1 }).eq('id',uid)

console.log('=== 1. Journal d\'audit : gérant ne peut PAS le lire (admin seulement) ===')
const rl = await sb.from('audit_log').select('*').limit(1)
if (rl.error && /exist|schema/i.test(rl.error.message)) { console.log('  ⚠️  v11 non appliquée (migration_v11.sql à lancer)'); process.exit(0) }
;(rl.data && rl.data.length===0) ? ok('audit_log invisible au gérant (RLS admin-only)') : ko('audit_log lisible par le gérant')

console.log('=== 2. Verrouillage du passé : gérant ne peut PAS modifier un vieux jour ===')
// trouve un point ancien (>2 jours) de la station 1
const { data:old } = await sb.from('daily_reports').select('report_date,ess_stock').eq('station_id',s1).lt('report_date','2026-06-25').order('report_date',{ascending:false}).limit(1)
if (old?.length){
  const d=old[0].report_date, before=old[0].ess_stock
  await sb.from('daily_reports').update({ ess_stock: 123456 }).eq('report_date',d).eq('station_id',s1)
  const { data:after } = await sb.from('daily_reports').select('ess_stock').eq('report_date',d).eq('station_id',s1).single()
  Number(after.ess_stock)!==123456 ? ok(`modification du ${d} bloquée (valeur inchangée)`) : ko('FAILLE: gérant a modifié un vieux jour')
} else console.log('  ⚠️  pas de point ancien trouvé pour tester')

console.log('=== 3. Suppression financière interdite au gérant ===')
const today=new Date().toISOString().slice(0,10)
const { data:dep } = await sb.from('deposits').insert({ report_date:today, station_id:s1, pole:'carburant', montant:5000, created_by:uid }).select().single()
if (dep){
  await sb.from('deposits').delete().eq('id',dep.id)
  const { data:still } = await sb.from('deposits').select('id').eq('id',dep.id)
  still?.length ? ok('suppression de versement bloquée pour le gérant (RLS admin-only)') : ko('FAILLE: gérant a supprimé un versement')
  // (le versement de test restera ; il sera nettoyé par un admin)
} else console.log('  ⚠️  insertion versement impossible')

console.log('=== 4. Écriture toujours possible sur aujourd\'hui (non bloquée à tort) ===')
const w = await sb.from('daily_reports').upsert({ report_date:today, station_id:s1, ess_stock:7777, created_by:uid },{onConflict:'station_id,report_date'})
w.error ? ko('écriture du jour bloquée à tort: '+w.error.message) : ok('écriture du jour autorisée (le verrou ne bloque que le passé)')

console.log(`\n  ${pass} OK · ${fail} échec(s)`)
process.exit(fail>0?1:0)
