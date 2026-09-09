# DNS — teamlausanne.ch et lausanneopen.ch

Relevé public du **09.09.2026** (serveurs de noms Wix : ns12/ns13.wixdns.net).
Sert de liste de contrôle pour recréer les zones chez **Infomaniak** lors du transfert (Wix → Infomaniak).
Messagerie = **Google Workspace** (pas facturée par Wix). Sites = Netlify. Newsletter = Resend.

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
| MX | send | feedback-smtp.eu-west-1.amazonses.com | 10 | Retours Resend — **impossible chez Wix**, à poser chez Infomaniak |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:info@teamlausanne.ch` | | DMARC (remplace le CNAME Wix `_dmarc.wixemails.com`) |

À **ne pas** recréer (propres à Wix Ascend, obsolètes une fois parti) : CNAME `s1._domainkey`, `s2._domainkey`, `sel1._domainkey` → `*.s014.ascendbywix.com`.

Optionnel plus tard : DKIM Google Workspace (Admin Google › Gmail › Authentifier les e-mails) → TXT `google._domainkey`. Pas en place aujourd'hui.

## lausanneopen.ch

| Type | Nom | Valeur | Prio | Rôle |
|---|---|---|---|---|
| A | @ | 75.2.60.5 | | Redirection vers teamlausanne.ch/#tournoi (Netlify `lausanne-open-site`) |
| CNAME | www | lausanne-open-site.netlify.app | | idem |
| MX | @ | aspmx.l.google.com | 10 | Boîte mail Google |
| MX | @ | alt1.aspmx.l.google.com | 20 | |
| MX | @ | alt2.aspmx.l.google.com | 30 | |
| MX | @ | alt3.aspmx.l.google.com | 40 | |
| MX | @ | alt4.aspmx.l.google.com | 50 | |
| TXT | @ | `v=spf1 include:_spf.google.com ~all` | | SPF Google |
| TXT | @ | `google-site-verification=HSjLFcIPD6D2zTRQhPDFfOfioHMbTedL1Dxzpce_e8A` | | Vérification Google |

## Procédure de transfert (par domaine)

1. **Infomaniak** (manager.infomaniak.com › Domaines › Transférer) : saisir le domaine, choisir « importer la zone DNS actuelle », vérifier chaque ligne contre le tableau ci-dessus, ajouter ce qui manque (MX `send`, `_dmarc`), payer.
2. **Wix** (Domaines › le domaine › ⋯ › Transférer hors de Wix) : déverrouiller, récupérer le code d'autorisation (EPP), le saisir chez Infomaniak.
3. Attendre la fin du transfert (quelques heures à 5 jours pour un .ch). Le site et le mail ne coupent pas si la zone est prête avant.
4. Après transfert : vérifier `nslookup -type=MX`, `-type=TXT`, `-type=A` ; cliquer « Verify » chez Resend ; refaire « Test → moi » dans Console › Newsletter.
