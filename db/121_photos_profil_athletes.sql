-- 121 — Photo de profil des sept athlètes de la page Sport-études.
--
-- Les photos du site font 900×1200 en plan mi-corps. Les avatars du répertoire
-- sont ronds, en object-fit:cover : servies telles quelles, elles auraient
-- cadré le torse. Chaque portrait a donc été recadré en carré 512×512 autour
-- du visage (côté ≈ 1,6 fois la hauteur de tête), fichiers dans
-- site/assets/photos/profil/.
--
-- Pourquoi le site et pas le bucket gz-photos, que la console utilise
-- d'habitude : son écriture exige is_staff(auth.uid()), donc une session
-- ouverte. Et pourquoi pas du base64 dans photo_url : le répertoire charge
-- people avec select("*"), chaque image serait retéléchargée en entier à
-- chaque ouverture de la console.
--
-- storage_path reste nul sur les person_media : deleteMedia() teste ce champ
-- avant de toucher au stockage, un fichier du dépôt n'a rien à y faire.

begin;

with v(nom, prenom, fichier) as (values
  ('Picci','Talia','talia-picci'),
  ('Lorival','Célyan','celyan-lorival'),
  ('Dévaud','Nadia','nadia-devaud'),
  ('Vitone','Hektor','hektor-vitone'),          -- et pas Sören, son homonyme
  ('Stadelmann','Isabella','isabella-stadelmann'),
  ('Olgiati','Yuma','yuma-olgiati'),
  ('Allenspach','Ylan','ylan-allenspach')
)
update people p
   set photo_url = 'https://teamlausanne.ch/assets/photos/profil/'||v.fichier||'.jpg'
  from v
 where p.last_name = v.nom and p.first_name = v.prenom;

-- La photo de profil apparaît aussi dans l'onglet Photos / vidéos de la fiche,
-- comme le fait uploadPersonPhoto() quand elle est déposée à la main.
insert into person_media (person_id, url, storage_path, kind, is_profile, comment)
select p.id, p.photo_url, null, 'image', true, 'Photo de profil'
from people p
where p.photo_url like 'https://teamlausanne.ch/assets/photos/profil/%'
  and not exists (select 1 from person_media m where m.person_id = p.id and m.is_profile);

commit;

-- ---------------------------------------------------------------------------
-- Ajout : l'encadrement. Recadrés depuis les portraits de la charte
-- (Brand Guidelines/Photos/Portraits), originaux de 3392×5088 à 7927×5287.

begin;

with v(nom, prenom, fichier) as (values
  ('Rivaroli','Séline','seline-rivaroli'),
  ('Gander','Loris','loris-gander'),
  ('Palena','Mariano','mariano-palena'),
  ('Perez','Yann','yann-perez')                 -- et pas Babic ni Blomert
)
update people p
   set photo_url = 'https://teamlausanne.ch/assets/photos/profil/'||v.fichier||'.jpg'
  from v
 where p.last_name = v.nom and p.first_name = v.prenom;

insert into person_media (person_id, url, storage_path, kind, is_profile, comment)
select p.id, p.photo_url, null, 'image', true, 'Photo de profil'
from people p
where p.photo_url like 'https://teamlausanne.ch/assets/photos/profil/%'
  and not exists (select 1 from person_media m where m.person_id = p.id and m.is_profile);

commit;

-- ---------------------------------------------------------------------------
-- Ajout du 01.10.2026 : Max Marten, recadré depuis sa photo Sport-études.

begin;

update people
   set photo_url = 'https://teamlausanne.ch/assets/photos/profil/max-marten.jpg'
 where id = 'bf1ca04a-c994-4e0c-b391-10e144d3ac78';   -- Max Marten

insert into person_media (person_id, url, storage_path, kind, is_profile, comment)
select p.id, p.photo_url, null, 'image', true, 'Photo de profil'
from people p
where p.photo_url like 'https://teamlausanne.ch/assets/photos/profil/%'
  and not exists (select 1 from person_media m where m.person_id = p.id and m.is_profile);

commit;
