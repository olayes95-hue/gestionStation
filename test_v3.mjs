import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su, error: se } = await sb.auth.signUp({ email:`v3.test.${Date.now()}@gmail.com`, password:'V3test123456!' })
if (se||!su.session){ console.log('❌ auth:', se?.message); process.exit(1) }
const uid=su.user.id; let ok=true

console.log('[1] stations')
const { data: sts, error: est } = await sb.from('stations').select('*').order('id')
if (est){ console.log('❌ stations:', est.message); process.exit(1) }
console.log('   ', sts.map(s=>`#${s.id} ${s.nom} (seuil ess ${s.seuil_essence}L)`).join(' | '), sts.length>=2?'✅ 2 stations':'⚠️')
const s1 = sts[0].id

console.log('[2] rattache le testeur à la station 1')
await sb.from('profiles').update({ station_id: s1 }).eq('id', uid)

console.log('[3] insert point station 1 (stock essence 800 L, bons 500000, gaz6=40)')
const td='2097-03-03'
await sb.from('daily_reports').delete().eq('report_date',td).eq('station_id',s1)
const { error: er } = await sb.from('daily_reports').insert({ report_date:td, station_id:s1,
  ess_litres:1000, gas_litres:500, ess_espece:60000, ess_stock:800, gas_stock:5000,
  total_bon_cumul:500000, gaz_stock_6:40, created_by:uid })
if (er){ console.log('❌ report:', er.message); ok=false } else console.log('   ✅ inséré')

console.log('[4] fournisseur + livraison')
const { data: sup } = await sb.from('suppliers').insert({ nom:'Test Supérette SARL', categorie:'superette' }).select().single()
if (sup) { await sb.from('deliveries').insert({ report_date:td, station_id:s1, type:'autre', quantite:10, unite:'cartons', montant:150000, supplier_id:sup.id, created_by:uid }); console.log('   ✅ fournisseur + livraison') }

console.log('[5] v_latest_stock (temps réel)')
const { data: ls, error: els } = await sb.from('v_latest_stock').select('*').eq('station_id',s1).maybeSingle()
if (els){ console.log('❌', els.message); ok=false }
else console.log(`   ess_stock=${ls.ess_stock} · gas_stock=${ls.gas_stock} · bons_restant=${ls.bons_restant} · gaz6=${ls.gaz_stock_6}`,
  (Number(ls.ess_stock)===800&&Number(ls.bons_restant)===500000)?'✅':'⚠️')

console.log('[6] v_stock_forecast (autonomie)')
const { data: fc, error: efc } = await sb.from('v_stock_forecast').select('*').eq('station_id',s1).maybeSingle()
if (efc){ console.log('❌', efc.message); ok=false }
else console.log(`   conso essence/j≈${fc.conso_ess_jour?Math.round(fc.conso_ess_jour):'—'} L → jours_essence=${fc.jours_essence} · jours_gasoil=${fc.jours_gasoil}`, fc.jours_essence!=null?'✅':'⚠️')

console.log('[7] v_alerts station 1 (dont STOCK_BAS)')
const { data: al, error: eal } = await sb.from('v_alerts').select('type').eq('station_id',s1)
if (eal){ console.log('❌', eal.message); ok=false }
else { const t={}; al.forEach(a=>t[a.type]=(t[a.type]||0)+1); console.log('   ', JSON.stringify(t), t.STOCK_BAS?'✅ stock bas détecté':'(pas de stock bas)') }

// cleanup
await sb.from('daily_reports').delete().eq('report_date',td).eq('station_id',s1)
if (sup) await sb.from('suppliers').delete().eq('id',sup.id)
console.log('\n'+(ok?'✅ v3 multi-station opérationnelle':'⚠️ voir erreurs'))
process.exit(0)
