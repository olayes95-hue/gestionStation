# 🚀 Déploiement — Outil de gestion de station

Guide complet, dans l'ordre. Deux services **gratuits** : **Supabase** (base + fichiers) et **Netlify** (hébergement).

---

## Vue d'ensemble
- **Frontend** : React (Vite) → build statique déposé sur Netlify.
- **Backend** : Supabase (Postgres + Auth + Storage + pg_cron).
- **OCR** (optionnel) : 1 fonction serveur + clé API Anthropic.

---

## PARTIE A — Supabase (base de données)

### A1. Créer le projet
1. https://supabase.com → *New project* (note le mot de passe DB).
2. Attends ~2 min.

### A2. Activer l'extension pg_cron (pour les notifications 9h/17h)
Supabase → **Database → Extensions** → cherche **pg_cron** → **Enable**.

### A3. Exécuter les scripts SQL **dans cet ordre**
Supabase → **SQL Editor** → *New query* → colle chaque fichier → **Run**, un par un :

| Ordre | Fichier | Rôle |
|---|---|---|
| 1 | `supabase/schema.sql` | Tables de base, sécurité (RLS), rôles, 1ᵉʳ moteur d'alertes |
| 2 | `supabase/seed_from_audit.sql` | *(optionnel)* 409 jours + 382 versements historiques |
| 3 | `supabase/migration_v2.sql` | Prix/marge, stock, gaz/lubrifiant, livraisons, moments |
| 4 | `supabase/migration_v3.sql` | **Multi-station** (Beaurivage + Vedoko), stock temps réel, fournisseurs, alerte stock bas |
| 5 | `supabase/migration_v4.sql` | Rapprochement bancaire + alerte point manquant |
| 6 | `supabase/migration_v5.sql` | Relevés d'ouverture + contrôle écart compteurs |
| 7 | `supabase/migration_v6.sql` | Photos-preuves (compteurs, stock, factures) |
| 8 | `supabase/migration_v7.sql` | Commandes carburant (workflow) + contrôles ANM |
| 9 | `supabase/migration_v8.sql` | Prix d'achat + commande rattachée au jour |
| 10 | `supabase/migration_v9.sql` | Notifications 9h/17h (nécessite pg_cron activé en A2) |
| 11 | `supabase/migration_v10.sql` | Colonnes OCR bordereaux |
| 12 | `supabase/migration_v11.sql` | **Anti-fraude** : journal d'audit, verrou du passé, rôle pompiste |
| 13 | `supabase/cleanup_tests.sql` | *(recommandé, une fois)* purge les données de test (garde l'historique) |

> Les migrations sont idempotentes (réexécutables sans casse).

### A4. Créer le bucket de photos
Supabase → **Storage** → *New bucket* → nom exact **`bordereaux`** → coche **Public** → *Create*.
Puis Storage → `bordereaux` → **Policies** → autorise **INSERT + SELECT** pour le rôle `authenticated`.

### A5. Simplifier la connexion
Supabase → **Authentication → Providers → Email** → décoche **Confirm email** → *Save*.

### A6. Créer l'administrateur
1. (Après le déploiement front) crée ton compte dans l'app.
2. SQL Editor → (remplace l'email) :
   ```sql
   update profiles set role='admin' where id=(select id from auth.users where email='TON_EMAIL');
   ```
3. Rattache le(s) gérant(s) à leur station via l'onglet **Stations & équipe** (ou en SQL).

---

## PARTIE B — Frontend (Netlify)

### B1. Configurer les clés
Supabase → **Project Settings → API** → copie *Project URL* et *anon public*.
À la racine du projet, copie `.env.example` en **`.env`** et colle les 2 valeurs.

### B2. Construire
```bash
npm install
npm run build      # génère le dossier dist/
```

### B3. Mettre en ligne
- Va sur **https://app.netlify.com/drop** → **glisse le dossier `dist`**.
- *(Optionnel : crée un compte Netlify → « Claim site » pour garder/renommer l'URL.)*
- Partage l'URL au gérant.

> À chaque changement de code ou de clés : `npm run build` puis re-glisser `dist`. L'usage quotidien ne nécessite **aucun** redéploiement (les données vivent dans Supabase).

---

## PARTIE C — OCR bordereaux (optionnel, avancé)

1. `migration_v10.sql` déjà exécutée (Partie A).
2. Clé API sur https://console.anthropic.com (format `sk-ant-...`).
3. Déploie la fonction (voir `supabase/functions/README_OCR.md`) :
   ```bash
   npm i -g supabase && supabase login
   supabase link --project-ref <TON_PROJECT_REF>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx
   supabase functions deploy ocr-bordereau
   ```
   *(ou copier-coller le code dans Supabase → Edge Functions, + ajouter le secret)*
4. Utilisation : app (admin) → onglet **Vérif bordereaux** → *Analyser*.

---

## PARTIE D — Notifications 9h/17h
Rien de plus à faire : la Partie A (pg_cron + `migration_v9.sql`) planifie tout.
Le bandeau apparaît dans l'app pour le gérant et l'admin.
*(Push email/WhatsApp hors app = évolution possible via une fonction serveur.)*

---

## ✅ Checklist finale
- [ ] pg_cron activé
- [ ] Scripts SQL 1 → 11 exécutés dans l'ordre
- [ ] Bucket `bordereaux` public + policies
- [ ] Confirm email désactivé
- [ ] `.env` rempli, `npm run build`, `dist` déposé sur Netlify
- [ ] Compte admin créé + promu, gérants rattachés à leur station
- [ ] (option) Fonction OCR déployée + clé API

---

## État actuel de TON projet live
Déjà en place et testé : schema + hotfixes + v3, v4, v5, v6, v7, v8.
**Restent à lancer** : `migration_v9.sql` (après avoir activé pg_cron) et `migration_v10.sql`,
puis **re-déposer `dist`** pour publier tous les derniers écrans (design, stats, historique éditable,
photos compteurs, responsive, Vérif bordereaux). OCR : déployer la fonction quand tu veux.

## Fichiers de test (facultatif, en local)
`test_e2e.mjs`, `test_roles.mjs`, `test_v45.mjs`, `test_v7.mjs`, `test_v8.mjs`, `test_v9.mjs`,
`load_seed.mjs` (recharger les données historiques). Lancement : `node <fichier>.mjs`.
