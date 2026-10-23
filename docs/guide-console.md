# Guide de la console — Team Lausanne Academy

Ce guide décrit la console écran par écran. C'est la **seule source** de
l'Aide : si une manipulation n'est pas écrite ici, l'Aide répond qu'elle ne
sait pas plutôt que d'inventer un bouton.

> **Règle du dépôt.** Toute modification d'un écran — nouveau bouton, onglet
> renommé, automatisme ajouté — met à jour ce fichier **dans le même commit**.
> Sinon l'Aide explique une console qui n'existe plus.

Les libellés exacts sont entre guillemets : « Enregistrer », « + Nouveau ».
Les chemins s'écrivent « Onglet → Sous-onglet → bouton ».

**Comment un écran est décrit ici** — toujours dans le même ordre, parce que
c'est l'ordre des questions qu'on se pose : *ce que c'est* · *qui peut
écrire* · *les sous-onglets* · *comment lire l'écran* · *comment faire la
chose principale*, en étapes numérotées · *ce que chaque champ veut dire* ·
*ce que l'autre côté voit* (la famille, le jeune) · *bon à savoir*, les pièges
et ce qui demande du jugement.

---

## 1. Se connecter et s'y retrouver

La console est à l'adresse **/console**. On s'y connecte avec son adresse
e-mail et son mot de passe. `/admin` redirige vers `/console`.

L'entête change selon le rôle : « Console » pour l'administration,
« Espace coach », « Espace prof », « Espace mental ». Le menu est sur la
gauche, groupé par thème. **Chacun ne voit que ses onglets** : si un onglet
décrit ici n'apparaît pas, c'est que le rôle ne le permet pas, et c'est un
administrateur qui peut l'ouvrir dans « Réglages → Accès & rôles ».

Un bouton **« Aide »** flotte en bas à droite de chaque écran. Il connaît
l'écran sur lequel on se trouve, donc on peut poser la question sans préciser
où on est. « − » le réduit en gardant la conversation, « ✕ » la referme.

---

## 2. Carte des menus

| Onglet | À quoi il sert | Qui le voit |
|---|---|---|
| Dashboard | Vue d'ensemble du jour | admin, head coach |
| Calendrier | Événements, vacances, absences | admin, secrétariat, head coach |
| Répertoire | Les fiches des personnes | admin, secrétariat |
| Inscriptions | Demandes venues du formulaire public | admin, secrétariat |
| Accès Mon espace | Inviter les familles dans l'app | admin |
| Prospects | Joueurs repérés, hors académie | admin |
| Accueil espace privé | Messages affichés dans Mon espace | admin, secrétariat |
| Messagerie | La boîte info@ | admin, secrétariat |
| Newsletter | Envois groupés | admin, secrétariat |
| Social Media Planner | Publications réseaux sociaux | admin, secrétariat |
| Assistant | Le bot du site public | admin, secrétariat |
| Réglages | Rôles, accès, saisons, suivi de l'Aide | admin |
| Réserv. | La grille des courts | admin, secrétariat, head coach |
| Saison hiver | Abonnements d'hiver | admin, secrétariat |
| Casiers | Attribution des casiers | admin, secrétariat |
| Cours | Planning et types de cours | tout l'encadrement |
| Feuille de match | Les feuilles des jeunes | encadrement, coach mental |
| Last scores | Derniers résultats | encadrement |
| Planning tournois | La saison des jeunes élite | head coach, coach, admin |
| Tests phys. | Tests physiques | encadrement |
| Physique | Routines et suivi physique | encadrement |
| Anniversaires | Qui fête quoi | admin, secrétariat, head coach |
| Études | Sport-études | admin, profs |
| Mental | Suivi mental | admin, coach mental |
| CSEL | Repas et études CSEL | admin, Séline (repas) ; Arsalan en lecture (repas) |
| GameZone | Tournois juniors | admin, organisateur |
| Caisse | Caisse du secrétariat | admin, secrétariat |
| Factures | Toute la facturation | admin |
| Heures | Heures des coachs et profs | admin, encadrement |
| Serrures | Serrures connectées | admin, secrétariat |
| Arrosage | Arrosage des courts | admin, secrétariat |
| Stages | Camps de vacances | admin, secrétariat |
| Stats | Chiffres de l'académie | admin, secrétariat |

---

## 3. Planning tournois

### Ce que c'est

La planification de la saison d'un joueur, semaine par semaine : ce qu'il
travaille, quand il est censé jouer un tournoi, et ce à quoi il s'est inscrit.

Une seule saison de 52 semaines, un seul écran. Les coachs écrivent, le jeune
lit la même chose dans **Mon espace › Saison** et y ajoute ses propres
inscriptions.

**Qui peut écrire** : head coach, coach, admin, superadmin. Les autres ne
voient pas l'onglet.

**Qui y figure** : les jeunes en **sport-études, pro U18 et pro**. Compétition
et performance n'y sont pas — leurs familles n'ont pas de délégation à
organiser, et c'est la même règle qu'au portail, où l'onglet « Saison » leur
est caché.

### Les deux sous-onglets

- **« Prochains tournois »** — la liste des tournois à venir, regroupés quand
  plusieurs jeunes vont au même endroit. C'est l'écran des délégations : qui
  part où, et avec qui.
- **« Calendriers »** — la frise de la saison, une ligne par joueur. C'est là
  qu'on planifie.

### Lire la frise

Une ligne par joueur, **une case par semaine**, de gauche à droite sur
l'année.

La **couleur de la case** dit le type de semaine :

| Couleur | Type |
|---|---|
| Bleu foncé | Entraînement |
| Bleu-vert | Prépa physique |
| Bleu clair | Entraînement en option |
| Gris pâle | Vacances |
| Bleu nuit | Tournoi à l'étranger |
| Presque blanc | Rien de prévu |

Le **repère au bord droit** de la case dit où en est le week-end :

| Repère | Ce que ça veut dire |
|---|---|
| Vert fluo | Une zone tournoi est prévue, le jeune ne s'est pas encore inscrit |
| Bleu encre | Le jeune s'est inscrit, dans la zone prévue |
| Rouge | Le jeune s'est inscrit **hors** de toute zone prévue — à en parler avec lui |
| Rien | Ni zone, ni inscription |

Le repère est à droite parce que le week-end est la fin de la semaine : sa
place sur la case dit déjà quand il tombe.

**Pour se repérer dans l'année** : un trait vertical marque chaque début de
mois et traverse toutes les lignes ; la semaine en cours est cerclée. Passer
la souris sur une case donne tout le détail de la semaine.

### Planifier une saison

Cliquer sur la ligne d'un joueur ouvre sa frise en grand, en dessous.

1. **Choisir un pinceau** : « Prépa physique », « Entraînement »,
   « Entraînement en option », « Vacances », « Tournoi à l'étranger » — ou
   « Effacer ».
2. **Glisser sur les semaines** de la rangée du haut pour poser ce type. Sur
   téléphone : toucher la première semaine, puis la dernière.
3. **La rangée du milieu, c'est le week-end.** Cliquer ou glisser dessus pose
   une zone tournoi — le jeune verra qu'il doit s'inscrire. Recliquer la
   retire.
4. **La rangée du bas, ce sont les inscriptions du jeune.** Cliquer dessus
   ouvre la fenêtre de la semaine : on y voit ses inscriptions, on peut en
   ajouter ou en retirer.

**« Copier vers… »** reprend la planification d'un joueur et la pose sur
d'autres, pour toute la saison. Leurs inscriptions ne sont pas touchées,
seules les zones de semaine sont remplacées.

**« Jours sans entraînement »** (en haut de l'onglet) note les jours fériés et
les fermetures de la saison. Ils apparaissent en coin sombre sur les semaines
concernées, pour tous les joueurs.

### Écrire le programme d'une semaine

Dans la fenêtre d'une semaine, trois champs :

- **Tennis** — ce qui est travaillé sur le court. Ex. « Travail tactique et
  schémas de jeu ».
- **Préparation physique** — le programme physique de la semaine. Ex. « Prépa
  tournois : réactivité et technique ».
- **Note** — une remarque libre, facultative. Ex. « Deux tournois recommandés
  au total sur la période du 05.10 au 25.10 ».

C'est ce qu'on trouvait jusqu'ici dans le tableur de planification annuelle.
Écrit ici, le jeune le lit dans son espace.

### Voir tout le programme d'un coup

Sous la frise d'un joueur, le tableau **« Programme de la saison »** donne une
ligne par semaine renseignée : la date, le tennis, la prépa physique, et la
note s'il y en a une. La semaine en cours y est surlignée.

C'est l'écran à ouvrir pour répondre à « sur quoi il travaille en ce
moment ? » sans cliquer semaine par semaine.

### Ce que le jeune voit

Dans **Mon espace › Saison** : la même frise, pour lui seul ; en touchant une
semaine, le type, le tennis, la prépa physique, la note et l'état du
week-end ; un formulaire pour **ajouter ses propres inscriptions** ; et un
avertissement si une inscription tombe hors des zones prévues.

Il ne peut ni modifier la planification, ni toucher aux inscriptions saisies
par un coach. Il ajoute et retire les siennes.

⚠️ L'onglet « Saison » n'existe que pour **pro, pro U18 et sport-études**.
Compétition et performance ne l'ont pas : la frise déroutait leurs familles.

### Bon à savoir

- **Une zone tournoi est une intention, pas une inscription.** Elle dit « ce
  week-end-là, tu devrais jouer ». C'est au jeune d'inscrire le tournoi qu'il
  a choisi.
- **Le rouge mérite une conversation.** Il signale une inscription en dehors
  de ce qui était prévu : ce n'est pas une erreur en soi, mais ça n'a pas été
  planifié.
- **Ne pas laisser de zones au-delà de la planification réelle.** Une zone
  posée sur un week-end dont personne ne s'est occupé promet un tournoi qui
  n'existe pas.
- **La planification de Célyan Lorival sert de modèle** : reprise du tableur
  annuel, du 28 septembre au 29 mars, avec le tennis et la prépa physique de
  chaque semaine.

---

## 4. Cours

### Ce que c'est

Le planning de tous les cours de l'académie, et les modèles qui servent à les
créer. C'est l'écran le plus utilisé de la console.

**Qui peut écrire** : tout l'encadrement. Un moniteur voit « Cours » et
« Heures », rien d'autre.

### Les deux sous-onglets

- **« Planning »** — la grille des cours. Vues « Jour » et « Semaine ».
- **« Types de cours »** — les modèles réutilisables, pour ne pas ressaisir
  les mêmes réglages à chaque fois.

### Créer un cours

1. Se placer sur la bonne date (le champ date, ou les flèches « ‹ » et « › »).
2. « + Nouveau cours ».
3. Remplir, puis « Ajouter ».

Les leçons se posent **au quart d'heure** et **bloquent le court** : un cours
occupe le court exactement comme une réservation. Inutile de poser une
réservation en plus — ce serait un double.

### Recopier une semaine

« Copier la semaine » reprend une semaine entière et la pose sur une autre.
C'est le geste qui fait gagner le plus de temps en début de saison.

1. Afficher la semaine à recopier.
2. « Copier la semaine ».
3. Donner une date de la semaine cible — n'importe quel jour de cette
   semaine-là suffit.
4. « Vérifier » montre ce qui serait créé avant que quoi que ce soit ne parte.

### L'appel

L'appel d'un cours **s'ouvre 25 minutes avant le début** et reste ouvert deux
semaines. Avant cette fenêtre, les pastilles ne réagissent pas : ce n'est pas
une panne.

Qui peut marquer quoi :

- **head coach, admin, superadmin** : tout, tout le temps.
- **un coach du cours** : les élèves de son cours, dans la fenêtre ; et sa
  propre présence, qu'il peut annoncer à l'avance (absence anticipée).
- **un coach qui n'est pas sur le cours** : rien.

Les quatre états sont « Présent », « Absent », « En retard » (élèves) et
« En attente ».

### Autres boutons

- **« + Déplacement »** pose un déplacement.
- **« Filtrer par coach ou joueur… »** réduit la grille à une personne.

### Bon à savoir

- **Un cours détaillé sans segment compte zéro heure.** Si un coach apparaît
  avec « 0 h » dans Heures alors qu'il a donné cours, c'est presque toujours
  ça : le cours existe, mais ses segments ne sont pas renseignés.
- **Le nombre de courts suit la saison** : 12 en été (10 extérieurs + 2
  intérieurs), 6 en hiver. Le filtre est automatique.

---

## 5. Stages

### Ce que c'est

Les camps de vacances : les semaines, les formules proposées, les inscrits.

### Les quatre sous-onglets

« Stages » (les semaines) · « Catégories » (les formules) · « Mails » ·
« Questionnaires » (satisfaction).

### Ouvrir une semaine de stage

1. « + Nouveau stage ».
2. Donner le titre et les dates.
3. Enregistrer, puis rattacher les catégories proposées **cette
   semaine-là**.

Une semaine n'apparaît sur le site public que si elle a **au moins une
catégorie ouverte**. Les catégories proposées viennent du rattachement, pas de
la liste générale : une formule non rattachée n'est pas proposée cette
semaine-là.

« Modifier le stage » rouvre une semaine, « ← Retour à la liste » en sort.

### Inscrire quelqu'un à la main

Ouvrir la semaine → **« + Ajouter un inscrit »**.

### Les catégories

« + Nouvelle catégorie » crée une formule : son nom, son **prix**, si le
**repas de midi** est compris, et le prix d'une éventuelle **option 3 h de
privé**.

**Le prix d'une semaine écourtée est calculé au prorata des jours, plafonné à
cinq.** Une semaine de 3 jours à 500.– se facture 300.–. C'est automatique :
ne pas recalculer à la main.

### Bon à savoir

- ⚠️ **Aucun mail de stage n'est automatique.** Les modèles de l'onglet
  « Mails » sont éditables, mais il n'y a ni tâche planifiée, ni déclencheur,
  ni bouton d'envoi en série. Les mails de stage partent à la main.
- **Le nombre d'inscrits ne dit rien des places restantes** et n'est jamais
  communiqué au public.

---

## 6. Factures

### Ce que c'est

Toute la facturation, émise et reçue. La facturation est **maison** :
QR-facture suisse, rapprochement par import CAMT. Aucun identifiant bancaire
ne passe par la console.

**Qui le voit** : administrateurs seulement.

### Les huit sous-onglets

| Sous-onglet | Ce qu'on y fait |
|---|---|
| Reçues — à payer | Les factures fournisseurs |
| Émises — à encaisser | Ce qu'on a facturé |
| Encaissements | Les paiements reçus |
| Relances | Les rappels envoyés |
| Abonnements hiver | La facturation de l'hiver |
| À facturer | Ce qui attend d'être facturé |
| Produits | Le catalogue |
| Tarifs | Les prix |

### Facturer quelqu'un

- **Une facture isolée** : « ➕ Nouvelle facture ».
- **Une filière entière** : « Lot par filière », puis « Préparer un lot de
  factures ».

Une facture naît au statut **« à envoyer »** : elle existe, rien n'est parti.
Pour l'envoyer, la cocher dans « Émises — à encaisser » puis
**« ✉ Envoyer la sélection »**.

### Retrouver une facture

Le champ de recherche cherche dans le **numéro**, le **destinataire**, le
**joueur**, l'**e-mail**, le **libellé** et le **montant**. Plusieurs mots se
cumulent : « loit 1500 » ne rend que cette facture-là.

Pour le montant, toutes les écritures marchent — « 1500 », « 1'500 »,
« 1 500 », « 1500.00 », « 1500,00 ». Le montant est comparé **en entier** :
taper « 50 » ne sort pas les factures de 1 500.–.

### Ce que porte une facture

- Un **numéro** de la forme `2026-0364`, qui se suit dans l'année.
- Une **référence QR** de la forme `RF27…`, calculée à partir du numéro. Elle
  ne se saisit pas à la main : une référence fausse est une facture que la
  banque refuse.
- Un **débiteur** : la personne qui paie. Pour un mineur c'est un parent ;
  pour un majeur, lui-même.
- Une **échéance**, par convention le 20 du mois suivant.

### Payer une facture reçue

« 🏦 Générer paiement » prépare le paiement d'une facture fournisseur.
« ⬇ Export ZIP » télécharge un lot.

### Bon à savoir

- **Rien ne part tout seul.** Préparer un lot ne l'envoie pas.
- **Une adresse postale incomplète bloque la QR-facture.** Rue, code postal et
  localité sont nécessaires : c'est la fiche du Répertoire qu'il faut
  compléter, pas la facture.

---

## 7. Heures

### Ce que c'est

Les heures des coachs et des profs, pour la paie. Deux sous-onglets :
« Décompte » et « Privé-adultes ». Deux sections : « Coachs — cours » et
« Profs — études ».

### Sortir un décompte

1. Choisir la période.
2. « ⬇ Décompte PDF » pour le document, ou « Exporter (CSV) » pour le tableur.
3. « ✉ Envoyer à la fiduciaire » transmet.

### Payer un camp à l'heure plutôt qu'au forfait

L'encadrement d'un camp se paie normalement **au forfait** : le montant est
posé sur la fiche du coach dans le camp, et une semaine de stage ne produit
aucun cours. Quand on convient exceptionnellement de le payer **à l'heure**,
il faut faire les deux gestes, dans cet ordre :

1. **Poser les heures.** Créer un cours par demi-journée dans Cours →
   Planning, aux vraies heures, avec le coach dessus — et **le marquer
   présent**. Sans la présence, le cours existe mais compte **zéro heure** :
   c'est la règle du décompte, pas un bug.
2. **Retirer le forfait du camp.** Dans la fiche du camp, mettre son forfait à
   **0** et écrire pourquoi dans la note.

**Le deuxième geste est celui qu'on oublie.** Le forfait et les heures
s'additionnent : un coach à qui l'on pose 15 h à 40.– sans toucher à son
forfait de 350.– reçoit 950.– au lieu de 600.–, et rien à l'écran ne le
signale.

*Exemple réel — Yann Perez, camp d'automne semaine 2 (19–23.10.2026) : 3 h
chaque matin à 40.–, soit 600.–, à la place du forfait de 350.–.*

### Bon à savoir

- **Un coach à 0 h qui a donné cours** : voir Cours → « un cours détaillé sans
  segment compte zéro ».
- Les coordonnées bancaires et les tarifs d'un coach se règlent dans son
  sous-onglet Coach, pas ici.
- **Le tarif horaire** d'un coach est enregistré une fois et s'applique tout
  seul au décompte : il n'y a rien à ressaisir chaque mois.

---

## 8. Note de frais

### Ce que c'est

Les dépenses que vous avancez de votre poche pour l'académie : carburant,
fournitures, repas, affranchissement. Vous les saisissez, vous joignez le
justificatif, et l'académie vous rembourse.

**Qui voit quoi** : chacun voit **ses** dépenses. Dan, Raphaël et Arsalan
voient celles de tout le monde et peuvent les corriger — Arsalan vérifie que
chaque dépense est rangée sous le bon compte.

### Ajouter une dépense — la bonne façon

1. **« ⬆ Déposer un justificatif »** et choisir le PDF.
2. La fiche s'ouvre **déjà remplie** : date, montant, n° de transaction,
   catégorie, lus dans le document.
3. **Vérifier**, corriger si besoin, puis « Enregistrer ».

Ce qui n'a pas pu être lu reste vide plutôt que deviné. Le bandeau en haut de
la fiche dit ce qui a été lu et avec quelle confiance.

« + Saisir à la main » fait la même chose sans PDF — le justificatif pourra
être ajouté ensuite.

### Le cycle d'une dépense

| État | Ce que ça veut dire |
|---|---|
| **À valider** | Saisie, pas encore confirmée. Modifiable et supprimable. |
| **Validée** | Confirmée par son auteur. **Le justificatif est obligatoire ici.** |
| **Remboursée** | Versée. Son auteur ne peut plus la modifier. |

« Valider » n'apparaît que si un justificatif est joint : c'est la règle de la
note de frais, pas un caprice de l'écran. « Remboursée » est réservé à Dan,
Raphaël et Arsalan.

### Le total

En bas à droite, en gros. **Il porte sur les lignes affichées**, et son
libellé suit le filtre : « À rembourser », « Déjà remboursé », « En attente
de validation ». Si le chiffre vous surprend, regardez d'abord quel filtre est
actif.

### Sortir la note de frais

- **« ⬇ Excel »** — le tableau complet avec le total, pour la comptabilité.
- **« ⬇ PDF »** — le même récapitulatif, à imprimer ou à envoyer.
- **« ⬇ Justificatifs (PDF unique) »** — un seul fichier : le récapitulatif en
  page de garde, puis **tous les justificatifs à la suite**, chacun coiffé
  d'un bandeau « Dépense n° · date · montant ».

Les dépenses sont numérotées 1, 2, 3… dans les trois sorties. C'est ce qui
permet de retrouver le justificatif d'une ligne sans comparer les montants.

### Bon à savoir

- **Les trois exports disent ce que montre l'écran** : mêmes lignes, même
  ordre, même total. Filtrez avant d'exporter.
- **Une dépense sans justificatif** apparaît « manquant » en rouge, est
  comptée dans le total, mais ne peut pas être validée — et le PDF le
  signale.
- **Supprimer une dépense supprime aussi son justificatif.**

---

## 9. Réserv.

### Ce que c'est

La grille des courts. Sous-onglets « Jour » et « Réglages ».

### Réserver et se repérer

- « Aujourd'hui » revient au jour courant.
- « + Déplacement » pose un déplacement.
- Les vues « La semaine », « Le jour affiché », « Le mois ».
- La bande du haut montre **qui est hors du club** ce jour-là : on la lit
  avant de chercher un créneau.

### Les réglages

« Saison d'hiver », « Quotas & règles », « Visibilité des noms »,
« Tarifs (CHF) », « Email de confirmation », puis « Enregistrer les
réglages ».

### Bon à savoir

- **Un cours bloque déjà le court.** Ne pas doubler d'une réservation.
- **Le nombre de courts suit la saison**, sans rien régler : 12 en été, 6 en
  hiver.

---

## 10. Répertoire

### Ce que c'est

Les fiches de toutes les personnes : membres, juniors, parents, staff.
Sous-onglets « Personnes » et « Locations de courts ».

### Créer et retrouver

« + Nouveau » crée une fiche. Le champ de recherche filtre la liste : nom,
e-mail, téléphone **ou adresse** (rue, code postal, localité). Plusieurs mots
se combinent et les accents ne comptent pas : « pully cour » trouve les gens
de l'avenue de Cour à Pully.
« + Nouveau locataire » pour une location de court.

### Les trois notions de rôle

C'est le point qui prête le plus à confusion :

1. les **étiquettes** de la fiche : ce que la personne est (junior, parent…) ;
2. les **accès** : ce que le compte peut ouvrir — c'est ce que lit la
   sécurité ;
3. le **rôle de filière par saison** : kidstennis, club, compétition,
   performance, sport-études, pro, pro U18, adultes.

La fiche synchronise les deux premiers : poser une étiquette ouvre l'accès
correspondant. L'onglet « Saisons » de la fiche garde l'historique.

### Onglet « Factures » de la fiche

Toutes les factures émises qui concernent la personne, toutes années
confondues, de la plus récente à la plus ancienne : n°, date, libellé,
montant, reste à payer, état, et 📄 pour ouvrir le PDF. En tête, le total
facturé et ce qui reste dû. Une facture y figure si elle est pour ce joueur,
adressée à cette personne, ou envoyée à l'une de ses adresses e-mail : la
fiche d'un parent montre donc les factures de ses enfants (« pour … »).
Visible seulement pour l'admin et le tag « Finance », comme l'onglet Factures.
Lecture seule : on modifie ou encaisse une facture dans Factures.

### Licences et mytennis

« Retrouver les licences », « Chercher sur mytennis », « Importer (Excel) ».

### Bon à savoir

- **Une fiche sans code postal bloque la facturation.** C'est ici qu'on
  complète, pas dans Factures.

---

## 11. Calendrier

### Ce que c'est

Le calendrier de l'académie : événements, vacances, fermetures, absences.

### Ajouter une entrée

1. « ＋ Ajouter un événement ».
2. Remplir « Nouvel événement ».
3. « Enregistrer ».

### Qui verra cette ligne — le point important

Par défaut une entrée est **interne** : elle reste dans la console.

- Rien de coché → **interne**. Réunions, RDV, déjeuners : rien à faire.
- « Afficher sur le calendrier public » coché → visible **sur le site**.
- Une ou plusieurs **filières** cochées → visible par ces familles dans Mon
  espace, et **retiré du site public**.

Seuls les **événements** peuvent viser des filières. Les fermetures, camps,
vacances et jours fériés valent pour tout le monde.

Le formulaire écrit en toutes lettres où va la ligne. Dans la grille, une
pastille signale ce qui sort de la console : **verte** pour le site public,
**bleue** pour les familles d'une filière. **Pas de pastille = interne**,
l'état par défaut.

### Vacances et absences

« 🏖 Demander des vacances » et « 🤒 Déclarer une absence ».
Vues « Mois », « Année », « Liste des semaines » ; « Aujourd'hui » recentre.

---

## 12. Accès Mon espace

Pour donner aux familles l'accès à l'app « Mon espace ».

1. « Inviter les comptes sans accès » envoie l'invitation à ceux qui n'en ont
   pas encore.
2. « Aperçu sur téléphone » montre ce que la famille verra ; « ↗ Ouvrir en
   grand », « ↻ Recharger ».
3. Le texte du « mail d'invitation » se modifie puis « Enregistrer le
   texte » ; « M'envoyer un test » l'envoie à soi-même d'abord.
4. « La console d'un coach, sur téléphone » (admin seulement) : choisir un
   rôle (coach physique, coach mental, coach, head coach, moniteur, prof) et
   une personne, et la console s'affiche dans le cadre telle qu'elle la voit :
   ses onglets, ses boutons, ses cours. Les données restent celles de l'admin,
   donc souvent plus larges : c'est pour la mise en page, pas pour vérifier
   des droits. Lecture seule : rien de ce qu'on fait dans le cadre n'est
   enregistré, un bandeau jaune le rappelle.

**Bon à savoir** : les robots d'aperçu de WhatsApp peuvent consommer un lien
d'activation avant la personne. C'est pour ça que le jeton vit dans le `#` de
l'adresse.

---

## 13. Réglages

Trois sous-onglets : « Accès & rôles », « Saisons », « Suivi de l'Aide ».

### Accès & rôles

« Accès des onglets par rôle » dit quel rôle voit quel onglet ;
« Enregistrer les accès » valide. « Comptes & rôles » liste les comptes.

### Saisons

« + Créer » ouvre une saison. On y règle la « Cotisation (membre) » et les
« Cours juniors ». « Bascule / reconduction » prépare la saison suivante,
« Appliquer la reconduction » l'exécute.

### Suivi de l'Aide

Ce que l'équipe demande à l'Aide sur 30 jours. Quatre chiffres —
Conversations, Questions, **Pas dans le guide**, Coût — puis le tableau des
conversations. Un clic ouvre tout l'échange, avec en tête les questions que le
guide ne couvrait pas.

La pastille **« Pas dans le guide »** est celle qui sert : chaque ligne y est
un morceau de guide à écrire. Réservé aux administrateurs.

---

## 14. Les autres écrans

Ces écrans ne sont pas encore décrits au même niveau de détail. L'Aide y
répondra qu'elle ne sait pas, et la question remontera dans
**Réglages → Suivi de l'Aide**, ce qui dira lesquels écrire en premier.

- **Dashboard** — vue d'ensemble du jour. « ↻ Actualiser ».
- **Inscriptions** — les demandes venues du formulaire public du site.
- **Prospects** — joueurs repérés hors académie. Sous-onglets « Liste »,
  « Suivi », « Import / outils ». « ➕ Nouveau prospect ».
- **Accueil espace privé** — messages affichés dans Mon espace, par saison et
  par filière. « + Nouveau message ». Une ligne « @saison Saison —
  description » s'affiche avec l'icône de l'onglet correspondant.
- **Messagerie** — la boîte info@. « ✉ Nouveau message », « ↩ Répondre »,
  « Relever », « Brouillons », « Filtres ▾ ». La recherche à plusieurs mots
  trouve les messages contenant *chacun* des mots ; entre guillemets,
  l'expression exacte.
- **Newsletter** — « ✉ Nouvelle newsletter ».
- **Social Media Planner** — « ＋ Nouvelle publication », vues « Calendrier »,
  « Tableau », « Grille », « Rushes ». Un accord écrit est obligatoire pour
  passer en « Programmé » : beaucoup des personnes filmées sont mineures.
- **Assistant** — le bot du **site public**, à ne pas confondre avec l'Aide.
  Sous-onglets « Statistiques », « Conversations », « Consignes », « Tester ».
- **Saison hiver**, **Casiers**, **Last scores**, **Anniversaires** — écrans
  simples, sans geste particulier.
- **Feuille de match** — « Remplir en tant que coach », « Formulaires remplis
  en tant que coach », « Toutes les feuilles », « Correspondances à valider ».
- **Tests phys.** — « + Remplir un test », « + Nouveau test ».
- **Physique** — « Par jeune » et « Routines ». La page d'un jeune a trois
  parties : ses routines (cases à cocher), « Vidéos et photos » (choisir un
  fichier, écrire un commentaire, « Ajouter » ; 50 Mo au plus, donc filmer en
  1080p plutôt qu'en 4K) et la discussion « Prépa physique ». Les vidéos et
  photos sont privées : seuls le staff physique et le jeune (et sa famille) les
  voient, dans Mon espace › Physique › Vidéos, avec le commentaire ; le jeune
  et ses parents reçoivent une notification sur leur téléphone (« Physique —
  nouvelle vidéo », avec le commentaire), qui ouvre directement les vidéos. C'est là
  qu'on met une vidéo destinée au joueur, pas dans Fiche › Photos / vidéos
  (que le joueur ne voit pas).
- **Études** — « Calendrier », « Par jeune », « Profs », « Réglages ».
  « Appliquer le planning », « Attribuer », « Générer le calendrier ».
  La grille du Calendrier ne montre que les élèves qui viennent en étude : un
  jeune « pas prévu » tous les jours de la saison (planning posé dans « Par
  jeune ») n'y a pas de colonne. Ses leçons privées restent écrites sous la
  date, à gauche, pour que les profs les voient.
- **Mental** — « Calendrier », « Participants », « Routines ».
  « + Ajouter une séance ».
- **CSEL** — « Repas de midi », « Études », « Totaux repas ».
  « Réinitialiser selon le contrat », « Exporter en PDF ».
  Séline voit les repas et les totaux et peut changer les cases de la semaine
  comme un admin (« Réinitialiser » compris). Arsalan les voit sans pouvoir
  les changer. Ni l'un ni l'autre n'a le sous-onglet Études.
- **GameZone** — tournois juniors, sept sous-onglets. « Gérer le tournoi »,
  « Nommer responsable », « J'ai pris » / « Pas encore pris »,
  « Clôturer le tournoi ».
- **Caisse** — « Ajouter un mouvement ».
- **Serrures** / **Arrosage** — « + Ajouter une serrure », « + Ajouter une
  zone ». Journal récent.
- **Stats** — les chiffres, par domaine. « Tout l'historique ».

---

## 15. Ce que la console fait toute seule

- **L'appel d'un cours** s'ouvre 25 minutes avant le début.
- **Le nombre de courts** suit la saison.
- **Un cours bloque le court** : pas besoin de réservation en plus.
- **Les rôles d'accès** suivent les étiquettes d'une fiche.
- **Le prix d'un stage écourté** se calcule au prorata, plafonné à cinq jours.
- **La référence QR d'une facture** se calcule depuis son numéro.
- **Rien ne part tout seul par mail** sauf ce qui est écrit comme tel. En
  particulier, les mails de stage ne sont pas automatisés, et préparer un lot
  de factures ne l'envoie pas.

---

## 16. Questions fréquentes

**Je ne vois pas un onglet dont on me parle.**
C'est le rôle de votre compte. Un administrateur l'ouvre dans « Réglages →
Accès & rôles ».

**J'ai mis un rendez-vous dans le calendrier, les parents le voient ?**
Non, sauf si vous avez coché « Afficher sur le calendrier public » ou une
filière. Sans rien cocher, une entrée reste interne.

**Comment recopier le planning d'une semaine sur la suivante ?**
Cours → Planning → « Copier la semaine ».

**Comment inscrire un enfant à un stage à la main ?**
Stages → ouvrir la semaine → « + Ajouter un inscrit ».

**Où sont les heures d'un coach pour la paie ?**
Heures → « Décompte », section « Coachs — cours », puis « ⬇ Décompte PDF ».

**Un coach apparaît avec 0 h alors qu'il a donné cours.**
Le cours est détaillé mais ses segments ne sont pas renseignés. C'est dans
Cours qu'on corrige.

**Comment donner à une famille l'accès à Mon espace ?**
Accès Mon espace → « Inviter les comptes sans accès ».

**Une facture refuse de partir / la QR ne passe pas.**
Vérifier l'adresse de la fiche : rue, code postal et localité sont
nécessaires.

**Comment planifier la saison d'un joueur élite ?**
Planning tournois → « Calendriers » → cliquer sa ligne, puis choisir un
pinceau et glisser sur les semaines. Voir la section 3.
