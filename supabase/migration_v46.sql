-- ============================================================
--  MIGRATION v46 — Nombre de machines par station configurable (jusqu'à 10).
--
--  Jusqu'ici, exactement 4 pompes essence (E1-E4) + 4 pompes gasoil
--  (G1-G4) étaient câblées en dur (colonnes fixes de daily_reports).
--  Certaines stations ont plus de 4 machines : on étend le modèle à
--  10 pompes essence + 10 gasoil (colonnes nullables, aucun impact sur
--  les stations qui n'en utilisent que 4 — les colonnes e5..e10/g5..g10
--  restent NULL pour elles) et on ajoute un réglage par station pour
--  choisir combien sont réellement affichées/obligatoires.
--
--  v_report_metrics est la SEULE vue qui lit les colonnes individuelles
--  (elle somme les relevés du matin pour calculer les litres vendus) —
--  recréée pour inclure e5_m..e10_m / g5_m..g10_m. Toutes les autres
--  vues (v_alerts, v_stock_recon, etc.) sont en aval et n'ont pas besoin
--  d'être touchées.
--
--  À exécuter dans Supabase > SQL Editor > Run (après v45). Idempotente.
-- ============================================================

-- ── 1. Colonnes compteurs supplémentaires (E5-E10, G5-G10, relevés 16h + matin) ──
alter table daily_reports add column if not exists e5 numeric;
alter table daily_reports add column if not exists e6 numeric;
alter table daily_reports add column if not exists e7 numeric;
alter table daily_reports add column if not exists e8 numeric;
alter table daily_reports add column if not exists e9 numeric;
alter table daily_reports add column if not exists e10 numeric;
alter table daily_reports add column if not exists g5 numeric;
alter table daily_reports add column if not exists g6 numeric;
alter table daily_reports add column if not exists g7 numeric;
alter table daily_reports add column if not exists g8 numeric;
alter table daily_reports add column if not exists g9 numeric;
alter table daily_reports add column if not exists g10 numeric;
alter table daily_reports add column if not exists e5_m numeric;
alter table daily_reports add column if not exists e6_m numeric;
alter table daily_reports add column if not exists e7_m numeric;
alter table daily_reports add column if not exists e8_m numeric;
alter table daily_reports add column if not exists e9_m numeric;
alter table daily_reports add column if not exists e10_m numeric;
alter table daily_reports add column if not exists g5_m numeric;
alter table daily_reports add column if not exists g6_m numeric;
alter table daily_reports add column if not exists g7_m numeric;
alter table daily_reports add column if not exists g8_m numeric;
alter table daily_reports add column if not exists g9_m numeric;
alter table daily_reports add column if not exists g10_m numeric;

-- ── 2. Réglage par station : combien de machines sont réellement utilisées (1 à 10) ──
alter table stations add column if not exists nombre_machines integer not null default 4;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='nombre_machines_range') then
    alter table stations add constraint nombre_machines_range check (nombre_machines between 1 and 10);
  end if;
end $$;

-- ── 3. v_report_metrics : élargit e_open/g_open aux relevés matin des machines 5-10 ──
create or replace view v_report_metrics as
with base as (
  select r.*,
    coalesce(ess_espece,0)+coalesce(gas_espece,0)+coalesce(gaz_espece,0)
      +coalesce(superette_espece,0)+coalesce(lubrifiant_espece,0) as cash_declare,
    coalesce(ess_bon,0)+coalesce(gas_bon,0) as ventes_bon,
    coalesce(e1_m,0)+coalesce(e2_m,0)+coalesce(e3_m,0)+coalesce(e4_m,0)
      +coalesce(e5_m,0)+coalesce(e6_m,0)+coalesce(e7_m,0)+coalesce(e8_m,0)+coalesce(e9_m,0)+coalesce(e10_m,0) as e_open,
    coalesce(g1_m,0)+coalesce(g2_m,0)+coalesce(g3_m,0)+coalesce(g4_m,0)
      +coalesce(g5_m,0)+coalesce(g6_m,0)+coalesce(g7_m,0)+coalesce(g8_m,0)+coalesce(g9_m,0)+coalesce(g10_m,0) as g_open
  from daily_reports r),
withlead as (
  select *,
    lead(e_open) over (partition by station_id order by report_date) as e_open_next,
    lead(g_open) over (partition by station_id order by report_date) as g_open_next,
    lead(report_date) over (partition by station_id order by report_date) as next_date
  from base),
calc as (
  select *,
    case when next_date = report_date + 1 and e_open>0 and e_open_next>=e_open and (e_open_next - e_open) < 30000 then e_open_next - e_open end as ess_litres_calc,
    case when next_date = report_date + 1 and g_open>0 and g_open_next>=g_open and (g_open_next - g_open) < 30000 then g_open_next - g_open end as gas_litres_calc
  from withlead)
select c.*,
  coalesce(c.ess_litres, c.ess_litres_calc) as ess_litres_retenu,
  coalesce(c.gas_litres, c.gas_litres_calc) as gas_litres_retenu,
  (coalesce(c.ess_litres,0) + coalesce(c.gas_litres,0))
    * (select marge_unitaire from settings where id=1) as marge_estimee,
  coalesce(c.ess_litres,0) * coalesce(c.ess_pu,0)
    + coalesce(c.gas_litres,0) * coalesce(c.gas_pu,0) as ca_carburant,
  (select coalesce(sum(montant),0) from expenses e
     where e.report_date=c.report_date and e.station_id=c.station_id and coalesce(e.non_cash,false)=false) as total_depense,
  (select coalesce(sum(montant),0) from deposits d
     where d.station_id=c.station_id and coalesce(d.periode_fin, d.deposit_date, d.report_date)=c.report_date) as total_verse,
  (select coalesce(sum(montant),0) from deliveries l where l.report_date=c.report_date and l.station_id=c.station_id) as total_livraisons
from calc c;

grant select on v_report_metrics to authenticated, anon;
