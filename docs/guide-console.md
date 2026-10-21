# Guide de la console — Team Lausanne Academy

Ce guide décrit la console écran par écran. C'est la **seule source** de
l'Aide : si une manipulation n'est pas écrite ici, l'Aide répond qu'elle ne
sait pas plutôt que d'inventer un bouton.

> **Règle du dépôt.** Toute modification d'un écran — nouveau bouton, onglet
> renommé, automatisme ajouté — met à jour ce fichier **dans le même commit**.
> Sinon l'Aide explique une console qui n'existe plus.

Les libellés exacts sont entre guillemets : « Enregistrer », « + Nouveau ».
Les chemins s'écrivent « Onglet → Sous-onglet → bouton ».

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
où on est.

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
| Réglages | Rôles, accès, saisons, tarifs | admin |
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
| CSEL | Repas et études CSEL | admin |
| GameZone | Tournois juniors | admin, organisateur |
| Caisse | Caisse du secrétariat | admin, secrétariat |
| Factures | Toute la facturation | admin |
| Heures | Heures des coachs et profs | admin, encadrement |
| Serrures | Serrures connectées | admin, secrétariat |
| Arrosage | Arrosage des courts | admin, secrétariat |
| Stages | Camps de vacances | admin, secrétariat |
| Stats | Chiffres de l'académie | admin, secrétariat |

---

## 3. Les écrans, un par un

### Dashboard

La page d'accueil de la console : ce qui se passe aujourd'hui. Le bouton
« ↻ Actualiser » recharge les chiffres sans recharger la page.

### Calendrier

Le calendrier de l'académie. On y pose les événements, les vacances, les
fermetures et les absences.

**Ajouter quelque chose**
1. Bouton « ＋ Ajouter un événement ».
2. Remplir le formulaire « Nouvel événement ».
3. « Enregistrer ».

**Qui verra cette ligne.** C'est le point le plus important de cet écran.
Par défaut une entrée est **interne** : elle reste dans la console. Seuls les
**événements** peuvent viser des filières ; les fermetures, camps, vacances et
jours fériés valent pour tout le monde.

- Rien de coché → interne. C'est le cas des réunions, des RDV, des déjeuners.
- « Afficher sur le calendrier public » coché → visible sur le site.
- Une ou plusieurs filières cochées → visible par ces familles dans Mon
  espace, et **retiré du site public**.

Le formulaire écrit en toutes lettres où va la ligne. Dans la grille, une
pastille signale ce qui sort de la console : verte pour le site public, bleue
pour les familles d'une filière. Pas de pastille = interne.

**Vacances et absences.** « 🏖 Demander des vacances » et « 🤒 Déclarer une
absence » sont les deux boutons du haut. Les vues « Mois », « Année » et
« Liste des semaines » changent l'affichage ; « Aujourd'hui » revient à la
date du jour.

### Répertoire

Les fiches de toutes les personnes : membres, juniors, parents, staff.

Deux sous-onglets : « Personnes » et « Locations de courts ».

**Créer une fiche** : « + Nouveau ».
**Chercher** : le champ de recherche en haut de la liste.

**Les rôles d'une fiche.** Attention, il y a trois notions différentes :
- les **étiquettes** de la fiche : ce que la personne est (junior, parent…) ;
- les **accès** : ce que le compte peut ouvrir, c'est ce que lit la sécurité ;
- le **rôle de filière par saison** : kidstennis, club, compétition,
  performance, sport-études, pro, pro U18, adultes.

La fiche synchronise les deux premiers : poser une étiquette ouvre l'accès
correspondant. L'onglet « Saisons » de la fiche garde l'historique.

**Licences et mytennis** : « Retrouver les licences », « Chercher sur
mytennis », « Importer (Excel) ».

### Inscriptions

Les demandes arrivées par le formulaire public du site. On les lit, on les
traite, et la personne passe ensuite au Répertoire.

### Accès Mon espace

Pour donner aux familles l'accès à l'app « Mon espace ».

- « Inviter les comptes sans accès » envoie l'invitation à ceux qui n'en ont
  pas encore.
- « Aperçu sur téléphone » montre ce que la famille verra ; « ↗ Ouvrir en
  grand » l'ouvre en plus grand, « ↻ Recharger » le rafraîchit.
- « Le mail d'invitation » se modifie puis « Enregistrer le texte » ;
  « M'envoyer un test » l'envoie à soi-même d'abord.

### Prospects

Les joueurs repérés qui ne sont pas (encore) à l'académie.

Sous-onglets « Liste », « Suivi », « Import / outils ».
« ➕ Nouveau prospect » pour en ajouter un à la main.
Les outils d'import : « Importer les classements (mytennis) », « Scanner les
résultats récents (exploits) », « Récupérer des coordonnées (portail
licences) », et « Calculer les distances ».

### Accueil espace privé

Les messages qui s'affichent en haut de Mon espace, par saison et par filière.
« + Nouveau message ».

Une ligne écrite « @saison Saison — description » s'affiche avec l'icône de
l'onglet correspondant, reprise de la barre du bas de l'app.

### Messagerie

La boîte info@teamlausanne.ch, dans la console.

- Écrire : « ✉ Nouveau message » (ou « ✉ Nouveau »), puis « Envoyer ».
  « Enregistrer le brouillon » met de côté ; on les retrouve sous
  « Brouillons ».
- Répondre : « ↩ Répondre ».
- Relever le courrier : « Relever ». Pour aller chercher plus loin en
  arrière : « Importer 6 mois », « Tout importer », « Importer autres
  boîtes ».
- « Filtres ▾ » restreint la liste.
- « ✨ Fiche IA » propose une fiche à partir du message.

**La recherche à plusieurs mots** trouve les messages qui contiennent *chacun*
des mots, n'importe où et dans n'importe quel ordre : objet, expéditeur,
destinataire, texte. Entre guillemets, elle cherche l'expression exacte.

### Newsletter

Les envois groupés. « ✉ Nouvelle newsletter » pour en composer une,
« ↻ Actualiser » pour recharger la liste.

### Social Media Planner

La préparation des publications.

« ＋ Nouvelle publication » ; les vues « Calendrier », « Tableau », « Grille »
et « Rushes » ; « Aujourd'hui » recentre. Sur une publication :
« ✓ Approuver », « ✕ Demander une reprise », « ⧉ Copier la légende »,
« Enregistrer », « Supprimer ».

Un accord écrit est obligatoire pour passer en « Programmé » : beaucoup des
personnes filmées sont mineures.

### Assistant

Le bot qui répond aux **visiteurs du site public**. Rien à voir avec l'Aide :
l'Assistant ne connaît que les pages publiques, l'Aide ne connaît que ce
guide.

Quatre sous-onglets : « Statistiques », « Conversations », « Consignes »,
« Tester ».

- « Consignes » : le prompt, les garde-fous (non modifiables) et
  « Ce que l'assistant reçoit à chaque question ». Boutons « Enregistrer le
  prompt » et « ↺ Rétablir le prompt d'origine ».
- « Tester » : poser une question comme le ferait un visiteur, sans que ça
  compte dans les statistiques. « Nouvelle conversation » repart de zéro.
- Pour l'afficher sur le site : la case « Afficher l'assistant sur le site »
  dans « Consignes », puis « Enregistrer ».

### Réglages

Deux sous-onglets : « Accès & rôles » et « Saisons ».

**Accès & rôles** : le tableau « Accès des onglets par rôle » dit quel rôle
voit quel onglet ; « Enregistrer les accès » valide. « Comptes & rôles »
liste les comptes.

**Saisons** : « + Créer » ouvre une saison. On y règle la « Cotisation
(membre) » et les « Cours juniors ». « Bascule / reconduction » prépare la
saison suivante, « Appliquer la reconduction » l'exécute.

### Réserv.

La grille des courts.

Sous-onglets « Jour » et « Réglages ».

- « Aujourd'hui » revient au jour courant.
- « + Déplacement » pose un déplacement.
- Les vues « La semaine », « Le jour affiché », « Le mois ».
- « Réglages » contient « Saison d'hiver », « Quotas & règles », « Visibilité
  des noms », « Tarifs (CHF) » et « Email de confirmation », puis
  « Enregistrer les réglages ».

Le nombre de courts suit la saison : 12 en été (10 extérieurs + 2 intérieurs),
6 en hiver. Le filtre se fait tout seul.

### Saison hiver

Les abonnements d'hiver.

### Casiers

L'attribution des casiers, séparée en « Hommes » et « Femmes ».

### Cours

Sous-onglets « Planning » et « Types de cours ».

**Planning des cours**
- Vues « Jour » et « Semaine ».
- « + Nouveau cours » crée un cours ; « Ajouter » valide.
- « Copier la semaine » recopie une semaine entière sur une autre : c'est le
  geste qui fait gagner le plus de temps en début de saison.
- « + Déplacement » pose un déplacement.

Les leçons se posent au quart d'heure et **bloquent le court** : un cours
occupe le court comme une réservation.

**L'appel** s'ouvre 25 minutes avant le début du cours.

**Types de cours** : les modèles réutilisables.

### Feuille de match

Quatre sous-onglets : « Remplir en tant que coach », « Formulaires remplis en
tant que coach », « Toutes les feuilles », « Correspondances à valider ».

Côté jeune, la feuille se remplit dans Mon espace en deux temps : l'avant-match
est validé d'abord, l'après-match est envoyé ensuite. Une fois envoyés, les
deux sont figés. Le coach mental et le secrétariat lisent toutes les feuilles.

### Last scores

Les derniers résultats enregistrés.

### Planning tournois

La frise de la saison des jeunes élite.

Sous-onglets « Prochains tournois » et « Calendriers », plus
« Jours sans entraînement ».

Chaque semaine se lit en deux cases : la semaine (prépa, entraînement, option,
vacances, tournoi à l'étranger) et le week-end (tournois). Le head coach, les
coachs et l'administration éditent ; le jeune ajoute ses propres tournois
depuis Mon espace → Saison.

« Prochains tournois » regroupe les tournois aux noms proches, pour organiser
les délégations.

### Tests phys.

Sous-onglets « Tests remplis » et « Créer / éditer ».
« + Remplir un test » saisit un test ; « + Nouveau test » crée un modèle.

### Physique

Deux vues : « Par jeune » et « Routines ». On attribue des routines jeune par
jeune, et le fil « Prépa physique » relie le staff et le jeune.

### Anniversaires

Qui fête son anniversaire, et quand.

### Études

Le sport-études. Sous-onglets « Calendrier », « Par jeune », « Profs »,
« Réglages ».

- « Planning de présence » puis « Appliquer le planning ».
- « Attribuer un prof à des jours » : « Attribuer » et « Retirer ».
- « Générer le calendrier d'une saison » : bouton « Générer le calendrier ».
- « ← Retour à la liste » quand on est dans la fiche d'un jeune.

### Mental

Sous-onglets « Calendrier », « Participants », « Routines ».
« + Ajouter une séance ». La fiche d'un jeune contient « Suivi mental »,
« Discussion avec le jeune » et « Focus de la semaine ».

### CSEL

Sous-onglets « Repas de midi », « Études », « Totaux repas ».
« Réinitialiser selon le contrat » remet les valeurs du contrat ;
« Exporter en PDF » sort le document.

### GameZone

Les tournois juniors. Sept sous-onglets : « Tournois », « Participants »,
« Financier », « Communication », « Sondages », « Site public », « Réglages ».

- « Gérer le tournoi » ouvre un tournoi ; « ← Retour aux tournois » en sort.
- « Nommer responsable », « Ajouter ».
- Caisse : « J'ai pris » / « Pas encore pris » pour le cash au secrétariat.
- « Clôturer le tournoi » le ferme.
- L'import « 1 clic » se fait avec le bookmarklet : « Copier le code ».

### Caisse

La caisse du secrétariat. « Ajouter un mouvement ».

### Factures

Toute la facturation. Huit sous-onglets :

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

- « ➕ Nouvelle facture » en crée une.
- « Préparer un lot de factures » et « Lot par filière » facturent en série.
- « ✉ Envoyer la sélection » envoie les factures cochées.
- « 🏦 Générer paiement » prépare le paiement d'une facture reçue.
- « ⬇ Export ZIP » télécharge un lot.

La facturation est **maison** : QR-facture suisse, et rapprochement par import
CAMT. Aucun identifiant bancaire ne passe par la console.

### Heures

Les heures des coachs et des profs, pour la paie.

Sous-onglets « Décompte » et « Privé-adultes ». Les sections « Coachs —
cours » et « Profs — études ».

- « Exporter (CSV) » pour le tableur.
- « ⬇ Décompte PDF » sort le décompte.
- « ✉ Envoyer à la fiduciaire » transmet.

Les coordonnées bancaires et les tarifs d'un coach se règlent dans son
sous-onglet Coach.

### Serrures

Les serrures connectées, avec un « Journal récent ».
« + Ajouter une serrure ».

### Arrosage

L'arrosage des courts, avec un « Journal récent ».
« + Ajouter une zone ».

### Stages

Les camps de vacances. Sous-onglets « Stages », « Catégories », « Mails »,
« Questionnaires ».

- « + Nouveau stage » crée une semaine ; « Modifier le stage » la change.
- « + Ajouter un inscrit » inscrit quelqu'un à la main.
- « + Nouvelle catégorie » crée une formule (prix, repas, option privé).
- « + Nouveau questionnaire » crée un questionnaire de satisfaction.
- « ← Retour à la liste » revient en arrière.

**Attention** : les modèles de mails de stage sont éditables, mais **aucun
envoi n'est automatique**. Il n'y a ni tâche planifiée, ni déclencheur, ni
bouton d'envoi en série : les mails de stage partent à la main.

Le prix d'une semaine écourtée est calculé **au prorata** des jours, plafonné
à cinq.

### Stats

Les chiffres : « Type de joueur », « Occupation par court », « Réservations
par heure », « Par jour de semaine », « Recettes par jour (CHF) », et le suivi
par domaine (« Réservations », « Cours », « Tennis », « Tests physiques »,
« Études », « Matchs feuilles », « Mental », « Prépa physique »).

« Tout l'historique » élargit la période, « Actualiser » recharge.

---

## 4. Ce que la console fait toute seule

- **L'appel d'un cours** s'ouvre 25 minutes avant le début.
- **Le nombre de courts** suit la saison, sans rien régler.
- **Un cours bloque le court** : pas besoin de poser une réservation en plus.
- **Les rôles d'accès** se mettent à jour quand on change les étiquettes
  d'une fiche.
- **Le prix d'un stage écourté** se calcule au prorata, plafonné à cinq jours.
- **Les factures** se préparent en lots ; l'envoi, lui, reste un geste
  volontaire.
- **Rien ne part tout seul par mail** sauf ce qui est écrit comme tel. En
  particulier, les mails de stage ne sont pas automatisés.

---

## 5. Questions fréquentes

**Je ne vois pas un onglet dont on me parle.**
C'est le rôle de votre compte. Un administrateur l'ouvre dans « Réglages →
Accès & rôles ».

**J'ai mis un rendez-vous dans le calendrier, est-ce que les parents le
voient ?**
Non, sauf si vous avez coché « Afficher sur le calendrier public » ou une
filière. Sans rien cocher, une entrée reste interne.

**Comment inscrire un enfant à un stage à la main ?**
Stages → ouvrir la semaine → « + Ajouter un inscrit ».

**Comment recopier le planning d'une semaine sur la suivante ?**
Cours → Planning → « Copier la semaine ».

**Où sont les heures d'un coach pour la paie ?**
Heures → « Décompte », section « Coachs — cours ». Puis « ⬇ Décompte PDF »
ou « ✉ Envoyer à la fiduciaire ».

**Un élève apparaît avec 0 heure alors qu'il a eu des cours.**
Vérifiez que le cours a bien des segments renseignés : un cours détaillé sans
segment comptait zéro. Si le compte est faux, signalez-le à un administrateur.

**Comment donner à une famille l'accès à Mon espace ?**
Accès Mon espace → « Inviter les comptes sans accès ».

**L'assistant du site ne s'affiche pas.**
Assistant → « Consignes » → cocher « Afficher l'assistant sur le site », puis
« Enregistrer ».
