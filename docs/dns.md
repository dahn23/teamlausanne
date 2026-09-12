# DNS — domaines de Dan (regroupement chez Hostpoint)

Relevé public du **09–12.09.2026**. Sert de liste de contrôle pour recréer chaque zone chez **Hostpoint** (registrar + DNS uniques, décidé le 12.09.2026 ; Infomaniak et Cloudflare exclus).
Messagerie = **Google Workspace** sur teamlausanne.ch, lausanneopen.ch, swisssportadvisors.com (on ne touche pas aux comptes, on recopie MX/SPF). Sites = **Netlify** partout. Newsletter = Resend.

## État de départ

| Domaine | Registrar | DNS | Site (Netlify) | Mail | Échéance |
|---|---|---|---|---|---|
| teamlausanne.ch | Wix (via EPAG) | Wix | zesty-clafoutis-a95fbc (site), teamlausanne (app) | Google Workspace | 18.06.2027 |
| lausanneopen.ch | **Hostpoint** (domaine « connecté » dans Wix, jamais acheté chez Wix) | Wix | lausanne-open-site, lausanne-open-2026 (players), lausanne-open-welcome (welcome) | Google | ? |
| swisssportadvisors.com | GoDaddy | Netlify DNS (NS1) | swiss-sport-advisors | Google | **24.10.2026** |
| nmind.ch | Infomaniak | Infomaniak | nmind-ch | Infomaniak (mta-gw) | ? |
| katapultapp.net | Namecheap (enregistré le 10.11.2025) | Cloudflare | **inconnu : sert un site de paris turc « Ligobet »** → probablement perdu/racheté par un tiers, à vérifier dans le compte Namecheap | aucun | 10.11.2026 |

## teamlausanne.ch

| Type | Nom | Valeur | Prio | Rôle |
|---|---|---|---|---|
| A | @ | 75.2.60.5 | | Site public (Netlify `zesty-clafoutis-a95fbc`) |
| CNAME | www | zesty-clafoutis-a95fbc.netlify.app | | Site public |
| CNAME | app | teamlausanne.netlify.app | | Console + portail |
| MX | @ | aspmx.l.google.com | 10 | Boîte mail Google |
| MX | @ | alt1.aspmx.l.google.com | 20 | Boîte mail Google |
| MX | @ | alt2.aspmx.l.google.com | 30 | Boîte mail Google |
| MX | @ | alt3.aspmx.l.google.com | 40 | Boîte mail Google |
| MX | @ | alt4.aspmx.l.google.com | 50 | Boîte mail Google |
| TXT | @ | `v=spf1 include:_spf.google.com ~all` | | SPF Google |
| TXT | @ | `google-site-verification=pdFNVcQkCcytMO094mQcxDXwis_6pHYb3OqADWwMMFA` | | Vérification Google |
| TXT | resend._domainkey | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmoM3OZgs5CEqqUjMhnpsBX157d/DLbVmdTDj9Vx2nOVZP28tScP+IxdtiJ905vmcjFABTuhIPJaUGLrJ30p9qrLj2ZJvUnhJjOVwV/UzAgF0piJtgylxRqCrSsiRt+i1Ygn3LfMUOUwTHoC3xar/DW1n73vjgjzjs8ep5czwKKQIDAQAB` | | DKIM Resend |
| TXT | send | `v=spf1 include:amazonses.com ~all` | | SPF Resend |
| MX | send | feedback-smtp.eu-west-1.amazonses.com | 10 | Retours Resend — **impossible chez Wix**, à poser chez Hostpoint |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:info@teamlausanne.ch` | | DMARC (remplace le CNAME Wix `_dmarc.wixemails.com`) |

À **ne pas** recréer (propres à Wix Ascend, obsolètes une fois parti) : CNAME `s1._domainkey`, `s2._domainkey`, `sel1._domainkey` → `*.s014.ascendbywix.com`.

Optionnel plus tard : DKIM Google Workspace (Admin Google › Gmail › Authentifier les e-mails) → TXT `google._domainkey`. Pas en place aujourd'hui.

## lausanneopen.ch

| Type | Nom | Valeur | Prio | Rôle |
|---|---|---|---|---|
| A | @ | 75.2.60.5 | | Redirection vers teamlausanne.ch/#tournoi (Netlify `lausanne-open-site`) |
| CNAME | www | lausanne-open-site.netlify.app | | idem |
| CNAME | players | lausanne-open-2026.netlify.app | | Player Hub (dossier `open/`) |
| CNAME | welcome | lausanne-open-welcome.netlify.app | | Page d'accueil joueurs (dossier `welcome/`) |
| MX | @ | aspmx.l.google.com | 10 | Boîte mail Google |
| MX | @ | alt1.aspmx.l.google.com | 20 | |
| MX | @ | alt2.aspmx.l.google.com | 30 | |
| MX | @ | alt3.aspmx.l.google.com | 40 | |
| MX | @ | alt4.aspmx.l.google.com | 50 | |
| TXT | @ | `v=spf1 include:_spf.google.com ~all` | | SPF Google |
| TXT | @ | `google-site-verification=HSjLFcIPD6D2zTRQhPDFfOfioHMbTedL1Dxzpce_e8A` | | Vérification Google |

Pas de transfert nécessaire : déjà chez Hostpoint. Il suffit de remettre les serveurs de noms Hostpoint (à la place de ns12/ns13.wixdns.net) après avoir recréé la zone ci-dessus.

## swisssportadvisors.com

| Type | Nom | Valeur | Prio | Rôle |
|---|---|---|---|---|
| A | @ | 75.2.60.5 | | Site (Netlify `swiss-sport-advisors`) — chez Netlify DNS l'apex résolvait vers des IP AWS ; hors Netlify DNS, utiliser l'IP du load balancer |
| CNAME | www | swiss-sport-advisors.netlify.app | | Site (domaine principal = www) |
| MX | @ | aspmx.l.google.com | 10 | Boîte mail Google |
| MX | @ | alt1.aspmx.l.google.com | 20 | |
| MX | @ | alt2.aspmx.l.google.com | 30 | |
| MX | @ | alt3.aspmx.l.google.com | 40 | |
| MX | @ | alt4.aspmx.l.google.com | 50 | |
| TXT | @ | `v=spf1 include:_spf.google.com ~all` | | SPF Google |
| TXT | @ | `google-site-verification=TQYxd3zXtcwE7Z0YY1jTseFKVSVZYAgJWCkjepZfZYE` | | Vérification Google |

**Urgent** : expire le 24.10.2026 → transfert GoDaddy → Hostpoint à lancer en premier (au moins 15 jours avant l'échéance).

## nmind.ch

| Type | Nom | Valeur | Prio | Rôle |
|---|---|---|---|---|
| A | @ | 75.2.60.5 | | Site (Netlify `nmind-ch`) |
| CNAME | www | nmind-ch.netlify.app | | Site |
| MX | @ | mta-gw.infomaniak.ch | 5 | Boîte mail Infomaniak — **à décider** : garder (alors le mail reste chez Infomaniak) ou migrer vers Google |
| TXT | @ | `v=spf1 include:spf.infomaniak.ch -all` | | SPF Infomaniak (à adapter si le mail change) |
| TXT | _dmarc | `v=DMARC1; p=reject;` | | DMARC |
| CNAME | autoconfig | infomaniak.com | | Config auto des clients mail Infomaniak |

## katapultapp.net

Zone actuelle chez Cloudflare (ns desiree/reese), A proxifiés → origine inconnue, contenu = spam de paris turc. Enregistré le 10.11.2025 chez Namecheap, « client transfer prohibited ». À vérifier : le domaine est-il encore dans le compte Namecheap de Dan ? Sinon il a été récupéré par un tiers après expiration et n'est plus à lui.

## Procédure de transfert (par domaine)

1. **Ancien registrar** : déverrouiller le domaine, obtenir le code d'autorisation (EPP). Wix : ⋯ › « Transférer en dehors de Wix ». GoDaddy : Paramètres du domaine › verrou off › code. Infomaniak : Domaines › Transférer le domaine.
2. **Hostpoint** (Control Panel › Domaines › Transférer un domaine) : saisir le domaine + code, choisir « DNS Hostpoint », créer la zone d'après les tableaux ci-dessus **avant** la fin du transfert.
3. Attendre la fin du transfert (.ch : quelques heures à 5 jours ; .com : jusqu'à 5 jours, ou immédiat si l'ancien registrar accepte tout de suite). Le site et le mail ne coupent pas si la zone est prête avant.
4. Après transfert : vérifier `nslookup -type=MX`, `-type=TXT`, `-type=A` ; pour teamlausanne.ch cliquer « Verify » chez Resend ; refaire « Test → moi » dans Console › Newsletter.
5. Quand teamlausanne.ch est parti : résilier les **deux** plans Premium Wix (Team Lausanne, Lausanne Open) — les sites vivent sur Netlify.

## katapultapp.com (le vrai domaine Katapult — katapultapp.net n'est pas à Dan)

Registrar **Infomaniak** (payé jusqu'au 04.04.2028). DNS **Wix** (ns4/ns5.wixdns.net). **Site hébergé sur Wix** (A 185.230.63.x, www → cdn3.wixdns.net) → à rebâtir sur Netlify avant de quitter Wix, ou garder Wix pour ce seul site. Mail Google.

| Type | Nom | Valeur | Prio | Rôle |
|---|---|---|---|---|
| A | @ | *(Wix aujourd'hui)* → 75.2.60.5 une fois le site sur Netlify | | Site |
| CNAME | www | *(cdn3.wixdns.net aujourd'hui)* → `<site>.netlify.app` | | Site |
| MX | @ | aspmx.l.google.com / alt1…alt4 | 10…50 | Boîte mail Google |
| TXT | @ | `v=spf1 include:_spf.google.com include:amazonses.com ~all` | | SPF Google + Amazon SES |
| TXT | @ | `google-gws-recovery-domain-verification=38296711` | | Google Workspace (domaine de récupération) |
| TXT | @ | `Sendinblue-code:dccffcbf0dd7948a7788527aa9e5adea` | | Brevo/Sendinblue (à garder si encore utilisé) |
| TXT | @ | `FSwMe9rAjnmIX3c1judnBlDPcnFwa673lvyBc4uA4f8=` | | Vérification inconnue (garder) |
| TXT | @ | `1\|www.katapultapp.net` | | Résidu, à ne pas recréer |

**swisssportadvisors.com : mis de côté par Dan le 12.09.2026 (ne pas y toucher pour le moment).**

## pandafit.ch (à enregistrer chez Hostpoint — libre le 13.09.2026)

Site PandaFit = dépôt `dahn23/pandafit-site` (dossier local `Claude/pandafit-site`), Netlify `pandafit-site`. Pas de mail sur ce domaine pour l'instant.

| Type | Nom | Valeur | Rôle |
|---|---|---|---|
| A | @ | 75.2.60.5 | Site (Netlify `pandafit-site`) |
| CNAME | www | pandafit-site.netlify.app | Site |
