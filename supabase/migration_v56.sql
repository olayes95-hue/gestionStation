-- ============================================================
--  MIGRATION v56 — Solde de bons CALCULÉ indépendamment de la
--  déclaration du gérant, + alerte si les deux divergent.
--
--  Constat (Beaurivage) : total_bon_cumul est un cumul que le gérant
--  déclare chaque matin de son côté, qui ne fait QUE monter (jamais
--  ajusté manuellement après une commande) — alors que l'ancien calcul
--  de bons_restant supposait l'inverse (ne soustrayait une commande que
--  si elle datait d'APRÈS la dernière déclaration, en pariant que la
--  déclaration suivante intégrerait déjà la dépense). Résultat : des
--  commandes lancées avec des bons n'étaient jamais déduites.
--
--  Nouveau modèle : deux pistes indépendantes qui doivent normalement
--  converger —
--   - déclaré  : total_bon_cumul le plus récent saisi par le gérant.
--   - calculé  : première déclaration connue (point de départ) + ventes
--                à bon (ess_bon+gas_bon) déclarées depuis + bons dépensés
--                sur les commandes lancées (non annulées) depuis.
--  Le solde calculé remplace bons_restant (v_latest_stock) partout où
--  il est déjà affiché. Une alerte BONS_INEXPLIQUES se déclenche si
--  calculé et déclaré s'écartent de plus de 1000 F.
--
--  À exécuter dans Supabase > SQL Editor > Run (après v55). Idempotente.
-- ============================================================

create or replace view v_bons_calcule as
with premiere as (
  select distinct on (station_id) station_id, report_date as date_ref, total_bon_cumul as solde_ref
  from daily_reports
  where total_bon_cumul is not null
  order by station_id, report_date asc
),
derniere as (
  select distinct on (station_id) station_id, report_date as date_declare, total_bon_cumul as solde_declare
  from daily_reports
  where total_bon_cumul is not null
  order by station_id, report_date desc
),
entrees as (
  select d.station_id, sum(coalesce(d.ess_bon,0)+coalesce(d.gas_bon,0)) as total_entrees
  from daily_reports d
  join premiere p on p.station_id = d.station_id
  where d.report_date > p.date_ref
  group by d.station_id
),
sorties as (
  select o.station_id, sum(case
      when o.categorie = 'carburant' then coalesce(o.bons_base,0)
      when o.categorie in ('gaz','lubrifiant') and o.mode_paiement = 'bons' then coalesce(o.montant_paiement,0)
      else 0 end) as total_sorties
  from fuel_orders o
  join premiere p on p.station_id = o.station_id
  where o.date_lancement is not null and o.statut <> 'annulee' and o.date_lancement > p.date_ref
  group by o.station_id
)
select p.station_id, p.date_ref, p.solde_ref,
  p.solde_ref + coalesce(e.total_entrees,0) - coalesce(s.total_sorties,0) as solde_calcule,
  coalesce(e.total_entrees,0) as total_entrees,
  coalesce(s.total_sorties,0) as total_sorties,
  d.date_declare, d.solde_declare,
  (p.solde_ref + coalesce(e.total_entrees,0) - coalesce(s.total_sorties,0)) - d.solde_declare as ecart
from premiere p
left join entrees e on e.station_id = p.station_id
left join sorties s on s.station_id = p.station_id
left join derniere d on d.station_id = p.station_id;

grant select on v_bons_calcule to authenticated, anon;

-- ── v_latest_stock : bons_restant/bons_utilises_depuis viennent désormais du calcul
--    indépendant ci-dessus (colonnes existantes intactes, même nom/ordre qu'avant) ──
create or replace view v_latest_stock as
select s.id as station_id, s.nom, s.seuil_essence, s.seuil_gasoil,
  (select report_date from daily_reports r where r.station_id=s.id order by report_date desc limit 1) as derniere_date,
  (select ess_stock from daily_reports r where r.station_id=s.id and ess_stock is not null order by report_date desc limit 1) as ess_stock,
  (select gas_stock from daily_reports r where r.station_id=s.id and gas_stock is not null order by report_date desc limit 1) as gas_stock,
  bc.solde_calcule as bons_restant,
  (select gaz_stock_3 from daily_reports r where r.station_id=s.id and gaz_stock_3 is not null order by report_date desc limit 1) as gaz_stock_3,
  (select gaz_stock_6 from daily_reports r where r.station_id=s.id and gaz_stock_6 is not null order by report_date desc limit 1) as gaz_stock_6,
  (select gaz_stock_12 from daily_reports r where r.station_id=s.id and gaz_stock_12 is not null order by report_date desc limit 1) as gaz_stock_12,
  (select gaz_stock_38 from daily_reports r where r.station_id=s.id and gaz_stock_38 is not null order by report_date desc limit 1) as gaz_stock_38,
  (select lubrifiant_stock from daily_reports r where r.station_id=s.id and lubrifiant_stock is not null order by report_date desc limit 1) as lubrifiant_stock,
  bc.total_sorties as bons_utilises_depuis
from stations s
left join v_bons_calcule bc on bc.station_id = s.id;

grant select on v_latest_stock to authenticated, anon;

-- ── v_alerts : ajoute BONS_INEXPLIQUES en dernier (union all, colonnes déjà identiques) ──
create or replace view v_alerts as
-- a) écart de versement sur une période clôturée
select station_id, periode_fin as report_date, 'VERSEMENT_INCOMPLET'::text as type, 'haute'::text as gravite,
  case when pole_groupe='carburant'
    then 'carburant : (espèce '||round(recette_periode)||' − dépenses '||round(depense_periode)||') ≠ versé '||round(verse)||' → écart '||round(ecart)||' F'
    else pole_groupe||' : recette '||round(recette_periode)||' ≠ versé '||round(verse)||' → écart '||round(ecart)||' F' end as detail
from v_verse_recon where ecart > 1000
union all
-- b) recette non couverte > 3 jours
select r.station_id, r.report_date, 'VERSEMENT_MANQUANT', 'haute',
  'Recette '||r.pole_groupe||' '||round(r.espece)||' F non versée (aucune période ne la couvre, > 3 j)'
from v_recette_groupe_jour r
where r.espece > 1000 and r.report_date < current_date - 3
  and not exists (select 1 from v_verse_groupe g
    where g.station_id=r.station_id and g.pole_groupe=r.pole_groupe
      and r.report_date between g.periode_debut and g.periode_fin)
union all
-- c) dépense non justifiée
select e.station_id, e.report_date, 'DEPENSE_NON_JUSTIFIEE','moyenne',
  'Dépense '||e.categorie||' '||round(e.montant)||' F sans justificatif/motif'
from expenses e where e.justificatif = false or e.motif is null or e.motif=''
union all
-- d) écart compteur RÉEL (mouvement backward vs déclaré)
select station_id, report_date, 'ECART_COMPTEUR','moyenne',
  'Essence: compteurs '||round(ess_mouvement)||' L vs déclaré '||round(ess_litres)||' L'
from v_stock_recon
where ess_mouvement is not null and ess_litres is not null and abs(ess_mouvement - ess_litres) > 100
union all
select station_id, report_date, 'ECART_COMPTEUR','moyenne',
  'Gasoil: compteurs '||round(gas_mouvement)||' L vs déclaré '||round(gas_litres)||' L'
from v_stock_recon
where gas_mouvement is not null and gas_litres is not null and abs(gas_mouvement - gas_litres) > 100
union all
-- d') relevé compteur du matin non mis à jour (index identique à la veille)
select station_id, report_date, 'RELEVE_COMPTEUR_MANQUANT','moyenne',
  'Relevé compteur essence du '||to_char(report_date,'DD/MM')||' non mis à jour (index identique à la veille) — impossible de vérifier les '||round(ess_litres)||' L déclarés'
from v_stock_recon
where prev_date = report_date - 1 and ess_litres is not null and ess_litres > 100 and coalesce(e_open,0) <= coalesce(e_open_prev,0)
union all
select station_id, report_date, 'RELEVE_COMPTEUR_MANQUANT','moyenne',
  'Relevé compteur gasoil du '||to_char(report_date,'DD/MM')||' non mis à jour (index identique à la veille) — impossible de vérifier les '||round(gas_litres)||' L déclarés'
from v_stock_recon
where prev_date = report_date - 1 and gas_litres is not null and gas_litres > 100 and coalesce(g_open,0) <= coalesce(g_open_prev,0)
union all
-- e) stock carburant bas
select f.station_id, l.derniere_date, 'STOCK_BAS','haute',
  'Essence: '||round(coalesce(l.ess_stock,0))||' L (~'||coalesce(f.jours_essence,0)||' j) < seuil '||round(l.seuil_essence)||' L'
from v_stock_forecast f join v_latest_stock l on l.station_id=f.station_id
where l.ess_stock is not null and l.ess_stock < l.seuil_essence
union all
select f.station_id, l.derniere_date, 'STOCK_BAS','haute',
  'Gasoil: '||round(coalesce(l.gas_stock,0))||' L (~'||coalesce(f.jours_gasoil,0)||' j) < seuil '||round(l.seuil_gasoil)||' L'
from v_stock_forecast f join v_latest_stock l on l.station_id=f.station_id
where l.gas_stock is not null and l.gas_stock < l.seuil_gasoil
union all
-- f) ANTI-COULAGE carburant (backward) : seulement si le résultat est PLAUSIBLE
select station_id, report_date, 'ECART_STOCK','haute',
  'Essence: cuve déclarée '||round(ess_stock)||' L vs attendue '||round(ess_attendu)||' L → écart '||round(ecart_ess)||' L (fuite/vol ?)'
from v_stock_recon
where ecart_ess is not null and abs(ecart_ess) > 300
  and ess_attendu >= 0 and ess_stock >= 0 and coalesce(ess_retenu,0) <= 30000 and abs(ecart_ess) <= 20000
union all
select station_id, report_date, 'ECART_STOCK','haute',
  'Gasoil: cuve déclarée '||round(gas_stock)||' L vs attendue '||round(gas_attendu)||' L → écart '||round(ecart_gas)||' L (fuite/vol ?)'
from v_stock_recon
where ecart_gas is not null and abs(ecart_gas) > 300
  and gas_attendu >= 0 and gas_stock >= 0 and coalesce(gas_retenu,0) <= 30000 and abs(ecart_gas) <= 20000
union all
-- f') DONNÉES INCOHÉRENTES : résultat physiquement impossible → vérifier (pas une fuite)
select station_id, report_date, 'DONNEES_INCOHERENTES','moyenne',
  'Essence: relevés compteur/cuve incohérents le '||to_char(report_date,'DD/MM')||' — ventes '||round(coalesce(ess_retenu,0))||' L, cuve attendue '||round(ess_attendu)||' L. Vérifie les index compteurs et la cuve (ce n''est pas une fuite).'
from v_stock_recon
where ecart_ess is not null and (ess_attendu < 0 or coalesce(ess_retenu,0) > 30000 or abs(ecart_ess) > 20000)
union all
select station_id, report_date, 'DONNEES_INCOHERENTES','moyenne',
  'Gasoil: relevés compteur/cuve incohérents le '||to_char(report_date,'DD/MM')||' — ventes '||round(coalesce(gas_retenu,0))||' L, cuve attendue '||round(gas_attendu)||' L. Vérifie les index compteurs et la cuve (ce n''est pas une fuite).'
from v_stock_recon
where ecart_gas is not null and (gas_attendu < 0 or coalesce(gas_retenu,0) > 30000 or abs(ecart_gas) > 20000)
union all
-- g) point du jour manquant
select s.id as station_id, d::date as report_date, 'POINT_MANQUANT','moyenne',
  'Aucun point saisi ce jour-là' as detail
from stations s
cross join generate_series(current_date - interval '14 day', current_date - interval '1 day', interval '1 day') d
where not exists (select 1 from daily_reports r where r.station_id=s.id and r.report_date = d::date)
  and exists (select 1 from daily_reports r2 where r2.station_id=s.id and r2.report_date < d::date)
union all
-- h) NOUVEAU (v56) : écart entre le solde de bons CALCULÉ (activité réelle : ventes à bon −
--    bons dépensés en commandes, depuis la première déclaration) et le solde DÉCLARÉ par le
--    gérant — les deux devraient normalement converger. Réutilise BONS_INEXPLIQUES (type déjà
--    présent dans src/lib/tones.js, orphelin depuis le retrait de l'ancienne logique en v31_v40).
select station_id, date_declare as report_date, 'BONS_INEXPLIQUES', 'haute',
  'Bons : calculé '||round(solde_calcule)||' F vs déclaré '||round(solde_declare)||' F → écart '||round(ecart)||' F'
from v_bons_calcule
where solde_declare is not null and abs(ecart) > 1000;

grant select on v_alerts to authenticated, anon;
