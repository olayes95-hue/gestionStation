import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const log = (...a)=>console.log(...a)
let step=0; const S=(t)=>log(`\n[${++step}] ${t}`)

// 1. schema present ? (probe a table)
S('Vérif schéma — table daily_reports')
{
  const { error } = await sb.from('daily_reports').select('report_date',{count:'exact',head:true})
  if (error && /does not exist|schema cache/i.test(error.message)) { log('❌ Tables absentes → schema.sql pas encore exécuté dans Supabase.\n   Erreur:',error.message); process.exit(1) }
  log('✅ Table daily_reports accessible (RLS active).')
}

// 2. auth — sign up test user
S('Auth — création compte test')
const email=`station.qa.${Date.now()}@gmail.com`, password='Test123456!'
let { data: su, error: se } = await sb.auth.signUp({ email, password, options:{ data:{ full_name:'Test Auto' } } })
if (se) { log('❌ signUp:',se.message); process.exit(1) }
if (!su.session) {
  log('⚠️ Pas de session immédiate → "Confirm email" est ACTIVÉ dans Supabase.')
  log('   Pour un test complet, désactive-le : Supabase > Authentication > Providers > Email > décoche "Confirm email".')
  log('   (Je continue les tests en mode non authentifié — lecture des données bloquée par RLS, c’est normal.)')
} else {
  log('✅ Compte créé + session obtenue (confirmation email désactivée).')
}

const authed = !!su.session

// 3. profil auto-créé ?
if (authed) {
  S('Trigger — profil auto-créé')
  const { data: p } = await sb.from('profiles').select('*').eq('id', su.user.id).maybeSingle()
  log(p ? `✅ Profil créé, rôle="${p.role}"` : '❌ Profil non créé (trigger handle_new_user manquant ?)')
}

// 4. lecture données historiques (seed) — nécessite auth
S('Données historiques (seed)')
if (authed) {
  const { count: nrep } = await sb.from('daily_reports').select('*',{count:'exact',head:true})
  const { count: ndep } = await sb.from('deposits').select('*',{count:'exact',head:true})
  log(`   daily_reports: ${nrep} | deposits: ${ndep}`)
  if (nrep>0) log('✅ Historique présent.'); else log('⚠️ 0 rapport → seed_from_audit.sql pas exécuté (ou RLS).')
} else log('   (sauté : non authentifié)')

// 5. vues métriques + alertes
S('Vues v_report_metrics / v_alerts')
if (authed) {
  const { data: m, error: em } = await sb.from('v_report_metrics').select('report_date,cash_declare,total_verse').order('report_date',{ascending:false}).limit(3)
  if (em) log('❌ v_report_metrics:',em.message); else log('✅ v_report_metrics OK, 3 derniers:',m.map(x=>x.report_date).join(', '))
  const { data: al, error: ea } = await sb.from('v_alerts').select('*').limit(5)
  if (ea) log('❌ v_alerts:',ea.message); else log(`✅ v_alerts OK — ${al.length>0?al.length+'+ alertes détectées, ex: '+al[0].type:'0 alerte'}`)
} else log('   (sauté : non authentifié)')

// 6. insertion d'un point de test + alerte
if (authed) {
  S('Insertion d’un point test (déclenche une alerte versement manquant)')
  const td = '2099-01-01'
  await sb.from('daily_reports').delete().eq('report_date', td)
  const { error: ei } = await sb.from('daily_reports').insert({ report_date: td, ess_espece: 50000, created_by: su.user.id })
  if (ei) log('❌ insert:',ei.message)
  else {
    const { data: al2 } = await sb.from('v_alerts').select('*').eq('report_date', td)
    log(`✅ Point inséré. Alertes générées pour ${td}: ${(al2||[]).map(a=>a.type).join(', ')||'aucune'}`)
    await sb.from('daily_reports').delete().eq('report_date', td)
    log('   (nettoyé)')
  }
}

// 7. storage bucket
S('Storage — bucket "bordereaux"')
{
  const { data, error } = await sb.storage.from('bordereaux').list('', { limit: 1 })
  if (error) log('⚠️ bucket "bordereaux":',error.message,'(à créer dans Storage si absent)')
  else log('✅ bucket "bordereaux" accessible.')
}

log('\n=== FIN DU TEST ===')
process.exit(0)
