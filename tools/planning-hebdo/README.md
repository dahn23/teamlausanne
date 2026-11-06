# Plannings hebdomadaires des jeunes élite

Une page A4 paysage par joueur — sport-études, pro, pro U18 — à envoyer en
début de semaine. Reprend la mise en page des plannings d'octobre 2026 :
l'entête (logo, filière, nom, dates), la semaine du lundi au vendredi en cinq
colonnes, les séances en blocs colorés avec l'heure, le coach et les courts,
et le total en pied de page.

Pas d'aperçu ici : la moindre capture montrerait l'emploi du temps d'un
mineur, nommément. Lancer le script, le premier PDF fait l'exemple.

## Faire la semaine

Deux gestes.

**1. Les séances.** Ouvrir `requete.sql`, remplacer le lundi et le vendredi,
exécuter sur la base, coller le résultat dans `seances.txt` (à côté de ce
fichier). Une ligne par séance :

```
Talia Picci|sport-etudes|09|09:15|10:15|Pro Physique|Andreas Egger|Fitness
```

**2. Les PDF.**

```bash
node tools/planning-hebdo/gen.cjs 2026-11-09
```

L'argument est le **lundi** de la semaine. Tout le reste en découle : les
dates des colonnes, le titre, les noms de fichiers, le dossier de sortie
(`exports/Plannings 9-13 novembre 2026/`). Un second argument facultatif
donne un autre fichier de séances.

Chrome doit être installé — c'est lui qui imprime les PDF. Rien d'autre :
pas de dépendance npm, pas de token.

## Ce que le script décide tout seul

- **La famille d'une séance** vient du **nom** du type de cours, pas de sa
  couleur en base : « Privé » → Leçon privée (orange), « Physique » →
  Physique (vert), le reste → Tennis (bleu). En base, Tennis et Physique
  partagent le même bleu, ce qui rendrait la page illisible.
- **La frise horaire** s'adapte à la semaine (08:00 au plus tard, et jusqu'à
  la dernière séance), à l'heure pleine.
- **Les heures du pied de page** sont l'**union** des créneaux, pas leur
  somme : deux séances qui se chevauchent ne font pas deux fois des heures.
- **Les chevauchements** sont dessinés côte à côte et **listés en fin
  d'exécution**. Un jeune ne peut pas être à deux endroits : c'est une erreur
  de planning à corriger avant d'envoyer.

## Avant d'envoyer

- **Les chevauchements** signalés en fin d'exécution.
- **Qui a disparu.** Un joueur sans séance n'a pas de ligne, donc pas de PDF,
  et personne ne le remarque. La requête de contrôle en bas de `requete.sql`
  compare les trois dernières semaines : une colonne qui tombe à zéro est
  presque toujours un oubli de saisie, pas une semaine de repos. (Le 06.11.2026,
  Noah Lopez passait de 8 et 5 séances à 0 — c'était bien un trou.)
- **Qui n'a jamais rien.** Un joueur à zéro partout a un rôle de filière mais
  aucun cours : à vérifier côté fiche.

## Où ça sort

`exports/`, qui est **ignoré par Git** (`.gitignore`) : ce sont des horaires
nominatifs de mineurs, ils n'ont rien à faire dans le dépôt. `seances.txt`
l'est aussi, pour la même raison.

## Ce qui n'est pas encore là

- **Le PDF du coach** (`Planning coach … - Prénom Nom.pdf` existait en
  octobre) : à refaire quand il sera demandé.
- **L'envoi.** Les PDF sont produits, pas envoyés. C'est volontaire : on les
  relit avant qu'ils partent aux familles.
