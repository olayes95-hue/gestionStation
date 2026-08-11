import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su } = await sb.auth.signUp({ email:`v45.${Date.now()}@gmail.com`, password:'V45test123!' })
if(!su?.session){ console.log('❌ pas de session'); process.exit(1) }
const uid=su.user.id
const { data: sts } = await sb.from('stations').select('id').order('id'); const s1=sts[0].id
await sb.from('profiles').update({ station_id:s1 }).eq('id',uid)

console.log('[1] deux jours avec relevés d\'ouverture → litres calculés')
const A='2097-05-01', B='2097-05-02'
for (const d of [A,B]) await sb.from('daily_reports').delete().eq('report_date',d).eq('station_id',s1)
// jour A : ouverture E=1000 (×4=4000). déclare 100 L essence (écart vs calc)
await sb.from('daily_reports').insert({ report_date:A, station_id:s1, e1_m:1000,e2_m:1000,e3_m:1000,e4_m:1000, ess_litres:100, ess_pu:725, ess_bon:50000, ess_espece:22500, created_by:uid })
// jour B : ouverture E=1075 (×4=4300) → ventes jour A = 4300-4000 = 300 L
await sb.from('daily_reports').insert({ report_date:B, station_id:s1, e1_m:1075,e2_m:1075,e3_m:1075,e4_m:1075, created_by:uid })

const { data:mA } = await sb.from('v_report_metrics').select('ess_litres_calc,ess_litres,ca_carburant,marge_estimee').eq('report_date',A).eq('station_id',s1).maybeSingle()
console.log(`   jour A: litres_calc=${mA.ess_litres_calc} (attendu 300) · déclaré=${mA.ess_litres} · CA=${mA.ca_carburant} (déclaré 100×725=72500) · marge=${mA.marge_estimee} (2000)`,
  (Number(mA.ess_litres_calc)===300 && Number(mA.ca_carburant)===72500 && Number(mA.marge_estimee)===2000)?'✅':'⚠️')

console.log('[2] alerte ECART_COMPTEUR (déclaré 100 vs calc 300)')
const { data:al } = await sb.from('v_alerts').select('type,detail').eq('station_id',s1).eq('report_date',A)
console.log('   ', al.map(a=>a.type).join(', '), al.some(a=>a.type==='ECART_COMPTEUR')?'✅':'⚠️')

console.log('[3] alerte POINT_MANQUANT présente (14 derniers jours station active)')
const { data:pm } = await sb.from('v_alerts').select('type').eq('station_id',s1).eq('type','POINT_MANQUANT')
console.log('   POINT_MANQUANT:', pm.length, pm.length>0?'✅':'(aucun — normal si tous les jours récents sont saisis)')

console.log('[4] bank_lines réservé admin (gérant bloqué)')
const { error:be } = await sb.from('bank_lines').insert({ station_id:s1, date_operation:A, montant:50000 })
console.log('   ', be?('refusé ✅ ('+be.message.slice(0,40)+'…)'):'❌ FAILLE: gérant a pu insérer')

for (const d of [A,B]) await sb.from('daily_reports').delete().eq('report_date',d).eq('station_id',s1)
console.log('\n✅ test v4+v5 terminé')
process.exit(0)
