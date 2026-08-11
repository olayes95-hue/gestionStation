# 🔄 Actualiser les données depuis WhatsApp (import zip)

Procédure simple pour mettre à jour l'app avec un nouvel export du groupe WhatsApp.
À faire quand tu veux (hebdo/mensuel). L'app reste la saisie quotidienne ; ceci sert de **rattrapage**.

## 1. Exporter le chat depuis WhatsApp (téléphone)
- Ouvre le groupe **Station** → menu ⋮ → **Plus** → **Exporter la discussion**.
- Choisis **Sans les médias** (plus léger) — sauf si tu veux aussi les photos.
- Envoie-toi le fichier (mail / AirDrop / Drive) et récupère-le sur le Mac.

## 2. Deux façons de l'importer

### Option A — Tu me le donnes (le plus simple)
Dépose le **zip** (ou le `_chat.txt`) dans `~/Downloads/`, dis-moi le **chemin**, et je m'occupe de
l'extraction + je te génère le SQL à lancer. 2 minutes.

### Option B — Tu le fais toi-même
```bash
cd "/Users/olaitany/Downloads/Dev & Archives/station-app"
# adapte le chemin vers le _chat.txt extrait du zip, et la dernière date déjà dans l'app :
python3 tools/import_whatsapp.py "/Users/olaitany/Downloads/Dev & Archives/WhatsApp Chat - Station/_chat.txt" --station 1 --depuis 2026-06-29
```
Ça crée **`import_new.sql`** (nb de jours + montants affichés dans le terminal).

## 3. Charger dans l'app
Supabase → **SQL Editor** → colle le contenu de **`import_new.sql`** → **Run**.
- L'import est **dédupliqué** par (station, date) → réexécutable sans doublon (`on conflict … do update`).
- Il passe par le SQL Editor (droits admin) — c'est voulu : le **verrou anti-fraude** bloque l'écriture de dates anciennes via l'app.
- Ces imports apparaissent dans le **journal d'audit** (normal).

## Notes
- L'import couvre les **points journaliers** (ventes bon/espèce, litres, cumul bons) présents dans le **texte** du chat.
- Les **montants de versement** ne sont pas dans le texte (ils sont sur les photos de bordereaux) → pour les versements récents, soit tu les saisis dans l'app, soit on OCR les photos (module Vérif bordereaux).
- Paramètre `--depuis AAAA-MM-JJ` : ne réimporte que les jours postérieurs (mets la dernière date déjà présente).
