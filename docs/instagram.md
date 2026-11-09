# Le flux Instagram du site

Le bandeau « Le club, au jour le jour », en bas de chaque page du site public,
montre les vraies publications de **@team_lausanne_academy**.

Tout est en place **sauf une chose** : le jeton d'accès de Meta. Il demande un
passage par votre compte Meta, que personne d'autre ne peut faire à votre
place. Tant qu'il manque, le bandeau garde les photos du site — rien n'est
cassé, rien ne clignote, personne ne voit de différence.

## Comment ça marche

```
site → fonction « instagram » (Supabase) → cache en base → Meta
```

Le site **ne parle jamais à Meta**. Il appelle notre fonction, qui sert un
cache et ne va chercher du neuf que si le cache a plus de six heures. Trois
raisons :

- le jeton reste sur le serveur, jamais dans le navigateur d'un visiteur ;
- Meta ne voit pas qui visite le site ;
- si Meta tombe, la page ne tombe pas : on sert le dernier cache.

Et si tout échoue, le bandeau revient aux photos du site.

## Les cinq étapes, côté Meta

1. **Passer le compte en Professionnel.** Dans l'app Instagram :
   Paramètres → Type de compte → *Basculer vers un compte professionnel*
   (Entreprise ou Créateur, peu importe). C'est gratuit et réversible.
2. **Créer une app Meta.** Sur `developers.facebook.com`, *Mes apps* →
   *Créer une app*. Prenez le type qui propose le produit **Instagram**.
3. **Ajouter le produit « Instagram »**, puis la configuration
   « **API setup with Instagram login** » — c'est la voie courte, qui n'exige
   **pas** de page Facebook.
4. **Lier le compte** @team_lausanne_academy à l'app, dans cette même page.
5. **Générer un jeton d'accès** pour ce compte. Meta affiche un bouton
   *Generate token*. Le jeton obtenu dure **60 jours** ; ensuite notre
   fonction le renouvelle toute seule.

> L'interface de Meta change souvent. Si les intitulés ne correspondent pas,
> envoyez-moi une capture : les notions (compte professionnel, app, produit
> Instagram, jeton) ne bougent pas, seuls les libellés changent.

## Poser le jeton

**Pas par message, pas dans le dépôt.** Dans Supabase → *SQL Editor*, coller
ceci en remplaçant la valeur :

```sql
insert into insta_secret (id, token, expires_at)
values (1, 'COLLER_LE_JETON_ICI', now() + interval '60 days')
on conflict (id) do update
  set token = excluded.token, expires_at = excluded.expires_at, updated_at = now();
```

C'est tout. À la prochaine visite du site, le bandeau se remplit.

## Vérifier

Que le jeton est posé — sans le montrer :

```sql
select id, expires_at, refreshed_at, length(token) as longueur from insta_secret;
```

Ce que le cache contient :

```sql
select count(*), max(fetched_at) from insta_posts;
```

Et la fonction elle-même, depuis n'importe quel navigateur :
`https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/instagram`

La réponse dit d'où viennent les photos :

| `raison` | Ce que ça veut dire |
|---|---|
| `jeton absent` | Le jeton n'a pas encore été posé. |
| *(aucune)*, `source: "meta"` | Tout va bien, on vient de lire chez Meta. |
| *(aucune)*, `source: "cache"` | Tout va bien, le cache a moins de six heures. |
| un message de Meta | Le jeton est périmé ou refusé — à regénérer (étape 5). |

## Ce qu'il faut savoir

- **Les adresses d'images de Meta expirent** au bout de quelques jours. C'est
  pour ça que le cache se rafraîchit : il ne garde pas les photos, il garde
  leurs adresses, et il va en rechercher de fraîches.
- **Le bandeau ne bascule que si la première image charge vraiment.** Sinon il
  reste sur les photos du site, et le visiteur ne voit jamais de trou.
- **Il faut au moins quatre publications** pour remplir la bande ; en dessous,
  on garde les photos du site.
- **Les vidéos** sont affichées par leur vignette, pas lues dans le bandeau.
- **Chaque vignette est un lien** vers la publication sur Instagram.
