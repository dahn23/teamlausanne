use strict; use warnings; use Compress::Zlib;
# PDF vectoriel -> SVG. Taille pour ces logos : tracés seuls, sans image ni
# police embarquée. Tout est rempli en noir, ce qui evite d'interpreter les
# espaces colorimetriques (rg, k, g, sc...). Le viewBox est recadre sur le
# contenu reellement dessine, les MediaBox ayant de larges marges.

my ($fichier, $sortie) = @ARGV;
die "usage: pdf2svg.pl entree.pdf sortie.svg\n" unless $fichier && $sortie;

local $/;
open my $in, '<:raw', $fichier or die "$fichier: $!";
my $pdf = <$in>; close $in;

my ($mw, $mh) = $pdf =~ m{/MediaBox\s*\[\s*[\d.+-]+\s+[\d.+-]+\s+([\d.+-]+)\s+([\d.+-]+)}
  or die "MediaBox introuvable";

my $flux = '';
while ($pdf =~ /(\d+)\s+0\s+obj(.*?)stream\r?\n/sg) {
  my $dict = $2; my $deb = pos($pdf);
  my $fin = index($pdf, "endstream", $deb);
  next if $fin < 0;
  my $brut = substr($pdf, $deb, $fin - $deb); $brut =~ s/\r?\n$//;
  next if $dict =~ /XML|Metadata/;
  my $d = $dict =~ /FlateDecode/ ? uncompress($brut) : $brut;
  next unless defined $d && length $d;
  # Un flux de contenu est du texte. On ecarte tout blob majoritairement
  # binaire : sinon des octets compresses se font passer pour des operateurs,
  # ce qui pollue l'analyse et fait perdre des chemins.
  my $imprimables = ($d =~ tr/\x20-\x7E\r\n\t//);
  next unless $imprimables / length($d) > 0.95;
  next unless $d =~ /(^|\s)(m|l|c|re)\s/;
  $flux .= $d . "\n";
}
die "aucun flux de contenu\n" unless length $flux;

my @ctm = ([1,0,0,1,0,0]);
sub appliquer {
  my ($x, $y) = @_; my $m = $ctm[-1];
  return ($m->[0]*$x + $m->[2]*$y + $m->[4], $m->[1]*$x + $m->[3]*$y + $m->[5]);
}
sub multiplier {
  my @n = @_; my $m = $ctm[-1];
  return [ $n[0]*$m->[0] + $n[1]*$m->[2], $n[0]*$m->[1] + $n[1]*$m->[3],
           $n[2]*$m->[0] + $n[3]*$m->[2], $n[2]*$m->[1] + $n[3]*$m->[3],
           $n[4]*$m->[0] + $n[5]*$m->[2] + $m->[4],
           $n[4]*$m->[1] + $n[5]*$m->[3] + $m->[5] ];
}
my $r = sub { my $v = sprintf('%.2f', $_[0]); $v =~ s/\.?0+$//; $v eq '-0' ? '0' : $v };

my (@bbox, @cur);          # boite globale ; boite du chemin en cours
sub pt {
  my ($x, $y) = appliquer(@_);
  my $sy = $mh - $y;                       # SVG a l'axe Y inverse
  $cur[0] = $x  if !defined $cur[0] || $x  < $cur[0];
  $cur[1] = $sy if !defined $cur[1] || $sy < $cur[1];
  $cur[2] = $x  if !defined $cur[2] || $x  > $cur[2];
  $cur[3] = $sy if !defined $cur[3] || $sy > $cur[3];
  return ($r->($x), $r->($sy));
}
# La boite du chemin n'entre dans la globale que si le chemin est retenu.
# Sinon le rectangle de decoupe initial, qui couvre toute la page, la gonflerait.
sub garder {
  return unless defined $cur[0];
  $bbox[0] = $cur[0] if !defined $bbox[0] || $cur[0] < $bbox[0];
  $bbox[1] = $cur[1] if !defined $bbox[1] || $cur[1] < $bbox[1];
  $bbox[2] = $cur[2] if !defined $bbox[2] || $cur[2] > $bbox[2];
  $bbox[3] = $cur[3] if !defined $bbox[3] || $cur[3] > $bbox[3];
  @cur = ();
}

my (@chemins, @d);
my ($cx, $cy) = (0, 0);
my @jetons = $flux =~ /(\S+)/g;
my $nombre = qr/^[-+]?(?:\d+\.?\d*|\.\d+)$/;

for (my $i = 0; $i < @jetons; $i++) {
  my $t = $jetons[$i];
  next unless $t =~ /^[A-Za-z][A-Za-z*]*$/;
  # Operandes = les jetons numeriques qui precedent immediatement.
  my @a; my $j = $i - 1;
  while ($j >= 0 && $jetons[$j] =~ $nombre) { unshift @a, $jetons[$j] + 0; $j--; last if @a >= 6 }
  my $n = sub { my $k = shift; return @a >= $k ? @a[ -$k .. -1 ] : () };

  if    ($t eq 'q')  { push @ctm, [ @{$ctm[-1]} ] }
  elsif ($t eq 'Q')  { pop @ctm if @ctm > 1 }
  elsif ($t eq 'cm') { my @v = $n->(6); $ctm[-1] = multiplier(@v) if @v == 6 }
  elsif ($t eq 'm')  { my @v = $n->(2); next unless @v == 2;
                       ($cx,$cy) = @v; push @d, 'M'.join(' ', pt($cx,$cy)) }
  elsif ($t eq 'l')  { my @v = $n->(2); next unless @v == 2;
                       ($cx,$cy) = @v; push @d, 'L'.join(' ', pt($cx,$cy)) }
  elsif ($t eq 'c')  { my @v = $n->(6); next unless @v == 6;
                       push @d, 'C'.join(' ', pt($v[0],$v[1]), pt($v[2],$v[3]), pt($v[4],$v[5]));
                       ($cx,$cy) = ($v[4],$v[5]) }
  elsif ($t eq 'v')  { my @v = $n->(4); next unless @v == 4;   # 1er controle = point courant
                       push @d, 'C'.join(' ', pt($cx,$cy), pt($v[0],$v[1]), pt($v[2],$v[3]));
                       ($cx,$cy) = ($v[2],$v[3]) }
  elsif ($t eq 'y')  { my @v = $n->(4); next unless @v == 4;   # 2e controle = arrivee
                       push @d, 'C'.join(' ', pt($v[0],$v[1]), pt($v[2],$v[3]), pt($v[2],$v[3]));
                       ($cx,$cy) = ($v[2],$v[3]) }
  elsif ($t eq 're') { my @v = $n->(4); next unless @v == 4;
                       my ($x,$y,$rw,$rh) = @v;
                       push @d, 'M'.join(' ', pt($x,$y)), 'L'.join(' ', pt($x+$rw,$y)),
                                'L'.join(' ', pt($x+$rw,$y+$rh)), 'L'.join(' ', pt($x,$y+$rh)), 'Z';
                       ($cx,$cy) = ($x,$y) }
  elsif ($t eq 'h')  { push @d, 'Z' }
  elsif ($t =~ /^(f|F|f\*|b|b\*|B|B\*)$/) {
    if (@d) {
      my $regle = ($t =~ /\*/) ? ' fill-rule="evenodd"' : '';
      push @chemins, '<path d="' . join('', @d) . '"' . $regle . '/>';
      garder();
      @d = ();
    }
  }
  elsif ($t =~ /^(n|S|s)$/) { @d = (); @cur = () }   # chemin abandonne : sa boite aussi
}

# Le rectangle de clip initial couvre toute la page et fausserait le recadrage :
# on repart de la boite des chemins reellement conserves.
my ($minx, $miny, $maxx, $maxy) = @bbox;
die "aucun chemin\n" unless defined $minx && @chemins;
my $marge = 2;
my ($w, $h) = ($maxx - $minx + 2*$marge, $maxy - $miny + 2*$marge);
my $dx = $marge - $minx; my $dy = $marge - $miny;

my $svg = qq{<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 }
  . $r->($w) . ' ' . $r->($h) . qq{" fill="currentColor" role="img">\n}
  . qq{<g transform="translate(} . $r->($dx) . ' ' . $r->($dy) . qq{)">}
  . join('', @chemins) . qq{</g>\n</svg>\n};

open my $out, '>:raw', $sortie or die "$sortie: $!";
print $out $svg; close $out;
printf "%s : %d chemins, %.1f Ko, viewBox %s x %s\n",
  $sortie, scalar(@chemins), length($svg)/1024, $r->($w), $r->($h);
