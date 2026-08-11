# 🗄️ Politique d'archivage des fichiers

Objectif : garder l'application **légère et rapide** dans le temps, sans perdre les preuves
nécessaires aux contrôles. L'essentiel du poids vient des **photos** (bordereaux, dépenses,
compteurs, réceptions) stockées dans Supabase Storage.

---

## 1. Réduire le poids à la source (déjà en place)

Depuis la dernière mise à jour, **toute photo est compressée avant l'envoi** :
redimensionnée à 1600 px max et convertie en JPEG qualité 0,7.

- Une photo de téléphone passe typiquement de **3–5 Mo à 200–400 Ko** (≈ 10× plus léger).
- Uploads plus rapides sur connexion mobile, moins de stockage consommé.
- La compression est **automatique et non bloquante** : si elle échoue, l'original est envoyé.

> C'est le levier le plus efficace : il agit sur **toutes** les nouvelles photos, sans rien faire.

---

## 2. Durées de conservation (rétention)

| Type de photo | Rôle | Conservation |
|---------------|------|--------------|
| **Bordereaux de versement** | Preuve bancaire | **24 mois** |
| **Justificatifs de dépenses** | Preuve comptable | **24 mois** |
| **Réceptions (bons de livraison)** | Preuve d'achat/stock | **24 mois** |
| **Photos de compteurs** | Preuve de relevé (vérifiée sous quelques jours) | **6 mois** |

Passé ces délais, les photos peuvent être **supprimées** : les données chiffrées (montants,
litres, écarts) restent, elles, **conservées indéfiniment** dans les tables — ce ne sont que
des chiffres, très légers.

---

## 3. Comment purger (2 étapes)

La suppression se fait en deux temps car une base SQL ne supprime pas les fichiers du Storage.

### Étape A — voir ce qui est archivable
Dans Supabase → SQL Editor :
```sql
select categorie, count(*), min(report_date) as plus_ancienne
from v_attachments_archivables group by categorie;
```

### Étape B — supprimer
1. **Les fichiers du Storage** (les images elles-mêmes) : via une petite **Edge Function**
   (fournie séparément) ou manuellement depuis Storage → bucket, en filtrant par ancienneté.
   Récupérer d'abord la liste des chemins :
   ```sql
   select photo_path from v_attachments_archivables;
   ```
2. **Les lignes en base** (références) : exécuter la fonction (admin uniquement)
   ```sql
   select purge_attachments_archivables();  -- renvoie le nombre de lignes supprimées
   ```

> Ordre conseillé : supprimer d'abord les **fichiers** du bucket, puis les **lignes** en base.
> Faites-le **une fois par trimestre** (voir §5).

---

## 4. Ce qu'il ne faut PAS archiver

- Les **tables de données** (`daily_reports`, `deposits`, `expenses`, `fuel_orders`,
  `stock_movements`…) : ce sont des chiffres, très légers, et utiles à l'historique et aux
  analyses. On les **garde**.
- Les **bordereaux de l'exercice comptable en cours** et de l'exercice précédent (obligations
  légales) : ne pas purger avant la fin des 24 mois.

---

## 5. Rythme recommandé

- **Chaque trimestre** : lancer l'étape A (voir le volume), puis l'étape B si nécessaire.
- **Optionnel** : automatiser via **pg_cron** (Supabase) un appel mensuel à
  `purge_attachments_archivables()` — à n'activer qu'après avoir mis en place la suppression
  des fichiers Storage, sinon les images resteraient orphelines dans le bucket.

---

## 6. Bonnes pratiques de stockage

- **Un bucket privé** (déjà le cas) : les photos ne sont accessibles qu'authentifié.
- **Ne pas re-téléverser** plusieurs fois la même preuve.
- Garder les seuils de compression tels quels ; les baisser encore dégraderait la lisibilité
  des montants sur les bordereaux.

---

*En résumé : compression automatique (déjà active) + purge trimestrielle des photos de plus de
6/24 mois = application qui reste légère, sans perte de preuve utile.*
