-- ============================================================
--  MIGRATION v96 — Une dépense peut être payée depuis N'IMPORTE QUELLE
--  caisse (pôle), parfois une combinaison de plusieurs — jusqu'ici le calcul
--  (alertes VERSEMENT_INCOMPLET/MANQUANT ET l'affichage "Manque à verser
--  par pôle") supposait que TOUTE dépense en espèces sortait de la caisse
--  carburant (sauf SUPERETTE, déduite de la supérette) — une hypothèse
--  fausse en pratique, qui faussait le manque réel affiché par pôle (le
--  total global reste juste, seule la répartition l'était pas).
--
--  1) expenses.pole_split jsonb : répartition {"carburant": 6000, "gaz_lub": 4000, ...}.
--     NULL pour les dépenses existantes (et le cas simple non renseigné) —
--     dans ce cas on retombe sur l'ancienne hypothèse par catégorie (le
--     comportement d'avant est préservé, rien ne casse pour l'historique).
--
--  2) Catalogue de libellés de dépense (expense_categories), modifiable par
--     l'admin, pour remplacer la liste figée dans le code (SBEE/SUPERETTE/
--     CARBURANT/AUTRE) — ajoute SONEB, et permet d'en créer d'autres.
--
--  3) v_recette_groupe_jour recalculée : le "depense" par pôle vient
--     maintenant de pole_split (déplié via jsonb_each_text) au lieu d'être
--     attribué à 100 % au carburant.
-- ============================================================

alter table expenses add column if not exists pole_split jsonb;

create table if not exists expense_categories (
  id bigint generated always as identity primary key,
  key text not null unique,              -- valeur stockée dans expenses.categorie
  label text not null,
  non_cash boolean not null default false,  -- true seulement pour le prélèvement carburant propriétaire
  defaut_pole text,                      -- pôle suggéré par défaut à la saisie (carburant/gaz_lub/superette)
  is_system boolean not null default false,
  actif boolean not null default true,
  ordre int not null default 100,
  created_at timestamptz default now()
);

insert into expense_categories (key, label, non_cash, defaut_pole, is_system, ordre) values
  ('SBEE', 'SBEE', false, 'carburant', true, 10),
  ('SONEB', 'SONEB', false, 'carburant', true, 20),
  ('SUPERETTE', 'SUPERETTE', false, 'superette', true, 30),
  ('CARBURANT', 'Carburant / déplacement (propriétaire)', true, null, true, 40),
  ('AUTRE', 'AUTRE', false, 'carburant', true, 50)
on conflict (key) do nothing;

alter table expense_categories enable row level security;
drop policy if exists p_expcat_sel on expense_categories;
create policy p_expcat_sel on expense_categories for select using (auth.role() = 'authenticated');
drop policy if exists p_expcat_ins on expense_categories;
create policy p_expcat_ins on expense_categories for insert with check (is_admin());
drop policy if exists p_expcat_upd on expense_categories;
create policy p_expcat_upd on expense_categories for update using (is_admin()) with check (is_admin());
drop policy if exists p_expcat_del on expense_categories;
create policy p_expcat_del on expense_categories for delete using (is_admin() and not is_system);
grant select, insert, update, delete on expense_categories to authenticated;

-- Même garde-fou que pour les rôles système (migration RBAC) : une catégorie historique
-- (is_system) ne peut pas être supprimée, pour ne jamais laisser une dépense déjà enregistrée
-- référencer une catégorie qui a disparu du catalogue.
create or replace function public.prevent_system_expcat_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.is_system and current_user = 'authenticated' then
    raise exception 'Catégorie système : suppression interdite (%).', old.key;
  end if;
  return old;
end; $$;
drop trigger if exists trg_prevent_system_expcat_delete on expense_categories;
create trigger trg_prevent_system_expcat_delete before delete on expense_categories
  for each row execute function public.prevent_system_expcat_delete();

create or replace view v_recette_groupe_jour as
with dep_pole as (
  -- Quand pole_split est rempli, une ligne par clé (pôle réellement déclaré) ; quand il est
  -- NULL (dépense non répartie, ou historique d'avant ce champ), LEFT JOIN LATERAL produit une
  -- seule ligne avec kv=NULL, et on retombe sur l'hypothèse par catégorie (comportement d'avant).
  select e.station_id, e.report_date,
    coalesce(kv.key, case when e.categorie = 'SUPERETTE' then 'superette' else 'carburant' end) as pole_groupe,
    coalesce(nullif(kv.value,'')::numeric, e.montant) as montant
  from expenses e
  left join lateral jsonb_each_text(e.pole_split) kv on e.pole_split is not null
  where coalesce(e.non_cash,false) = false
),
dep_par_pole as (
  select station_id, report_date, pole_groupe, sum(montant) as depense
  from dep_pole
  group by station_id, report_date, pole_groupe
)
select d.station_id, d.report_date, 'carburant'::text as pole_groupe,
       coalesce(d.ess_espece,0)+coalesce(d.gas_espece,0) as espece,
       coalesce(dp.depense, 0) as depense
from daily_reports d
left join dep_par_pole dp on dp.station_id = d.station_id and dp.report_date = d.report_date and dp.pole_groupe = 'carburant'
union all
select d.station_id, d.report_date, 'gaz_lub',
       coalesce(d.gaz_espece,0)+coalesce(d.lubrifiant_espece,0),
       coalesce(dp.depense, 0)
from daily_reports d
left join dep_par_pole dp on dp.station_id = d.station_id and dp.report_date = d.report_date and dp.pole_groupe = 'gaz_lub'
union all
select d.station_id, d.report_date, 'superette',
       coalesce(d.superette_espece,0),
       coalesce(dp.depense, 0)
from daily_reports d
left join dep_par_pole dp on dp.station_id = d.station_id and dp.report_date = d.report_date and dp.pole_groupe = 'superette';

alter view public.v_recette_groupe_jour set (security_invoker = on);
grant select on v_recette_groupe_jour to authenticated, anon;
