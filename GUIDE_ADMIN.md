# 🛠️ Guide complet de l'administrateur

### Outil de gestion de station — version pour débutant

Ce guide part du principe que **vous n'avez jamais utilisé l'application**. Il explique chaque mot,
chaque écran et chaque bouton, avec des exemples chiffrés. Prenez votre temps : lisez-le une fois en
entier, puis gardez-le à côté de vous les premiers jours.

---

## Sommaire

1. [À quoi sert l'application](#1-à-quoi-sert-lapplication)
2. [Le vocabulaire à connaître (glossaire)](#2-le-vocabulaire-à-connaître-glossaire)
3. [Qui fait quoi : les rôles](#3-qui-fait-quoi-les-rôles)
4. [Première connexion](#4-première-connexion)
5. [Comment se repérer dans l'écran](#5-comment-se-repérer-dans-lécran)
6. [Votre routine (quotidienne, hebdo, mensuelle)](#6-votre-routine)
7. [📊 Tableau de bord](#7--tableau-de-bord)
8. [🔔 Alertes](#8--alertes)
9. [🗂️ Saisies & photos](#9--saisies--photos)
10. [📅 Historique](#10--historique)
11. [📦 Stock & mouvements](#11--stock--mouvements)
12. [🚚 Commandes](#12--commandes)
13. [🛂 Contrôles ANM](#13--contrôles-anm)
14. [📊 Point financier](#14--point-financier)
15. [🏦 Rapprochement bancaire](#15--rapprochement-bancaire)
16. [📷 Vérif bordereaux](#16--vérif-bordereaux)
17. [🕵️ Journal d'audit](#17--journal-daudit)
18. [📚 Produits & prix](#18--produits--prix)
19. [🚛 Fournisseurs](#19--fournisseurs)
20. [🏢 Stations & équipe](#20--stations--équipe)
21. [Les garde-fous anti-fraude](#21-les-garde-fous-anti-fraude)
22. [Questions fréquentes (FAQ)](#22-questions-fréquentes-faq)

---

## 1. À quoi sert l'application

Avant, le gérant envoyait son point du jour par **WhatsApp** (des messages, des photos en vrac).
C'était difficile à vérifier et facile à truquer.

Cette application remplace WhatsApp. Le principe est simple :

- **Le gérant** (et son équipe) saisit chaque jour, sur son téléphone : les ventes, les stocks, les
  dépenses, les versements en banque, avec des **photos obligatoires** comme preuve.
- **Vous, l'administrateur**, vous vérifiez tout depuis un ordinateur ou un téléphone. L'application
  **calcule les anomalies toute seule** et vous prévient (« alertes ») quand quelque chose ne colle
  pas : un versement qui manque, un écart de caisse, un stock qui baisse sans raison…

Votre travail devient : **regarder les alertes, pointer les versements, et suivre les chiffres**.
L'application fait les calculs ; vous prenez les décisions.

---

## 2. Le vocabulaire à connaître (glossaire)

Lisez cette section même si vous connaissez le métier : ces mots reviennent partout dans l'appli.

- **Pôle** : une activité de la station. Il y a 4 pôles : **carburant** (essence + gasoil),
  **gaz** (bouteilles), **supérette** (boutique), **lubrifiant** (huiles).
- **Recette / espèces** : l'argent liquide encaissé grâce aux ventes.
- **Vente à bon** (ou « bon ») : une vente **à crédit**, non payée en liquide. Le client (souvent une
  société) signe un bon ; on sera payé plus tard. Un bon **n'entre pas** dans la caisse en espèces.
- **Versement** : l'argent liquide que le gérant **dépose à la banque**. Chaque dépôt donne un
  **bordereau** (le reçu de la banque).
- **Bordereau** : le **reçu papier** remis par la banque après un dépôt. Le gérant en prend une photo.
- **Dépense (charge)** : de l'argent sorti de la caisse pour payer quelque chose (électricité SBEE,
  carburant de déplacement, petites réparations…). Chaque dépense doit avoir une **photo de justificatif**.
- **À verser** = recettes espèces − dépenses. C'est ce qui **devrait** partir à la banque.
- **Écart de caisse** : la différence quand `recette ≠ dépenses + versement`. Si elle n'est pas nulle,
  de l'argent manque (ou a été mal saisi).
- **Cash non tracé** : l'argent déclaré en recette qui **n'a été ni dépensé ni versé**. C'est
  l'indicateur anti-fraude le plus important. Il devrait rester proche de zéro.
- **Cuve** : le réservoir souterrain de carburant. Le stock carburant se mesure en **litres dans la
  cuve**, pas en bouteilles.
- **Compteur / index** : le chiffre affiché sur chaque pompe. La différence d'index entre deux jours
  donne les **litres vendus** (contrôle).
- **Marge carburant** : le gain de la station par litre vendu. Ici elle est fixée à **25 F/L**.
- **Commission** : le pourcentage gagné sur les autres pôles (gaz, lubrifiant, supérette).
- **Coût de revient (COGS)** : le prix **d'achat** d'un produit (≠ prix de vente). Sert à valoriser
  le stock et à calculer la vraie marge.
- **Valorisation du stock** : la **valeur en francs** de tout ce qu'il reste en stock
  (quantité × prix d'achat).
- **Sortie déduite** : la consommation d'un produit **calculée** par l'appli à partir de deux relevés
  de stock déclarés (voir §11).
- **Rapprochement bancaire** : l'action de vérifier que chaque versement déclaré est bien **arrivé
  sur le relevé de la banque**.
- **ANM** : l'organisme qui vient contrôler la conformité des pompes (voir §13).

---

## 3. Qui fait quoi : les rôles

Chaque personne a un **compte** avec un **rôle**. Le rôle décide de ce qu'elle peut voir et faire.

| Rôle | Ce qu'il fait dans l'appli | Ce qu'il **ne voit pas** |
|------|-----------------------------|--------------------------|
| **Gérant** | La saisie du jour complète (ventes, stocks, dépenses, versements), les commandes | Tableau de bord, finances, alertes, audit |
| **Pompiste** | Les relevés de compteurs, le stock, les photos | Les ventes et versements (réservés au gérant), tout le pilotage |
| **Vendeuse** | Uniquement les **déclarations supérette** | Tout le reste |
| **Administrateur** (vous) | **Tout**, pour **toutes les stations** | — |

> Vous créez ces comptes et choisissez leur rôle dans **Stations & équipe** (voir §20).
> **Important** : personne ne peut se donner à lui-même le rôle admin. Seul un admin change les rôles.

---

## 4. Première connexion

1. Ouvrez le **lien de l'application** que vous avez reçu (dans un navigateur : Chrome, Safari…).
   Vous pouvez l'utiliser sur ordinateur **ou** sur téléphone.
2. Vous arrivez sur l'écran **Connexion**. Entrez votre **email** et votre **mot de passe** d'admin,
   puis validez.
3. Vous êtes connecté. En haut, vous voyez le nom de la station et, à gauche, le **menu**.

> **Conseil** : mettez le lien en favori / sur l'écran d'accueil du téléphone pour y revenir vite.
> **Mot de passe oublié ?** Utilisez la réinitialisation, ou depuis un autre compte admin.

---

## 5. Comment se repérer dans l'écran

### La barre du haut
- **☰ (sur téléphone)** : ouvre le menu latéral.
- **📍 Sélecteur de station** : si vous gérez plusieurs stations (Beaurivage, Vedoko…), cliquez ici
  pour **changer de station**. ⚠️ **Tout ce que vous voyez à l'écran concerne la station choisie.**
  Si un chiffre vous surprend, vérifiez d'abord que vous êtes sur la bonne station.
- À droite : votre rôle (**Administrateur**) et le bouton de **déconnexion** (⏻).

### Le menu de gauche (la barre latérale)
Il est rangé en 4 groupes. Voici la carte complète de l'appli :

- **Exploitation** : Saisie du jour · Aide · Stock & mouvements · Commandes · Contrôles ANM · Historique
- **Pilotage** : Tableau de bord · Saisies & photos · Alertes
- **Finance** : Point financier · Rapprochement · Vérif bordereaux
- **Administration** : Journal d'audit · Produits & prix · Fournisseurs · Stations & équipe

Cliquez sur une ligne pour ouvrir l'écran correspondant. Les chapitres 7 à 20 les détaillent un par un.

---

## 6. Votre routine

Vous n'avez pas besoin de tout regarder tous les jours. Voici un rythme simple.

### Chaque jour (5 minutes)
1. **🔔 Alertes** → traitez d'abord les lignes **rouges**.
2. **📊 Tableau de bord** → regardez le **cash non tracé** et l'**autonomie** de carburant.
3. **🗂️ Saisies & photos** → vérifiez que le point du jour est arrivé **avec ses photos**.

### Chaque semaine
- **🏦 Rapprochement** → pointez les versements arrivés en banque.
- Vérifiez le **taux de couverture** des versements sur le tableau de bord.

### Chaque mois
- **📊 Point financier** → lisez le résultat du mois.
- **📦 Stock** → faites un inventaire et comparez au stock déclaré.
- Revoyez les **produits & prix** si un tarif a changé.

---

## 7. 📊 Tableau de bord

C'est votre **vue d'ensemble**. En haut, un bloc **filtre** : choisissez **Année** et **Mois** pour
n'afficher qu'une période. Par défaut, c'est le dernier mois disponible.

Ce que vous y voyez, de haut en bas :

### a) 📦 Stock en temps réel & autonomie
- **Essence en cuve / Gasoil en cuve** : litres restants, avec une estimation en **jours** :
  - 🟢 vert = plus de 6 jours d'autonomie,
  - 🟠 orange = entre 3 et 6 jours (pensez à commander),
  - 🔴 rouge = moins de 3 jours (commandez **maintenant**).
- **Bons en cours** : le total des ventes à crédit non encore réglées.
- **Bouteilles de gaz** : total en stock.
- Petit lien **rafraîchir** pour recharger les chiffres.

### b) Les indicateurs du mois (les « KPIs »)
- **Ventes à bon** : total vendu à crédit.
- **Recettes espèces** : total encaissé en liquide.
- **Versé banque** : total réellement déposé.
- **Cash non tracé** = recettes − dépenses − versé. 🔴 **S'il est positif et grossit, alerte !**
  Exemple : recettes 500 000, dépenses 50 000, versé 400 000 → cash non tracé = **50 000 F** à
  expliquer.
- **Marge carburant** : le gain estimé (25 F par litre vendu).
- **Livraisons / achats** : ce qui a été acheté/reçu.
- **Alertes (station)** : combien d'anomalies en cours.

### c) Commandes & contrôles ANM
Nombre de commandes reçues et de contrôles ANM (conformes / non conformes).

### d) Évolution mensuelle (graphique)
Un histogramme compare, mois par mois : ventes à bon, espèces et versé.

### e) Réconciliation des versements (par mois)
Un tableau : pour chaque mois, **Espèces** encaissées vs **Versé** en banque, l'**écart**, et le
**taux de couverture** (part des espèces réellement versées). Visez un taux proche de **100 %**.

---

## 8. 🔔 Alertes

L'appli **détecte les anomalies toute seule** et les liste ici. En haut : filtres **année / mois /
type**, et le compteur « **X active(s) · Y traitée(s)** ».

### Comment traiter une alerte
- Chaque alerte a un bouton **« ✓ Traité »**. Cliquez-le une fois que vous avez géré le problème
  (appelé le gérant, corrigé la saisie, etc.). L'alerte disparaît de la liste active.
- Pour revoir les alertes déjà traitées, affichez-les et cliquez **« Rétablir »** pour en remettre
  une en actif si besoin.

### Les types d'alertes et quoi faire

| Alerte | Ce que ça veut dire | Ce que vous faites |
|--------|---------------------|--------------------|
| **Versement manquant** | Il fallait verser du cash, mais **aucun versement** ce jour-là | Appelez le gérant : où est l'argent ? |
| **Versement incomplet** | Le versement est **inférieur** à ce qui devait partir | Demandez la différence |
| **Écart de caisse** | `recette ≠ dépenses + versement` | Cherchez l'erreur de saisie ou l'argent manquant |
| **Dépense non justifiée** | Une dépense **sans photo/motif** | Exigez le justificatif |
| **Écart compteur** | Litres déclarés ≠ litres calculés depuis les pompes | Vérifiez les index et la saisie |
| **Stock bas** (carburant/gaz/lubrifiant) | Sous le **seuil** configuré | Passez commande |
| **Écart de cuve (coulage ?)** | Le niveau de cuve ne colle pas avec les ventes | Vérifiez fuite / vol / erreur |
| **Perte livraison > 5 %** | Écart entre commandé et reçu | Réclamez au fournisseur |
| **Bons disparus (inexpliqué)** | Les bons baissent sans commande ni charge | Contrôlez : encaissement non déclaré ? |
| **Écart d'inventaire** | Stock déclaré incohérent | Refaites le comptage |
| **Point du jour manquant** | Aucune saisie ce jour-là | Rappelez au gérant de saisir |

> 💡 Traitez **le rouge le jour même**. Une alerte ignorée est une perte potentielle.

---

## 9. 🗂️ Saisies & photos

La liste de **tous les points envoyés** par les gérants, avec les **photos** jointes.
Vous y trouvez : les photos de **compteurs**, de **dépenses**, de **bordereaux** de versement et de
**réceptions** de marchandise.

- Cliquez sur une photo pour l'**agrandir** et vérifier qu'elle est lisible et cohérente.
- Une colonne indique **Photos : Oui / Non** — repérez les saisies **sans preuve** et réclamez-les.

> C'est ici que vous contrôlez visuellement : le montant du bordereau correspond-il au versement
> déclaré ? La photo du compteur montre-t-elle bien l'index saisi ?

---

## 10. 📅 Historique

Le détail **jour par jour** du chiffre d'affaires, **par pôle** (carburant, gaz, supérette,
lubrifiant). En bas, une **ligne de totaux**. Une colonne signale la présence des photos.

Servez-vous-en pour suivre une tendance ou retrouver une journée précise.

---

## 11. 📦 Stock & mouvements

Cet écran suit **ce qu'il reste** et **ce qui a été consommé**. Comprenez bien le principe :

> **Le stock n'est pas deviné : il est DÉCLARÉ.** Chaque jour, le gérant compte et saisit le stock
> restant (bouteilles de gaz, lubrifiants). L'appli en déduit la consommation.

### a) Valorisation du stock (visible par l'admin)
En haut, des cases donnent la **valeur en francs** du stock par catégorie (gaz, lubrifiant, supérette)
et la **valeur totale**. Ce calcul utilise les **prix d'achat** du catalogue (§18).

### b) 📦 Stock actuel (déclaré)
Le **dernier relevé déclaré** par le gérant, produit par produit, avec le **seuil** d'alerte.
Un stock sous le seuil s'affiche en rouge.
> Le carburant n'est pas ici (il est géré par les **cuves**, sur le tableau de bord).

### c) ➕ Entrée de stock / inventaire (le formulaire)
Sert à enregistrer **ce qui rentre** ou un **ajustement**. Étapes :
1. **Catégorie** : Gaz, Lubrifiant ou Supérette.
2. **Type** : **Entrée** (une livraison/achat) ou **Ajustement** (correction d'inventaire).
   → Pour le gaz et le lubrifiant, il **n'y a pas de « Sortie » à saisir** : les sorties sont
     **déduites automatiquement** (voir ci-dessous). La supérette, elle, peut avoir une sortie en valeur.
3. **Source** : achat / perte / inventaire…
4. Selon la catégorie : **Quantité** (gaz/lubrifiant) ou **Valeur en F** (supérette), une **date**,
   une **note** facultative.
5. Cliquez **« Enregistrer le mouvement »**.

### d) 📉 Sorties déduites (consommation) — le cœur du système
L'appli **calcule** la consommation de chaque jour à partir de deux relevés déclarés consécutifs :

> **Sortie du jour = stock déclaré la veille + entrées du jour − stock déclaré du jour**

Exemple, bouteilles de 6 kg :
- Hier, le gérant a déclaré **40** bouteilles.
- Aujourd'hui il a **reçu 20** bouteilles (une entrée) et déclare **45** en stock.
- Sortie déduite = 40 + 20 − 45 = **15 bouteilles vendues/sorties**. ✅

Le tableau montre, par jour et par produit : **Veille**, **Entrées**, **Jour**, **Sortie déduite**.
- Une **sortie négative** (en rouge) veut dire que le stock **a augmenté sans entrée enregistrée** :
  soit une réception non saisie, soit une erreur de comptage → à vérifier.
- Il faut **au moins deux relevés consécutifs** pour qu'une ligne apparaisse.

### e) Journal des mouvements
La liste des entrées/ajustements (et sorties supérette). En haut : **filtre par année / mois** et un
**« Solde valeur »** de la période. Vous pouvez supprimer une ligne erronée (bouton ✕, admin).

---

## 12. 🚚 Commandes

Le suivi des **approvisionnements**, en 3 étapes, avec des **onglets** : **Proposée → Lancée → Reçue**,
et un **filtre par produit** (carburant, gaz, lubrifiant, supérette).

Le cycle typique d'une commande :
1. **Proposée** : on prévoit une commande (produit, quantité, prix).
2. **Lancée** : la commande est passée au fournisseur. Si le paiement se fait **par chèque**, on
   renseigne le **numéro** et les **dates** (proposition / lancement / réception). Sinon, **espèces**.
3. **Reçue** : à la réception, l'appli **crée automatiquement l'entrée de stock** correspondante ;
   pour le **carburant**, elle met à jour le **niveau de cuve**.

> Un achat se paie **soit par chèque, soit en espèces** — c'est précisé sur la commande.

---

## 13. 🛂 Contrôles ANM

Pour enregistrer les **contrôles de conformité des pompes**. On saisit : **date**, **organisme**,
**pompes concernées**, litres **prélevés** et **retour en cuve**, si les **pompes sont conformes**
(oui/non) et des **observations**. Un contrôle **non conforme** ressort sur le tableau de bord.

---

## 14. 📊 Point financier

C'est le **compte d'exploitation** du mois (comme votre tableau papier). Choisissez le **mois**
(ou « Année entière »). Trois parties :

### Produits (ce que la station gagne)
- **Commission carburant** : calculée **automatiquement** (litres × 25 F).
- **Autres produits** : commissions gaz/lubrifiant/supérette et éléments saisis.

### Charges (ce que la station dépense)
- **SBEE (auto)** : l'électricité, reprise **automatiquement** depuis les dépenses saisies.
- **Carburant / déplacement (auto)** : repris automatiquement aussi.
- **Charges fixes (saisies)** : loyer et autres. Vous pouvez en **ajouter** (Catégorie + Montant +
  bouton **« Ajouter »**) ou en **supprimer**.
  > Certaines charges **se reportent d'un mois sur l'autre**. Le **loyer** se règle en **bons**
  > (pas en espèces) — l'appli en tient compte pour ne pas fausser la caisse.

### RÉSULTAT
Le solde final : **Produits − Charges**. C'est votre bénéfice (ou perte) du mois.

> Astuce : pour comprendre une ligne « auto », sélectionnez un **mois précis** puis ouvrez
> l'**Historique** ou les **Saisies** de ce mois.

---

## 15. 🏦 Rapprochement bancaire

Ici, vous vérifiez que **l'argent déclaré versé est bien arrivé à la banque**. L'appli compare :
- d'un côté, les **versements déclarés** par le gérant (avec bordereau) ;
- de l'autre, les **crédits du relevé bancaire** que **vous** saisissez ici.

### Étapes
1. **Ajoutez chaque ligne du relevé bancaire** : **Date opération**, **Montant crédité**,
   **Référence**, puis **« Ajouter la ligne »**.
2. L'appli **rapproche automatiquement** les montants et vous montre 3 tableaux :
   - **⚠️ Versements déclarés SANS crédit en banque** : le gérant dit avoir versé, mais **la banque
     n'a rien reçu** → **à investiguer en priorité** (colonne Date de recette, Pôle, Montant, Réf).
   - **❓ Crédits en banque SANS versement déclaré** : de l'argent est arrivé mais **aucun versement
     déclaré** ne correspond → saisie oubliée ? autre source ?
   - **✅ Rapprochés** : tout concorde. 🎉
3. En haut, deux compteurs : **Rapprochés** et **Non rapprochés** (rouge s'il en reste).

> Rappel utile : un versement peut concerner la recette d'un **jour antérieur**, et il y a **une
> source par pôle**. C'est normal qu'une date de versement diffère de la date de recette.

---

## 16. 📷 Vérif bordereaux

Un écran d'aide pour **contrôler les photos de bordereaux** (lecture assistée du montant). Utilisez-le
pour comparer rapidement le montant lu sur la photo au montant déclaré, sans tout ressaisir.

---

## 17. 🕵️ Journal d'audit

La **trace de tout** : qui a **créé** ou **modifié** quoi, et **quand**. C'est votre **filet de
sécurité**. En cas de contestation (« je n'ai jamais saisi ça »), l'audit dit la vérité.
Parcourez-le quand un chiffre change de façon suspecte.

---

## 18. 📚 Produits & prix

Le **catalogue** des produits (gaz, lubrifiants…). C'est **dynamique** : vous gérez tout vous-même.

- **Nouveau produit** : renseignez **Catégorie**, **Nom**, **Unité**, **Prix d'achat**,
  **Prix de vente**, **Seuil** (le niveau qui déclenche l'alerte « stock bas »), et **Actif** (oui/non).
- Vous pouvez **modifier** un tarif ou **supprimer** un produit (**Suppr.**).

> ⚠️ **Important** : le **prix d'achat** sert à **valoriser le stock** et à mesurer la marge. Gardez-le
> juste. Le **seuil** doit refléter le délai de réappro (si une livraison prend 3 jours, mettez un
> seuil qui laisse 3–4 jours de marge).

---

## 19. 🚛 Fournisseurs

Le **carnet d'adresses** des fournisseurs (carburant, gaz, lubrifiants, supérette). Ajoutez-les ici
pour les retrouver facilement lors des commandes.

---

## 20. 🏢 Stations & équipe

Deux choses ici : **configurer chaque station** et **gérer les comptes**.

### a) Configuration de la station
- **Compte bancaire**.
- **Prix de vente** essence / gasoil et **Marge (F/L)** (25 F).
- **Prix d'achat** essence / gasoil.
- **Taux de commission autres pôles (%)** : Gaz + lubrifiant, et Supérette.
- **Seuils d'alerte** : essence (L), gasoil (L), gaz (bouteilles/type), lubrifiant (unités).
- Cliquez **« Enregistrer »** après chaque modification.

### b) L'équipe (les comptes)
Le tableau liste les membres avec leur **Rôle** et leur **Station**. Vous pouvez :
- attribuer un rôle : **Pompiste**, **Vendeuse**, **Gérant** ou **Admin** ;
- rattacher la personne à une **station** ;
- désactiver / supprimer un compte (**Suppr.**).

> 🔒 **Sécurité** : un utilisateur **ne peut pas** se donner à lui-même un rôle supérieur. Seul un
> **admin** modifie les rôles. C'est une protection volontaire contre les abus.

---

## 21. Les garde-fous anti-fraude

L'application impose déjà, **côté gérant**, des règles que vous n'avez pas à surveiller manuellement :

- **Photos obligatoires** : impossible d'enregistrer sans la photo des compteurs (16 h), de **chaque
  dépense**, de **chaque bordereau** de versement et de **chaque réception**.
- **Relevés 16 h obligatoires** : les 8 index de pompe doivent être remplis pour valider l'envoi.
- **Verrouillage du passé** : un gérant **ne peut plus modifier** un jour de **plus de 2 jours**.
  Vous, admin, oui — pour corriger une erreur.
- **Versement rattaché au bon jour** : un dépôt fait aujourd'hui pour la recette d'hier réduit
  l'écart **d'hier**, pas d'aujourd'hui.
- **Détection automatique** : baisses de stock/bons inexpliquées, pertes de livraison, écarts de caisse.

Votre rôle est de **réagir aux alertes**, pas de tout recontrôler à la main.

---

## 22. Questions fréquentes (FAQ)

**Je vois des chiffres bizarres.**
→ Vérifiez d'abord le **sélecteur de station** (en haut) et la **période** (filtre année/mois).

**Une alerte « versement manquant » apparaît alors que le gérant dit avoir versé.**
→ Le versement a peut-être été **saisi sur un autre jour**, ou pas encore saisi. Regardez les
**Saisies & photos** et le **Rapprochement**.

**La « sortie déduite » est négative.**
→ Le stock a monté sans **entrée** enregistrée. Il manque une **réception** (à saisir en « Entrée »)
ou le comptage est faux.

**Le « cash non tracé » est élevé.**
→ De l'argent déclaré n'a été ni dépensé ni versé. Appelez le gérant et exigez l'explication /
le versement.

**Je dois corriger un vieux jour verrouillé pour le gérant.**
→ En tant qu'admin, vous **pouvez** le modifier ; le **journal d'audit** gardera la trace.

**Comment ajouter un nouveau membre à l'équipe ?**
→ **Stations & équipe** : créez/rattachez le compte et choisissez son **rôle**.

**Un tarif a changé.**
→ Mettez-le à jour dans **Produits & prix** (et **Stations & équipe** pour le carburant), sinon la
valorisation et les marges seront fausses.

---

*Besoin d'un rappel rapide ? L'écran **❓ Aide** de l'application résume l'essentiel pour toute
l'équipe. Et gardez ce guide sous la main : tout y est.*
