// payroll-cron — arrêt du mois de paie, le 3 du mois suivant.
//
// Pourquoi le 3 et non le dernier jour du mois : un cours donné le 30 se valide
// le 31, parfois le 2. Clôturer à minuit le 31 figerait des heures incomplètes
// et sous-paierait quelqu'un — l'erreur la plus coûteuse du circuit, parce que
// personne ne relit un décompte pour y chercher des heures absentes.
//
// La tâche ne force jamais. Si tout est validé et tarifé, elle clôture et le
// dit. Sinon elle ne touche à rien et envoie la liste de ce qui bloque : c'est
// exactement le moment où quelqu'un peut encore corriger.
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = (Deno.env.get("GMAIL_HUB") || "info@teamlausanne.ch").trim().toLowerCase();
const NOM = "Team Lausanne Academy";
const A = "info@teamlausanne.ch, raphael@teamlausanne.ch";

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const chf = (n: number) => Number(n || 0).toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Mois précédent, en AAAA-MM.
function moisPrecedent(d = new Date()): string {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();       // 0-11, donc m = mois précédent
  const an = m === 0 ? y - 1 : y, mo = m === 0 ? 12 : m;
  return `${an}-${String(mo).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("CRON_SECRET") || "";
    const key = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-secret") || "";
    if (!secret || key !== secret) return json({ error: "cle invalide" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const ym = url.searchParams.get("ym") || moisPrecedent();
    const essai = url.searchParams.get("essai") === "1";

    // Déjà arrêté ? On ne refait rien : une deuxième clôture écraserait un
    // instantané sur lequel la fiduciaire travaille peut-être déjà.
    const { data: deja } = await supa.from("payroll_months").select("status,closed_at,n_people,total_gross").eq("ym", ym).maybeSingle();
    if (deja && deja.status !== "ouvert") {
      return json({ ym, deja_cloture: true, status: deja.status });
    }

    const { data: bl, error: eb } = await supa.rpc("payroll_blocages", { p_ym: ym });
    if (eb) return json({ error: eb.message }, 500);
    const sansTarif = bl?.sans_tarif || [], nonValides = bl?.non_valides || [];
    const peutClore = sansTarif.length === 0 && nonValides.length === 0;

    let resultat: Record<string, unknown> | null = null;
    if (peutClore && !essai) {
      const { data, error } = await supa.rpc("payroll_close_sys", { p_ym: ym, p_force: false });
      if (error) return json({ error: error.message }, 500);
      resultat = data as Record<string, unknown>;
    }

    const pass = String(Deno.env.get("GMAIL_APP_PASSWORD") || "").trim();
    if (pass && !essai) {
      const tr = nodemailer.createTransport({
        host: "asmtp.mail.hostpoint.ch", port: 465, secure: true, auth: { user: FROM, pass },
      });
      const corps = peutClore
        ? [`Le mois de paie ${ym} a été arrêté automatiquement.`, "",
           `${resultat?.personnes} personne(s) · ${chf(Number(resultat?.brut))} CHF brut.`, "",
           "Les heures et les tarifs sont figés. Étape suivante : envoyer le décompte à la fiduciaire",
           "depuis la console, onglet Heures."].join("\n")
        : [`Le mois de paie ${ym} N'A PAS été arrêté : il reste des points à régler.`, "",
           ...(sansTarif.length
             ? [`${sansTarif.length} personne(s) ont des heures SANS TARIF HORAIRE —`,
                "leurs heures partiraient à zéro chez la fiduciaire :",
                // deno-lint-ignore no-explicit-any
                ...sansTarif.map((x: any) => `  · ${x.nom} — ${x.heures} h`), ""]
             : []),
           ...(nonValides.length
             ? [`${nonValides.length} personne(s) dont tous les cours ne sont pas validés :`,
                // deno-lint-ignore no-explicit-any
                ...nonValides.slice(0, 15).map((x: any) => `  · ${x.nom} — ${x.valides}/${x.total}`),
                nonValides.length > 15 ? `  … et ${nonValides.length - 15} autre(s)` : "", ""]
             : []),
           "Corrige dans la console (onglet Heures), puis clôture le mois à la main.",
           "La tâche ne forcera jamais une clôture : un décompte faux se paie."].join("\n");
      try {
        await tr.sendMail({
          from: `"${NOM}" <${FROM}>`, to: A,
          subject: peutClore
            ? `Paie ${ym} — mois arrêté (${resultat?.personnes} personnes, ${chf(Number(resultat?.brut))} CHF)`
            : `Paie ${ym} — à régler avant de clôturer (${sansTarif.length + nonValides.length} point(s))`,
          text: corps,
        });
      } catch (_) { /* le mail ne doit pas faire échouer la clôture */ }
    }

    return json({ ym, essai, cloture: peutClore && !essai, resultat,
                  sans_tarif: sansTarif.length, non_valides: nonValides.length });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
