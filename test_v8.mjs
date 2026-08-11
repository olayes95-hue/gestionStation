import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su } = await sb.auth.signUp({ email:`v8.${Date.now()}@gmail.com`, password:'V8test123!' })
const uid=su.user.id
const { data: sts } = await sb.from('stations').select('id').order('id'); const s1=sts[0].id
await sb.from('profiles').update({ station_id:s1 }).eq('id',uid)

console.log('[1] prix d\'achat paramétrés')
const { data:st } = await sb.from('settings').select('essence_pa,gasoil_pa,essence_pv,gasoil_pv').eq('id',1).single()
console.log(`   achat essence=${st.essence_pa} gasoil=${st.gasoil_pa} · vente essence=${st.essence_pv} gasoil=${st.gasoil_pv}`, (st.gasoil_pa!=null&&st.essence_pa!=null)?'✅':'❌')

console.log('[2] commande rattachée au jour + coût d\'achat à la réception')
const { data:o } = await sb.from('fuel_orders').insert({ station_id:s1, produit:'gasoil', quantite_commandee:5000, statut:'lancee', proposed_by:uid }).select().single()
const prix = st.gasoil_pa
await sb.from('fuel_orders').update({ statut:'recue', cuve_avant:5000, cuve_apres:9800, report_date:'2097-08-08', prix_achat:prix, montant:5000*prix, recu_by:uid, recu_at:new Date().toISOString() }).eq('id',o.id)
const { data:f } = await sb.from('fuel_orders').select('*').eq('id',o.id).single()
console.log(`   report_date=${f.report_date} · prix_achat=${f.prix_achat} · montant=${f.montant} (attendu ${5000*prix}) · livré=${f.cuve_apres-f.cuve_avant}L`,
  (f.report_date==='2097-08-08' && Number(f.montant)===5000*prix)?'✅':'⚠️')

await sb.from('fuel_orders').delete().eq('id',o.id)
console.log('\n✅ test v8 terminé')
process.exit(0)
