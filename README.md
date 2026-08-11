# ⛽ Station Beaurivage — Application de suivi quotidien

Application web pour **remplacer le suivi WhatsApp** :
- Le **gérant** saisit chaque jour son « Point » (ventes carburant Bon/Espèce, gaz, supérette, compteurs, dépenses, versements + photo du bordereau) — depuis son **téléphone**.
- L'**administrateur** voit les mêmes données sur un **tableau de bord** et reçoit des **alertes automatiques**.

## Les 4 alertes automatiques
| Alerte | Se déclenche quand… |
|---|---|
| 🔴 **Versement manquant** | du cash est à verser mais aucun versement n'est enregistré |
| 🔴 **Versement incomplet** | le montant versé est inférieur au cash à verser |
| 🟠 **Écart de caisse** | recette espèces ≠ dépenses + versement |
| 🟠 **Dépense non justifiée** | une dépense est saisie sans motif ou sans justificatif |
| 🟣 **Écart compteur** | litres vendus déclarés ≠ variation des compteurs de pompe |

---

## Installation (≈ 20 min, aucune compétence technique requise)

### Étape 1 — Créer la base de données (Supabase, gratuit)
1. Va sur **https://supabase.com** → *Start your project* → crée un compte.
2. *New project* → donne un nom (ex. `station`), choisis un mot de passe (note-le), région Europe.
3. Attends ~2 min que le projet se crée.

### Étape 2 — Créer les tables
1. Dans Supabase, menu de gauche → **SQL Editor** → *New query*.
2. Ouvre le fichier **`supabase/schema.sql`**, copie **tout** son contenu, colle-le, clique **Run**.
3. Tu dois voir « Success ».

### Étape 3 — (Recommandé) Importer l'historique déjà extrait
1. Toujours dans **SQL Editor** → *New query*.
2. Copie tout **`supabase/seed_from_audit.sql`**, colle, **Run**.
3. → 409 jours + 382 versements sont chargés : le tableau de bord sera immédiatement utile.

### Étape 4 — Créer le stockage des photos de bordereaux
1. Menu **Storage** → *New bucket* → nom exact : **`bordereaux`** → coche **Public bucket** → *Create*.

### Étape 5 — Récupérer les clés
1. Menu **Project Settings** (roue crantée) → **API**.
2. Copie **Project URL** et la clé **anon public**.
3. À la racine du projet, copie `.env.example` en `.env` et colle les 2 valeurs :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

### Étape 6 — Lancer en local (test)
```bash
npm install
npm run dev
```
Ouvre l'adresse affichée (http://localhost:5173). Crée un compte (bouton « Créer un compte »).

### Étape 7 — Désigner l'administrateur
Par défaut chaque nouveau compte est **gérant**. Pour te rendre **admin** :
1. Supabase → **SQL Editor** → exécute (remplace par ton email) :
   ```sql
   update profiles set role='admin'
   where id = (select id from auth.users where email='ton@email.com');
   ```
2. Reconnecte-toi : les onglets « Tableau de bord » et « Alertes » apparaissent.

### Étape 8 — Mettre en ligne (Vercel, gratuit)
1. Va sur **https://vercel.com** → connecte-toi (avec GitHub de préférence).
2. Pousse ce dossier sur un dépôt GitHub, puis *Import Project* dans Vercel.
   *(ou installe le CLI : `npm i -g vercel` puis `vercel` dans ce dossier.)*
3. Dans Vercel → *Settings → Environment Variables*, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. *Deploy*. Tu obtiens une URL publique (ex. `https://station-xxx.vercel.app`) à partager au gérant.

---

## Comment ça marche au quotidien
- **Gérant** (onglet *Saisie du jour*) : choisit la date, remplit les ventes/compteurs/dépenses, ajoute le(s) versement(s) avec la **photo du bordereau**. En bas, un récapitulatif calcule **Recette − Dépenses = À verser**, et affiche l'**écart** avec le versement. Il enregistre.
- **Admin** (*Tableau de bord*) : KPIs (ventes bon, espèces, versé, cash non tracé), graphique mensuel, réconciliation versements. Onglet *Alertes* : liste filtrable de tout ce qui cloche.
- **Historique** : accessible aux deux, tableau jour par jour.

## Régler la sensibilité des alertes
Les seuils sont dans `supabase/schema.sql`, vue `v_alerts` (ex. `> 1000` FCFA de tolérance, `> 100` L d'écart compteur). Modifie puis ré-exécute la partie `create or replace view v_alerts …`.

## Sécurité
- Authentification par email/mot de passe (Supabase Auth).
- **RLS** (Row Level Security) activée : seuls les utilisateurs connectés lisent les données, seul un admin peut supprimer. Les rôles sont dans la table `profiles`.

## Pile technique
React + Vite (frontend) · Supabase (Postgres + Auth + Storage) · Recharts (graphiques).
