# Kit réseaux sociaux Team Lausanne

Stories, visuels et habillage vidéo au style de la charte 2026 (Drive › Team Lausanne › Brand Guidelines),
fabriqués sur le PC avec Chrome (images) et ffmpeg (vidéo). Utilisé par Claude pour traiter les sessions
de l'onglet **Réseaux sociaux › Rushes** de la console.

## Charte appliquée
- **Couleurs** : noir `#141414`, bleu prusse `#003652`, bleu absolu `#073EB5`, océan `#137297`,
  vert `#B2FD13`, gris clair `#D9D9D9`, blanc `#E2EBF7`. Équilibre 60 % neutres, 30 % bleus, 10 % vert
  (le vert = appels à l'action et mots mis en avant, jamais de longs textes).
- **Polices** : la charte prévoit Acumin Pro + Circe (Adobe) ; sans abonnement Adobe, on applique sa police
  de remplacement officielle **Noto Sans** (`fonts/`, licence OFL `OFL-fonts.txt`). Grands titres :
  Noto Sans Display ExtraCondensed Black ; texte : Noto Sans ; sous-titres vidéo : Noto Sans Black.
- **Logo** : `assets/logo-academy.png` (blanc, recoloré par CSS). Combinaisons autorisées : bleu sur blanc,
  noir sur vert, blanc sur bleu, vert sur noir. Jamais d'opacité, d'ombre ni de dégradé sur le logo.

## Modèles (`templates/`)
| Modèle | Format | Usage |
|---|---|---|
| `story-annonce` | 1080×1920 | tournoi, stage, événement (photo, titre, date, infos, bouton) |
| `story-vainqueurs` | 1080×1920 | vainqueurs GameZone (1 à 8, photos + tableau) |
| `story-citation` | 1080×1920 | citation d'un coach, d'un jeune, d'un parent |
| `story-programme` | 1080×1920 | programme de la semaine (jusqu'à 6 lignes) |
| `video-nom` | taille de la vidéo, **transparent** | bandeau « nom + rôle » posé sur une vidéo |
| `video-fin` | taille de la vidéo | carton de fin (logo, site, appel à l'action) |

Les données sont en JSON (exemples dans `exemples/`). Un mot entre astérisques passe en vert : `"Tournoi\n*d'automne*"`.

```bash
deno run -A render.ts story-annonce exemples/annonce.json sortie/annonce.png
deno run -A render.ts video-nom exemples/video-nom.json sortie/nom.png 1080 1920 --transparent
```

## Sous-titres animés
```bash
W=/c/Users/danha/tools/whisper
ffmpeg -i extrait.mp4 -ar 16000 -ac 1 audio.wav
$W/Release/whisper-cli.exe -m $W/ggml-large-v3-turbo-q5_0.bin -l fr -f audio.wav -ml 1 -sow -oj -of mots --prompt "Team Lausanne, GameZone, Plaines-du-Loup"
deno run -A soustitres.ts mots.json sous-titres.ass 9x16          # ou 4x5, 16x9, 1x1 ; [debut fin] pour un extrait
ffmpeg -i extrait.mp4 -vf "subtitles=sous-titres.ass:fontsdir=fonts" …
```
2 à 4 mots à l'écran, le mot prononcé en vert. Les noms propres que Whisper écorche se corrigent dans
`CORR` (soustitres.ts).

## Vidéo complète (exemple : `sortie/demo-reel.mp4`)
Fond (extrait recadré ou photo animée) + bandeau `video-nom` en fondu + sous-titres + carton `video-fin`.
Pour une photo animée, utiliser `zoompan` avec `d=<nb d'images>` sur une seule image (pas `-loop 1`,
qui fait planter ffmpeg sur les JPEG du site).

## Formats par réseau
- Reels / TikTok / YouTube Shorts : 1080×1920 (9:16), texte utile hors des 250 px du haut et des 400 px du bas.
- Post Instagram : 1080×1350 (4:5) ou carré 1080×1080.
- LinkedIn : 1920×1080 (16:9) ou 1080×1350.

`sortie/` n'est pas versionné (fichiers produits).
