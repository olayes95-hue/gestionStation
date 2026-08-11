import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const AUDIT = '/Users/olaitany/Downloads/Dev & Archives/WhatsApp Chat - Station/AUDIT_STATION'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

function csv(path){
  const lines = readFileSync(path,'utf8').trim().split('\n')
  const head = lines[0].split(',')
  return lines.slice(1).map(l=>{ const c=l.split(','); return Object.fromEntries(head.map((h,i)=>[h,c[i]])) })
}
const n = v => (v===''||v===undefined||v===null||isNaN(v)) ? null : Number(v)

// authenticate (RLS allows authenticated insert)
const email=`seed.loader.${Date.now()}@gmail.com`
const { data: su, error: se } = await sb.auth.signUp({ email, password:'Seed123456!' })
if (se || !su.session){ console.log('❌ auth loader:', se?.message || 'pas de session (réactive Confirm email OFF)'); process.exit(1) }
const uid = su.user.id
console.log('✅ authentifié pour le chargement')

// clear then load daily_reports
const led = csv(`${AUDIT}/01_ledger_quotidien.csv`)
const reports = led.map(r=>({
  report_date: r.date,
  ess_litres: n(r.ess_litres), ess_pu: n(r.ess_PU),
  ess_bon: n(r.ventes_BON), ess_espece: n(r.ventes_ESPECE),
  gas_litres: n(r.gas_litres), gas_pu: n(r.gas_PU),
  total_bon_cumul: n(r.bons_en_cours_cumul), created_by: uid,
}))
{
  const { error } = await sb.from('daily_reports').upsert(reports, { onConflict:'report_date' })
  if (error){ console.log('❌ daily_reports:', error.message); process.exit(1) }
  console.log(`✅ ${reports.length} rapports chargés`)
}

// deposits
const dep = csv(`${AUDIT}/07_versements_detail.csv`)
const deposits = dep.map(r=>{
  const rd = (r.jour_recette_correspondant && r.jour_recette_correspondant!=='') ? r.jour_recette_correspondant : r.date_versement
  const pole = ['carburant','gaz','superette','lubrifiant'].includes(r.pole)? r.pole : 'carburant'
  return rd ? { report_date: rd, pole, montant: n(r.montant), deposit_date: r.date_versement||null, ref_bordereau: r.fichier||null, created_by: uid } : null
}).filter(Boolean).filter(d=>d.montant)
{
  const { error } = await sb.from('deposits').insert(deposits)
  if (error){ console.log('❌ deposits:', error.message); process.exit(1) }
  console.log(`✅ ${deposits.length} versements chargés`)
}

// verify
const { count: nr } = await sb.from('daily_reports').select('*',{count:'exact',head:true})
const { count: nd } = await sb.from('deposits').select('*',{count:'exact',head:true})
const { data: al } = await sb.from('v_alerts').select('type')
const { data: m } = await sb.from('v_report_metrics').select('cash_declare,total_verse,ventes_bon')
const sum=(k)=>m.reduce((s,x)=>s+Number(x[k]||0),0)
console.log(`\n=== VÉRIFICATION ===`)
console.log(`daily_reports: ${nr} | deposits: ${nd}`)
console.log(`Ventes bon cumulées: ${sum('ventes_bon').toLocaleString('fr-FR')} F`)
console.log(`Espèces cumulées:    ${sum('cash_declare').toLocaleString('fr-FR')} F`)
console.log(`Versé cumulé:        ${sum('total_verse').toLocaleString('fr-FR')} F`)
console.log(`Alertes générées:    ${al.length}`)
const byType={}; al.forEach(a=>byType[a.type]=(byType[a.type]||0)+1)
console.log('  par type:', JSON.stringify(byType))
process.exit(0)
