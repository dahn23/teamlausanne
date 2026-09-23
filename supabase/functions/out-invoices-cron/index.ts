// out-invoices-cron — envoi automatique des factures, le 20 de chaque mois.
//
// Appelée par pg_cron (voir db/83_cron_factures_le_20.sql). Elle envoie les
// factures « à envoyer » dont la date d'émission est arrivée, puis les marque
// « envoyée ». Un récapitulatif part au secrétariat : une facture non partie
// doit se voir, sinon une famille n'est pas facturée et personne ne s'en rend
// compte avant la relance.
//
// Pourquoi un envoi SMTP direct plutôt qu'un appel à mail-send : mail-send
// exige un utilisateur connecté (il lit le jeton pour vérifier les rôles). Un
// cron n'a pas d'utilisateur. On refait donc ici le même envoi, depuis la même
// boîte et avec les mêmes identifiants.
//
// Le PDF n'est PAS fabriqué ici : la QR-facture est dessinée dans le navigateur
// (jsPDF), il n'existe pas d'équivalent côté serveur. Une facture sans PDF est
// donc sautée et signalée — la console régénère les PDF manquants à chaque
// ouverture de l'onglet Factures, ce qui suffit à les préparer d'avance.
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

// La boîte d'envoi et son mot de passe viennent des mêmes secrets que les
// autres tâches (GMAIL_HUB / GMAIL_APP_PASSWORD) : une seule vérité, et rien de
// nouveau à configurer.
const FROM = (Deno.env.get("GMAIL_HUB") || "info@teamlausanne.ch").trim().toLowerCase();
const NOM_EXPEDITEUR = "Team Lausanne Academy";
const RECAP_A = "info@teamlausanne.ch";   // récapitulatif au secrétariat

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

const chf = (n: number) =>
  n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const frDate = (d: string) => (d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : "");
// Référence SCOR affichée par groupes de quatre, comme sur le bulletin.
const ref4 = (s: string) => String(s || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

// deno-lint-ignore no-explicit-any
const remplir = (tpl: string, f: any) =>
  tpl.replace(/\{destinataire\}/g, f.debtor_name || "")
     .replace(/\{numero\}/g, f.number || "")
     .replace(/\{montant\}/g, chf(Number(f.amount)))
     .replace(/\{echeance\}/g, f.due_date ? frDate(f.due_date) : "réception")
     .replace(/\{libelle\}/g, f.label || "")
     .replace(/\{reference\}/g, ref4(f.reference));

const OBJET = "Facture {numero} — {libelle}";
const CORPS = `Bonjour {destinataire},

Vous trouverez ci-joint la facture n° {numero} ({libelle}) d'un montant de CHF {montant}, payable jusqu'au {echeance} au moyen de la QR-facture jointe (référence {reference}).

Merci d'avance et meilleures salutations,
Team Lausanne Tennis`;

Deno.serve(async (req) => {
  try {
    // Même garde que les autres tâches planifiées : un secret dans l'URL.
    const secret = Deno.env.get("CRON_SECRET") || "";
    const key = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-secret") || "";
    if (!secret || key !== secret) return json({ error: "cle invalide" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const pass = String(Deno.env.get("GMAIL_APP_PASSWORD") || "").trim();
    if (!pass) return json({ error: "secret GMAIL_APP_PASSWORD manquant" }, 400);

    // « Essai » : on regarde ce qui partirait, sans rien envoyer ni modifier.
    const essai = new URL(req.url).searchParams.get("essai") === "1";
    const aujourdhui = new Date().toISOString().slice(0, 10);

    const { data: factures, error } = await supa
      .from("out_invoices")
      .select("id, number, amount, label, reference, due_date, issue_date, debtor_name, debtor_email, pdf_path")
      .eq("status", "a_envoyer")
      .lte("issue_date", aujourdhui)
      .order("number");
    if (error) return json({ error: error.message }, 500);

    const aEnvoyer = factures || [];
    const envoyees: string[] = [];
    const ignorees: string[] = [];

    if (essai) {
      return json({
        essai: true, date: aujourdhui, candidates: aEnvoyer.length,
        pretes: aEnvoyer.filter((f) => f.pdf_path && f.debtor_email).map((f) => f.number),
        bloquees: aEnvoyer.filter((f) => !f.pdf_path || !f.debtor_email)
          .map((f) => `${f.number} (${!f.pdf_path ? "PDF manquant" : "pas d'e-mail"})`),
      });
    }

    const tr = nodemailer.createTransport({
      host: "asmtp.mail.hostpoint.ch", port: 465, secure: true,
      auth: { user: FROM, pass },
    });

    for (const f of aEnvoyer) {
      if (!f.debtor_email) { ignorees.push(`${f.number} — pas d'adresse e-mail`); continue; }
      if (!f.pdf_path) { ignorees.push(`${f.number} — PDF absent (ouvrir l'onglet Factures le régénère)`); continue; }
      try {
        const { data: blob, error: e1 } = await supa.storage.from("out_invoices").download(f.pdf_path);
        if (e1 || !blob) throw new Error(e1?.message || "PDF illisible");
        const pdf = new Uint8Array(await blob.arrayBuffer());

        await tr.sendMail({
          from: `"${NOM_EXPEDITEUR}" <${FROM}>`,
          to: f.debtor_email,
          subject: remplir(OBJET, f),
          text: remplir(CORPS, f),
          attachments: [{ filename: `facture-${f.number}.pdf`, content: pdf, contentType: "application/pdf" }],
        });

        // Marquée envoyée seulement après un envoi réussi : en cas d'échec,
        // elle reste dans la liste et repartira au prochain passage.
        await supa.from("out_invoices")
          .update({ status: "envoyee", sent_at: new Date().toISOString() })
          .eq("id", f.id);
        envoyees.push(`${f.number} — ${f.debtor_name} — CHF ${chf(Number(f.amount))}`);
      } catch (e) {
        ignorees.push(`${f.number} — ${(e as Error)?.message || e}`);
      }
    }

    // Récapitulatif au secrétariat. Envoyé même quand tout s'est bien passé :
    // savoir que la tâche a tourné vaut autant que savoir qu'elle a échoué.
    if (envoyees.length || ignorees.length) {
      const corps = [
        `Envoi automatique des factures du ${frDate(aujourdhui)}.`,
        "",
        `${envoyees.length} facture(s) envoyée(s) :`,
        ...envoyees.map((x) => "  · " + x),
        ...(ignorees.length ? ["", `${ignorees.length} NON envoyée(s) — à traiter à la main :`, ...ignorees.map((x) => "  · " + x)] : []),
      ].join("\n");
      try {
        await tr.sendMail({
          from: `"${NOM_EXPEDITEUR}" <${FROM}>`, to: RECAP_A,
          subject: `Factures — envoi automatique du ${frDate(aujourdhui)} (${envoyees.length} envoyée(s)${ignorees.length ? `, ${ignorees.length} en échec` : ""})`,
          text: corps,
        });
      } catch (_) { /* le récapitulatif ne doit pas faire échouer la tâche */ }
    }

    return json({ date: aujourdhui, envoyees: envoyees.length, ignorees: ignorees.length, detail: { envoyees, ignorees } });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
