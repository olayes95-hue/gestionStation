import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su, error: se } = await sb.auth.signUp({ email:`v2.test.${Date.now()}@gmail.com`, password:'V2test123456!' })
if (se||!su.session){ console.log('❌ auth:', se?.message); process.exit(1) }
const uid=su.user.id
let ok=true

console.log('[1] settings (prix)')
const { data: st, error: es } = await sb.from('settings').select('*').eq('id',1).maybeSingle()
if (es){ console.log('❌ settings:', es.message); ok=false }
else console.log(`   Essence ${st.essence_pv} · Gasoil ${st.gasoil_pv} · Marge ${st.marge_unitaire} F/L`, (st.essence_pv==725&&st.gasoil_pv==750&&st.marge_unitaire==20)?'✅':'⚠️')

console.log('[2] insert point avec stock/gaz/lubrifiant')
const td='2098-02-02'
await sb.from('daily_reports').delete().eq('report_date',td)
const { error: er } = await sb.from('daily_reports').insert({ report_date:td, ess_litres:1000, gas_litres:500, ess_espece:60000,
  ess_stock:120, gaz_stock_6:48, gaz_vendu_6:5, lubrifiant_stock:{'5W30 1L':6,'20W50 5L':5}, created_by:uid })
if (er){ console.log('❌ report:', er.message); ok=false } else console.log('   ✅ point inséré (1500 L → marge attendue 30 000 F)')

console.log('[3] livraison + submission')
const { error: el } = await sb.from('deliveries').insert({ report_date:td, type:'gasoil', quantite:5000, unite:'litres', montant:3650000, fournisseur:'Test', created_by:uid })
if (el){ console.log('❌ deliveries:', el.message); ok=false } else console.log('   ✅ livraison insérée')
const { error: esub } = await sb.from('submissions').insert({ report_date:td, moment:'soir', created_by:uid })
if (esub){ console.log('❌ submissions:', esub.message); ok=false } else console.log('   ✅ submission (moment) insérée')

console.log('[4] métriques (marge + livraisons)')
const { data: m, error: em } = await sb.from('v_report_metrics').select('marge_estimee,total_livraisons,cash_declare').eq('report_date',td).maybeSingle()
if (em){ console.log('❌ v_report_metrics:', em.message); ok=false }
else console.log(`   marge_estimee=${m.marge_estimee} (attendu 30000) · total_livraisons=${m.total_livraisons} (attendu 3650000)`, (Number(m.marge_estimee)===30000&&Number(m.total_livraisons)===3650000)?'✅':'⚠️')

await sb.from('daily_reports').delete().eq('report_date',td)
console.log('\n'+(ok?'✅ v2 opérationnelle':'⚠️ voir erreurs ci-dessus'))
process.exit(0)
