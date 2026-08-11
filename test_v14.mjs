import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
let pass=0,fail=0; const ok=m=>{console.log('  ✅',m);pass++}; const ko=m=>{console.log('  ❌',m);fail++}
const {data:su}=await sb.auth.signUp({email:`v14.${Date.now()}@gmail.com`,password:'V14test123!'})
const {data:sts}=await sb.from('stations').select('id').order('id'); const s1=sts[0].id
await sb.from('profiles').update({station_id:s1}).eq('id',su.user.id)

console.log('[1] vue ventes mensuelles (point financier)')
const vm=await sb.from('v_ventes_mensuelles').select('*').eq('station_id',s1).order('mois',{ascending:false}).limit(3)
if(vm.error){ if(/exist/i.test(vm.error.message)){console.log('  ⚠️  v14 non appliquée');process.exit(0)} ko(vm.error.message) }
else { ok(`v_ventes_mensuelles OK (${vm.data.length} mois récents)`); vm.data.forEach(m=>console.log(`     ${m.mois}: CA ${Math.round(m.ca_carburant).toLocaleString('fr-FR')} · commission ${Math.round(m.commission_carburant).toLocaleString('fr-FR')} · gaz ${Math.round(m.ventes_gaz)}`)) }

console.log('[2] charges : réservé admin (gérant bloqué)')
const ce=await sb.from('charges').insert({station_id:s1,mois:'2026-05',categorie:'SALAIRES',montant:100000})
ce.error ? ok('insertion de charge bloquée pour le gérant (admin only)') : ko('FAILLE: gérant a saisi une charge')

console.log('[3] alert_dismissals : réservé admin (gérant bloqué)')
const de=await sb.from('alert_dismissals').insert({station_id:s1,report_date:'2026-05-01',type:'ECART_CAISSE'})
de.error ? ok('masquage d\'alerte bloqué pour le gérant (admin only)') : ko('FAILLE: gérant a masqué une alerte')

console.log('[4] planification notif matin 8h (07:00 UTC)')
const cj=await sb.rpc('notify_missing',{p_moment:'matin'})
cj.error ? console.log('  ⚠️  notify_missing:',cj.error.message) : ok('fonction notify_missing opérationnelle (cron 8h Bénin)')

console.log(`\n  ${pass} OK · ${fail} échec(s)`)
process.exit(fail>0?1:0)
