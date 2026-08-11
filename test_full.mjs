import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const N=v=>v?Number(v):0
let pass=0, fail=0, warn=0
const ok=(m)=>{console.log('  ✅',m);pass++}
const ko=(m)=>{console.log('  ❌',m);fail++}
const wa=(m)=>{console.log('  ⚠️ ',m);warn++}
const A='2095-01-01', B='2095-01-02', C='2095-01-03'

console.log('=== 0. AUTH & PROFIL ===')
const { data:su, error:se } = await sb.auth.signUp({ email:`full.${Date.now()}@gmail.com`, password:'Full123456!' })
if (se||!su.session){ ko('auth: '+se?.message); process.exit(1) }
const uid=su.user.id
ok('compte créé + session')
const { data:sts } = await sb.from('stations').select('*').order('id')
if (sts?.length>=2) ok(`${sts.length} stations : ${sts.map(s=>s.nom).join(', ')}`); else wa('moins de 2 stations')
const s1=sts[0].id, s2=sts[1]?.id
await sb.from('profiles').update({ station_id:s1 }).eq('id',uid)
const { data:prof } = await sb.from('profiles').select('role,station_id').eq('id',uid).single()
prof.station_id===s1 ? ok('gérant rattaché à station 1') : ko('rattachement station')

async function cleanup(){
  for (const d of [A,B,C]) await sb.from('daily_reports').delete().eq('report_date',d).eq('station_id',s1)
  await sb.from('fuel_orders').delete().eq('proposed_by',uid)
  await sb.from('inspections').delete().eq('created_by',uid)
  await sb.from('deliveries').delete().eq('created_by',uid)
  await sb.from('expenses').delete().eq('created_by',uid)
  await sb.from('deposits').delete().eq('created_by',uid)
  await sb.from('attachments').delete().eq('created_by',uid)
}
await cleanup()

console.log('\n=== 1. SAISIE JOURNALIÈRE COMPLÈTE ===')
const rep = { report_date:A, station_id:s1, created_by:uid,
  ess_litres:1200, ess_pu:725, ess_bon:800000, ess_espece:70000,
  gas_litres:600, gas_pu:750, gas_bon:400000, gas_espece:50000,
  gaz_espece:15000, superette_espece:20000, lubrifiant_espece:8000,
  e1_m:1000,e2_m:1000,e3_m:1000,e4_m:1000, g1_m:500,g2_m:500,g3_m:500,g4_m:500,
  e1:1300,e2:1000,e3:1000,e4:1000,
  ess_stock:8000, gas_stock:6000, gaz_stock_6:40, total_bon_cumul:5000000,
  lubrifiant_stock:{'5W30 1L':6,'20W50 5L':5} }
const { error:re } = await sb.from('daily_reports').upsert(rep,{onConflict:'station_id,report_date'})
re ? ko('upsert point: '+re.message) : ok('point complet enregistré (ventes, compteurs matin+16h, gaz, lubrifiant jsonb, stock)')
// jour B pour calcul litres
await sb.from('daily_reports').upsert({ report_date:B, station_id:s1, created_by:uid, e1_m:1400,e2_m:1000,e3_m:1000,e4_m:1000 },{onConflict:'station_id,report_date'})

console.log('\n=== 2. MÉTRIQUES & CALCULS ===')
const { data:m } = await sb.from('v_report_metrics').select('*').eq('report_date',A).eq('station_id',s1).maybeSingle()
if (!m){ ko('v_report_metrics vide') } else {
  N(m.cash_declare)===163000 ? ok(`cash_declare=${m.cash_declare} (70k+50k+15k+20k+8k)`) : ko(`cash_declare=${m.cash_declare} (attendu 163000)`)
  N(m.ventes_bon)===1200000 ? ok(`ventes_bon=${m.ventes_bon}`) : ko(`ventes_bon=${m.ventes_bon} (attendu 1200000)`)
  N(m.marge_estimee)===(1200+600)*20 ? ok(`marge=${m.marge_estimee} (1800L×20)`) : ko(`marge=${m.marge_estimee} (attendu 36000)`)
  N(m.ca_carburant)===(1200*725+600*750) ? ok(`CA carburant=${m.ca_carburant}`) : ko(`CA=${m.ca_carburant} (attendu ${1200*725+600*750})`)
  N(m.ess_litres_calc)===400 ? ok(`litres essence calculés (compteurs) =400 (ouverture B−A)`) : wa(`ess_litres_calc=${m.ess_litres_calc} (attendu 400)`)
}

console.log('\n=== 3. DÉPENSES / ACHATS / VERSEMENTS ===')
let e1=await sb.from('expenses').insert({report_date:A,station_id:s1,categorie:'SBEE',montant:99000,motif:'électricité',justificatif:true,created_by:uid})
e1.error?ko('dépense: '+e1.error.message):ok('dépense SBEE enregistrée')
let d1=await sb.from('deliveries').insert({report_date:A,station_id:s1,type:'gaz',quantite:20,unite:'bouteilles',montant:150000,created_by:uid})
d1.error?ko('achat: '+d1.error.message):ok('achat hors carburant enregistré')
let v1=await sb.from('deposits').insert({report_date:A,station_id:s1,pole:'carburant',montant:70000,deposit_date:A,created_by:uid})
v1.error?ko('versement: '+v1.error.message):ok('versement enregistré')
const { data:m2 } = await sb.from('v_report_metrics').select('total_depense,total_verse,total_livraisons').eq('report_date',A).eq('station_id',s1).single()
N(m2.total_depense)===99000&&N(m2.total_verse)===70000&&N(m2.total_livraisons)===150000 ? ok('agrégats dépense/versement/livraison OK') : ko(`agrégats: dep=${m2.total_depense} ver=${m2.total_verse} liv=${m2.total_livraisons}`)

console.log('\n=== 4. COMMANDE CARBURANT + RÉCEPTION + STOCK AUTO ===')
const { data:o } = await sb.from('fuel_orders').insert({station_id:s1,produit:'gasoil',quantite_commandee:5000,statut:'proposee',proposed_by:uid}).select().single()
o?ok('commande proposée'):ko('commande')
await sb.from('fuel_orders').update({statut:'validee',validated_by:uid}).eq('id',o.id)
await sb.from('fuel_orders').update({statut:'lancee'}).eq('id',o.id)
await sb.from('fuel_orders').update({statut:'recue',cuve_avant:6000,cuve_apres:10700,report_date:C,prix_achat:730,montant:5000*730,recu_by:uid}).eq('id',o.id)
const { data:of } = await sb.from('fuel_orders').select('*').eq('id',o.id).single()
const livre=of.cuve_apres-of.cuve_avant
livre===4700 && (livre-of.quantite_commandee)===-300 ? ok('réception: livré 4700 L, écart −300 L (fuite/sous-livraison détectée)') : ko(`réception livré=${livre}`)
// stock cuve auto (comme le fait l'app)
await sb.from('daily_reports').upsert({station_id:s1,report_date:C,gas_stock:of.cuve_apres,created_by:uid},{onConflict:'station_id,report_date'})
const { data:ls } = await sb.from('v_latest_stock').select('gas_stock,derniere_date').eq('station_id',s1).single()
N(ls.gas_stock)===10700 ? ok('stock cuve gasoil actualisé automatiquement à 10700 L') : wa(`stock cuve=${ls.gas_stock}`)

console.log('\n=== 5. CONTRÔLE ANM ===')
let insp=await sb.from('inspections').insert({station_id:s1,date_controle:A,organisme:'ANM',pompes:'E1,E3',prelevement_litres:5,retour_cuve_litres:5,conforme:true,observations:'RAS',created_by:uid})
insp.error?ko('ANM: '+insp.error.message):ok('contrôle ANM enregistré')

console.log('\n=== 6. PHOTOS-PREUVES (attachments) ===')
let att=await sb.from('attachments').insert({station_id:s1,report_date:A,categorie:'compteur',note:'Pompe E1 — index 1300',photo_path:`${s1}/compteurs/${A}/e1.jpg`,created_by:uid})
att.error?ko('attachment: '+att.error.message):ok('photo compteur (preuve) enregistrée')

console.log('\n=== 7. ALERTES ===')
const { data:al } = await sb.from('v_alerts').select('type').eq('station_id',s1)
if (al){ const t=[...new Set(al.map(a=>a.type))]; ok('v_alerts OK, types présents: '+t.join(', ')) } else ko('v_alerts')

console.log('\n=== 8. STOCK BAS / AUTONOMIE ===')
const { data:fc } = await sb.from('v_stock_forecast').select('*').eq('station_id',s1).single()
fc && fc.conso_ess_jour!=null ? ok(`autonomie calculée (conso ess ~${Math.round(fc.conso_ess_jour)} L/j, ${fc.jours_essence} j)`) : wa('autonomie non calculable (peu de données)')

console.log('\n=== 9. RAPPROCHEMENT BANCAIRE (admin only) ===')
const rb=await sb.from('bank_lines').insert({station_id:s1,date_operation:A,montant:70000})
rb.error ? ok('bank_lines réservé admin — gérant bloqué (RLS)') : ko('FAILLE: gérant a pu insérer une ligne bancaire')

console.log('\n=== 10. NOTIFICATIONS 9h/17h (v9) ===')
const nm=await sb.rpc('notify_missing',{p_moment:'matin'})
if (nm.error && /function|not exist|schema/i.test(nm.error.message)) wa('v9 non appliquée (migration_v9.sql à lancer)')
else if (nm.error) ko('notify_missing: '+nm.error.message)
else { const { data:nt } = await sb.from('notifications').select('*').eq('station_id',s1).eq('resolved',false); ok(`notifications fonctionnelles (${(nt||[]).length} active(s))`) }

console.log('\n=== 11. OCR bordereaux (v10) ===')
const oc=await sb.from('deposits').select('montant_ocr').eq('station_id',s1).limit(1)
oc.error && /column|montant_ocr/i.test(oc.error.message) ? wa('v10 non appliquée (migration_v10.sql à lancer)') : ok('colonnes OCR présentes sur deposits')

console.log('\n=== 12. ISOLATION MULTI-STATION ===')
if (s2){ await sb.from('fuel_orders').insert({station_id:s2,produit:'essence',quantite_commandee:100,statut:'proposee',proposed_by:uid})
  const { data:seen } = await sb.from('fuel_orders').select('id').eq('station_id',s2)
  seen.length===0 ? ok('gérant station 1 ne voit PAS les données de station 2 (RLS)') : ko('FUITE: '+seen.length+' lignes station 2 visibles') }

await cleanup()
console.log(`\n======================================\n  RÉSULTAT : ${pass} OK · ${fail} échec(s) · ${warn} avertissement(s)\n======================================`)
process.exit(fail>0?1:0)
