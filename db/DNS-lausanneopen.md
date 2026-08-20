# lausanneopen.ch — configuration DNS

## Pour revenir sur Wix (rollback)

Si le nouveau site pose problème, il suffit de remettre ces valeurs sur la
page DNS de Wix. Le site Wix n'est pas supprimé, il redevient visible en
quelques minutes.

| Type  | Hôte              | Valeur                                  |
|-------|-------------------|-----------------------------------------|
| A     | lausanneopen.ch   | 185.230.63.107                          |
| A     | lausanneopen.ch   | 185.230.63.171                          |
| A     | lausanneopen.ch   | 185.230.63.186                          |
| CNAME | www               | cdn3.wixdns.net                         |

## Configuration Netlify (état visé)

| Type  | Hôte              | Valeur                                  |
|-------|-------------------|-----------------------------------------|
| A     | lausanneopen.ch   | 75.2.60.5   (apex-loadbalancer Netlify) |
| CNAME | www               | lausanne-open-welcome.netlify.app       |
| CNAME | players           | lausanne-open-2026.netlify.app          |
| CNAME | welcome           | lausanne-open-welcome.netlify.app       |

## À NE JAMAIS TOUCHER

Les mails `info@lausanneopen.ch` sont chez Google Workspace. Ces
enregistrements doivent rester tels quels — les modifier coupe la
messagerie du tournoi :

- MX : aspmx.l.google.com (10), alt1 (20), alt2 (30), alt3 (40), alt4 (50)
- TXT : `v=spf1 include:_spf.google.com ~all`
- TXT : `google-site-verification=HSjLFcIPD6D2zTRQhPDFfOfioHMbTedL1Dxzpce_e8A`
- TXT : `subdomain-owner-verification` (vérification Netlify)

Les serveurs de noms restent chez Wix (ns12/ns13.wixdns.net) : c'est
justement ce qui protège les MX. Ne pas les transférer chez Netlify.
