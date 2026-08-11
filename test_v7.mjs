import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data: su } = await sb.auth.signUp({ email:`v7.${Date.now()}@gmail.com`, password:'V7test123!' })
const uid=su.user.id
const { data: sts } = await sb.from('stations').select('id').order('id'); const s1=sts[0].id, s2=sts[1]?.id
await sb.from('profiles').update({ station_id:s1 }).eq('id',uid)

console.log('[1] cycle commande : proposée → validée → lancée → reçue')
const { data:o, error:oe } = await sb.from('fuel_orders').insert({ station_id:s1, produit:'gasoil', quantite_commandee:5000, bons_base:3650000, statut:'proposee', proposed_by:uid }).select().single()
if (oe){ console.log('❌ insert:', oe.message); process.exit(1) }
await sb.from('fuel_orders').update({ statut:'validee', validated_by:uid, validated_at:new Date().toISOString() }).eq('id',o.id)
await sb.from('fuel_orders').update({ statut:'lancee', lancee_at:new Date().toISOString() }).eq('id',o.id)
// réception : cuve 5000 → 9700 = 4700 L livrés pour 5000 commandés → écart -300 (fuite/sous-livraison)
await sb.from('fuel_orders').update({ statut:'recue', cuve_avant:5000, cuve_apres:9700, recu_by:uid, recu_at:new Date().toISOString() }).eq('id',o.id)
const { data:fin } = await sb.from('fuel_orders').select('*').eq('id',o.id).single()
const livre = fin.cuve_apres - fin.cuve_avant, ecart = livre - fin.quantite_commandee
console.log(`   statut=${fin.statut} · commandé=${fin.quantite_commandee} · livré réel=${livre} · écart=${ecart} L`, (fin.statut==='recue'&&livre===4700&&ecart===-300)?'✅ écart détectable':'⚠️')

console.log('[2] contrôle ANM')
const { data:insp, error:ie } = await sb.from('inspections').insert({ station_id:s1, date_controle:'2097-07-07', organisme:'ANM', pompes:'E1, E3', prelevement_litres:5, retour_cuve_litres:5, conforme:true, observations:'RAS, pompes conformes' }).select().single()
console.log('   ', ie?('❌ '+ie.message):`✅ contrôle ${insp.organisme} enregistré (conforme=${insp.conforme})`)

console.log('[3] cloisonnement station')
const { error:xe } = await sb.from('fuel_orders').insert({ station_id:s2, produit:'essence', quantite_commandee:1000, statut:'proposee', proposed_by:uid })
const { data:seen } = await sb.from('fuel_orders').select('id').eq('station_id',s2)
console.log('   commandes station 2 visibles par gérant station 1 :', seen.length===0?'✅ aucune (RLS)':'⚠️ '+seen.length)

// cleanup
await sb.from('fuel_orders').delete().eq('id',o.id)
if (insp) await sb.from('inspections').delete().eq('id',insp.id)
console.log('\n✅ test v7 terminé')
process.exit(0)
