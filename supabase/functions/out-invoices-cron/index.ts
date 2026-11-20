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
// Récapitulatif : le secrétariat, plus la direction. Une facture qui n'est pas
// partie doit avoir deux paires d'yeux dessus, pas une.
const RECAP_A = "info@teamlausanne.ch, raphael@teamlausanne.ch";

// ⚠⚠ QUI PART TOUT SEUL — SPORT-ÉTUDES ET PRO, ET RIEN D'AUTRE (20.11.2026)
// L'envoi du 20 est une mensualité : les familles sport-études et pro savent
// qu'elle tombe, et elle est identique d'un mois sur l'autre. Tout le reste —
// Kids Tennis, Club, Compétition, Performance, locations, stages, rappels —
// se relit avant de partir : montants ajustés, acomptes reçus au guichet,
// familles à ménager. Le secrétariat l'envoie lui-même depuis la console.
//
// Pourquoi c'est écrit en dur ici : au passage du 20.11.2026, la tâche a
// envoyé 29 factures dont SEULEMENT 11 de sport-études/pro. Elle n'avait
// jamais filtré sur la filière — personne ne s'en était aperçu parce que la
// file ne contenait jusque-là presque que des mensualités. Quatre familles ont
// reçu une facture au montant PLEIN alors qu'elles avaient déjà versé un
// acompte, et un second rappel de stage est parti tout seul.
//
// ⚠ Une facture SANS filière ne part pas non plus : dans le doute, c'est un
// humain qui décide. Le récapitulatif les nomme toutes, pour qu'« en attente »
// ne devienne pas « oubliée ».
const FILIERES_AUTO = ["sport-etudes", "pro", "pro-u18"];
const partAuto = (f: { filiere?: string | null }) =>
  FILIERES_AUTO.includes(String(f.filiere || "").trim());

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
      .select("id, number, amount, label, reference, due_date, issue_date, debtor_name, debtor_email, pdf_path, filiere")
      .eq("status", "a_envoyer")
      .lte("issue_date", aujourdhui)
      .order("number");
    if (error) return json({ error: error.message }, 500);

    const dues = factures || [];
    // Le tri, et c'est tout l'enjeu de cette tâche : ce qui part seul d'un côté,
    // ce qui attend une main humaine de l'autre.
    const aEnvoyer = dues.filter(partAuto);
    const aLaMain = dues.filter((f) => !partAuto(f));
    const envoyees: string[] = [];
    const ignorees: string[] = [];
    const manuelles = aLaMain.map((f) =>
      `${f.number} — ${f.debtor_name} — CHF ${chf(Number(f.amount))} — ${f.filiere || "sans filière"}`);

    if (essai) {
      return json({
        essai: true, date: aujourdhui, dues: dues.length, candidates: aEnvoyer.length,
        pretes: aEnvoyer.filter((f) => f.pdf_path && f.debtor_email).map((f) => f.number),
        bloquees: aEnvoyer.filter((f) => !f.pdf_path || !f.debtor_email)
          .map((f) => `${f.number} (${!f.pdf_path ? "PDF manquant" : "pas d'e-mail"})`),
        reservees_envoi_manuel: manuelles,
      });
    }

    // ⚠ POURQUOI UN ENVOI POSÉ ET PAS EN RAFALE (19.11.2026) — le 20 du mois,
    // ce sont des dizaines de factures d'un coup. Sans `pool`, nodemailer ouvre
    // une connexion NEUVE par message et les enchaîne aussi vite qu'il peut :
    // c'est le profil exact qui fait répondre « capacité atteinte » à un serveur
    // de messagerie ordinaire. Hostpoint ne publie aucun chiffre — raison de
    // plus pour ne pas le chercher. Donc : UNE connexion gardée ouverte, un
    // message par seconde, et un seul essai de rattrapage sur une erreur
    // passagère.
    // ⚠ Un transport `pool` reste ouvert : il FAUT le fermer (tr.close() plus
    // bas), sinon la fonction ne rend jamais la main.
    const tr = nodemailer.createTransport({
      host: "asmtp.mail.hostpoint.ch", port: 465, secure: true,
      auth: { user: FROM, pass },
      pool: true, maxConnections: 1, maxMessages: 100,
      rateDelta: 1000, rateLimit: 1,
    });
    // Erreur passagère (serveur occupé, quota momentané) : les codes SMTP 4xx
    // veulent dire « reviens plus tard », au contraire des 5xx qui sont des
    // refus définitifs (adresse inexistante…), qu'il ne sert à rien de rejouer.
    // deno-lint-ignore no-explicit-any
    const passagere = (e: any) => {
      const c = Number(e?.responseCode || 0);
      return (c >= 400 && c < 500) || /too many|rate|capacit|try again|busy|4\.\d\.\d/i.test(String(e?.message || ""));
    };
    // deno-lint-ignore no-explicit-any
    const envoyer = async (msg: any) => {
      try { return await tr.sendMail(msg); } catch (e) {
        if (!passagere(e)) throw e;
        await new Promise((r) => setTimeout(r, 15000));
        return await tr.sendMail(msg);
      }
    };

    for (const f of aEnvoyer) {
      if (!f.debtor_email) { ignorees.push(`${f.number} — pas d'adresse e-mail`); continue; }
      if (!f.pdf_path) { ignorees.push(`${f.number} — PDF absent (ouvrir l'onglet Factures le régénère)`); continue; }
      try {
        const { data: blob, error: e1 } = await supa.storage.from("out_invoices").download(f.pdf_path);
        if (e1 || !blob) throw new Error(e1?.message || "PDF illisible");
        const pdf = new Uint8Array(await blob.arrayBuffer());

        await envoyer({
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
    if (envoyees.length || ignorees.length || manuelles.length) {
      const corps = [
        `Envoi automatique des factures du ${frDate(aujourdhui)}.`,
        "Seules les mensualités sport-études et pro partent automatiquement.",
        "",
        `${envoyees.length} facture(s) envoyée(s) :`,
        ...envoyees.map((x) => "  · " + x),
        ...(ignorees.length ? ["", `${ignorees.length} en ÉCHEC — à traiter à la main :`, ...ignorees.map((x) => "  · " + x)] : []),
        // Les autres filières ne sont pas « oubliées » : elles attendent une
        // relecture. Les nommer ici est la seule chose qui empêche « en
        // attente » de devenir « jamais facturé ».
        ...(manuelles.length ? ["", `${manuelles.length} facture(s) échue(s) RÉSERVÉE(S) À UN ENVOI MANUEL`,
          "(Finances › Factures, bouton Envoyer) :", ...manuelles.map((x) => "  · " + x)] : []),
      ].join("\n");
      try {
        await tr.sendMail({
          from: `"${NOM_EXPEDITEUR}" <${FROM}>`, to: RECAP_A,
          subject: `Factures — envoi automatique du ${frDate(aujourdhui)} (${envoyees.length} envoyée(s)${ignorees.length ? `, ${ignorees.length} en échec` : ""}${manuelles.length ? `, ${manuelles.length} à envoyer à la main` : ""})`,
          text: corps,
        });
      } catch (_) { /* le récapitulatif ne doit pas faire échouer la tâche */ }
    }
    // Transport `pool` : sans ce close, les connexions gardées ouvertes
    // retiennent la fonction jusqu'à ce que la plateforme la coupe.
    try { tr.close(); } catch (_) { /* rien à sauver ici */ }

    // Trace du passage, lue par le tableau de bord de la console. Écrite même
    // quand rien n'est parti : « la tâche a tourné, il n'y avait rien à
    // envoyer » et « la tâche n'a pas tourné » ne se ressemblent pas du tout,
    // et un mail de récapitulatif peut se perdre ou finir en indésirable.
    try {
      await supa.from("out_invoice_runs").insert({
        kind: "auto", sent_count: envoyees.length, failed_count: ignorees.length,
        detail: { date: aujourdhui, envoyees, ignorees, manuelles },
      });
    } catch (_) { /* le journal ne doit pas faire échouer l'envoi */ }

    return json({ date: aujourdhui, envoyees: envoyees.length, ignorees: ignorees.length, manuelles: manuelles.length, detail: { envoyees, ignorees, manuelles } });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
