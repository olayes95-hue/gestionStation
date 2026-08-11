import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
let pass=0,fail=0; const ok=m=>{console.log('  ✅',m);pass++}; const ko=m=>{console.log('  ❌',m);fail++}
const {data:su}=await sb.auth.signUp({email:`v20.${Date.now()}@gmail.com`,password:'V20test123!'})
const {data:sts}=await sb.from('stations').select('id').order('id'); const s1=sts[0].id
await sb.from('profiles').update({station_id:s1}).eq('id',su.user.id)

console.log('[1] Réglages (marge 25 + taux commissions + seuil perte)')
const {data:st}=await sb.from('settings').select('*').eq('id',1).single()
console.log(`   marge=${st.marge_unitaire} taux_gaz=${st.taux_gaz} taux_superette=${st.taux_superette} perte=${st.taux_perte_acceptable}`)
;(Number(st.marge_unitaire)===25 && st.taux_gaz!=null && st.taux_superette!=null && st.taux_perte_acceptable!=null)?ok('réglages OK'):ko('réglages incomplets')

console.log('[2] Références lubrifiant (dont 20W50 1L)')
const {data:lt}=await sb.from('lubrifiant_types').select('nom').order('ordre')
const has=(lt||[]).some(x=>x.nom==='20W50 1L')
console.log('   références:',(lt||[]).length,'· 20W50 1L présent:',has)
has?ok('lubrifiants OK'):ko('20W50 1L manquant')

console.log('[3] Colonnes commandes (chèque + dates)')
const oc=await sb.from('fuel_orders').select('cheque_montant,cheque_ref,date_proposition,date_lancement').limit(1)
oc.error?ko('colonnes commande: '+oc.error.message):ok('cheque_montant, cheque_ref, date_proposition, date_lancement présentes')

console.log('[4] Colonne photo justificatif (dépenses)')
const ec=await sb.from('expenses').select('photo_path').limit(1)
ec.error?ko(ec.error.message):ok('expenses.photo_path présente')

console.log('[5] Vues financières & contrôles')
for (const v of ['v_ventes_mensuelles','v_pertes_livraison','v_pertes_mensuelles','v_bons_baisses','v_bons_hausses']) {
  const r=await sb.from(v).select('*').limit(1)
  r.error?ko(v+': '+r.error.message):ok(v+' OK')
}

console.log('[6] Alertes — types disponibles')
const {data:al,error:ea}=await sb.from('v_alerts').select('type').eq('station_id',s1)
if(ea)ko('v_alerts: '+ea.message)
else{ const t=[...new Set(al.map(a=>a.type))]; console.log('   types:',t.join(', ')); ok(`v_alerts OK (${al.length} alertes)`) }

console.log('[7] Sécurité charges (admin only)')
const ce=await sb.from('charges').insert({station_id:s1,mois:'2026-05',categorie:'LOYER',montant:100000})
ce.error?ok('charges réservé admin (gérant bloqué)'):ko('FAILLE: gérant a saisi une charge')

console.log(`\n  ${pass} OK · ${fail} échec(s)`)
process.exit(fail>0?1:0)
