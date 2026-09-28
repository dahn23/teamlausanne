-- Jours fériés vaudois jusqu'en 2031 (28.09.2026)
--
-- Les congés se décomptent en jours ouvrables, fériés déduits : sans ces
-- dates, quelqu'un qui pose la semaine de Pâques 2029 paierait le Vendredi
-- saint de sa poche. La table s'arrêtait à 2027.
--
-- CALCULÉS, pas recopiés. Quatre des neuf fériés dépendent de Pâques, qui se
-- déplace chaque année, et le Jeûne fédéral est le lundi suivant le troisième
-- dimanche de septembre. Une liste saisie à la main sur cinq ans, c'est vingt
-- dates dont une se trompe. La fonction a été contrôlée contre les deux années
-- déjà saisies : les six dates mobiles de 2026 et 2027 tombent exactement.
--
-- Périmètre : les fériés OFFICIELS du canton de Vaud. Le 1er mai et le 26
-- décembre n'y figurent pas — ils ne sont pas fériés à Vaud, contrairement à
-- d'autres cantons.

-- Pâques par l'algorithme grégorien (Meeus/Jones/Butcher).
create or replace function public.paques(p_an int)
returns date language plpgsql immutable as $fn$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mo int; jo int;
begin
  a := p_an % 19; b := p_an / 100; c := p_an % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19*a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
  l := (32 + 2*e + 2*i - h - k) % 7; m := (a + 11*h + 22*l) / 451;
  mo := (h + l - 7*m + 114) / 31; jo := ((h + l - 7*m + 114) % 31) + 1;
  return make_date(p_an, mo, jo);
end $fn$;

-- Les neuf fériés vaudois d'une année. Pour en ajouter d'autres plus tard,
-- il suffit d'appeler cette fonction sur l'année voulue.
create or replace function public.feries_vd(p_an int)
returns table (day date, label text) language sql immutable as $fn$
  select * from (values
    (make_date(p_an,1,1),        'Nouvel An'),
    (make_date(p_an,1,2),        '2 janvier'),
    (paques(p_an) - 2,           'Vendredi saint'),
    (paques(p_an) + 1,           'Lundi de Pâques'),
    (paques(p_an) + 39,          'Ascension'),
    (paques(p_an) + 50,          'Lundi de Pentecôte'),
    (make_date(p_an,8,1),        'Fête nationale'),
    -- Jeûne fédéral : le lundi qui suit le 3e dimanche de septembre.
    ((select d::date + 1 from generate_series(make_date(p_an,9,1), make_date(p_an,9,30), interval '1 day') d
       where extract(isodow from d) = 7 offset 2 limit 1), 'Lundi du Jeûne fédéral'),
    (make_date(p_an,12,25),      'Noël')
  ) as t(day, label);
$fn$;

insert into public.public_holidays (canton, day, label)
select 'VD', f.day, f.label
from generate_series(2026, 2031) an, lateral public.feries_vd(an) f
on conflict (canton, day) do nothing;

revoke all on function public.paques(int)    from public, anon;
revoke all on function public.feries_vd(int) from public, anon;
grant execute on function public.paques(int)    to authenticated;
grant execute on function public.feries_vd(int) to authenticated;
