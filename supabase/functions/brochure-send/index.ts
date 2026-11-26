// Envoi de la brochure Sport-etudes a un visiteur du site.
//
// Fonction PUBLIQUE (verify_jwt desactive) : elle est appelee depuis le site,
// par quelqu'un qui n'a pas de compte. Elle est donc volontairement etroite —
// c'est ce qui l'empeche de servir de relais a spam :
//   * elle n'envoie qu'a l'adresse fournie, jamais a une liste ;
//   * le sujet, le texte et le lien sont fixes ici, l'appelant ne les choisit pas ;
//   * le document demande doit figurer dans DOCS, sinon la demande est refusee ;
//   * une meme adresse ne peut declencher que 3 envois par heure.
//
// v7 (18.09.2026) : info@teamlausanne.ch est hebergee chez Hostpoint (Cloud Office), plus chez Gmail.
// Le secret GMAIL_APP_PASSWORD contient desormais le mot de passe Hostpoint de la boite : il ne doit
// plus jamais etre presente a smtp.gmail.com.
//
// v14 (26.11.2026) — trois changements :
//   1. La brochure part EN PIECE JOINTE, plus seulement en lien. Une adresse
//      donnee pour recevoir un document doit recevoir le document ; un lien
//      suppose qu'on le clique, et beaucoup ne le font jamais.
//   2. Edition 2026-27 (16 pages) a la place de celle de 2026.
//   3. ⚠ La cle de DOCS est NORMALISEE avant la recherche. Le site envoyait
//      « assets/... » ; une mise au propre des chemins du site (25.11.2026) a
//      ajoute un slash initial, et « /assets/... » ne correspondait plus a
//      aucune cle : la fonction repondait « document inconnu » et PLUS AUCUNE
//      brochure n'est partie pendant deux jours, sans que rien ne le signale
//      (le visiteur voyait le lien de repli, la demande arrivait bien au
//      secretariat). Desormais le slash initial et une ancre « #page=1 » sont
//      retires avant la comparaison : le chemin cote site peut bouger sans
//      casser l'envoi.
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const SITE = "https://teamlausanne.ch";
const EXPEDITEUR = "info@teamlausanne.ch";
const NOM = "Team Lausanne Academy";
// Serveur d'envoi selon le domaine de la boite (meme regle que mail-send).
const HOSTPOINT_DOMAINS = ["teamlausanne.ch"];
const isHostpoint = (addr: string) => HOSTPOINT_DOMAINS.includes((String(addr).toLowerCase().split("@")[1] || ""));
const smtpHost = (addr: string) => (isHostpoint(addr) ? "asmtp.mail.hostpoint.ch" : "smtp.gmail.com");
const cleanPass = (addr: string, v: string) => (isHostpoint(addr) ? String(v || "").trim() : String(v || "").replace(/\s+/g, ""));

// Seuls ces documents peuvent etre demandes. Le chemin n'est jamais pris tel
// quel dans la requete : on ne ressort que ce qui est ecrit ici.
const DOCS: Record<string, { fichier: string; titre: string; piece: string }> = {
  "assets/brochures/sport-etudes-2026-27-fr.pdf": {
    fichier: "assets/brochures/sport-etudes-2026-27-fr.pdf",
    titre: "Brochure Sport-etudes 2026-27",
    piece: "Brochure Sport-etudes 2026-27 - Team Lausanne Academy.pdf",
  },
  // L'ancienne adresse reste acceptee : elle circule dans les mails deja
  // envoyes, et une redirection Netlify la mene au meme fichier.
  "assets/brochures/sport-etudes-2026-fr.pdf": {
    fichier: "assets/brochures/sport-etudes-2026-27-fr.pdf",
    titre: "Brochure Sport-etudes 2026-27",
    piece: "Brochure Sport-etudes 2026-27 - Team Lausanne Academy.pdf",
  },
};
// « /assets/x.pdf#page=1 » et « assets/x.pdf » designent le meme document.
const cleDoc = (v: unknown) => String(v || "").trim().split("#")[0].replace(/^\/+/, "");

const estEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "methode refusee" }, 405);
  try {
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim();
    const pass = cleanPass(hub, Deno.env.get("GMAIL_APP_PASSWORD") || "");
    if (!hub || !pass) return json({ error: "secrets d'envoi manquants" }, 500);

    const { email, doc } = await req.json().catch(() => ({}));
    const adresse = String(email || "").trim().toLowerCase();
    if (!estEmail(adresse) || adresse.length > 200) return json({ error: "adresse invalide" }, 400);
    const document = DOCS[cleDoc(doc)];
    if (!document) return json({ error: "document inconnu" }, 400);
    // #page=1 : les lecteurs PDF des navigateurs rouvrent un document a la
    // page ou l'on s'etait arrete. Sans l'ancre, la brochure s'ouvrait au
    // milieu, sur le calendrier, au lieu de la couverture.
    const lien = `${SITE}/${document.fichier}#page=1`;

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Garde-fou : pas plus de 3 envois par heure vers la meme adresse.
    const depuis = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supa.from("mail_messages")
      .select("id", { count: "exact", head: true })
      .eq("to_address", adresse).eq("direction", "out")
      .gte("received_at", depuis);
    if ((count || 0) >= 3) return json({ error: "trop de demandes, reessayez plus tard" }, 429);

    // La piece jointe est lue sur le site lui-meme : un seul exemplaire du
    // PDF a maintenir, celui que le site publie. Si la lecture echoue, le
    // mail part quand meme avec le lien — mieux vaut un lien que rien.
    let piece: { filename: string; content: string; encoding: string; contentType: string } | null = null;
    try {
      const r = await fetch(lien.split("#")[0]);
      if (r.ok) {
        const octets = new Uint8Array(await r.arrayBuffer());
        // base64 par tranches : btoa(String.fromCharCode(...tout)) depasse la
        // pile d'appels sur plusieurs megaoctets.
        let brut = "";
        for (let i = 0; i < octets.length; i += 0x8000) {
          brut += String.fromCharCode(...octets.subarray(i, i + 0x8000));
        }
        piece = { filename: document.piece, content: btoa(brut), encoding: "base64", contentType: "application/pdf" };
      }
    } catch (_) { /* on envoie sans piece jointe */ }

    const sujet = "Votre brochure Sport-etudes — Team Lausanne Academy";
    const jointe = piece ? "Vous la trouverez en piece jointe." : "Vous la trouverez ici :";
    const texte = [
      "Bonjour,",
      "",
      "Merci de votre interet pour notre programme Sport-etudes.",
      jointe,
      lien,
      "",
      "Elle detaille le deroule d'une semaine, les ecoles partenaires, l'encadrement",
      "et les conditions d'admission.",
      "",
      "Une question, ou l'envie d'en parler de vive voix ? Repondez simplement a ce",
      "message : nous vous recontactons.",
      "",
      "A bientot sur les courts,",
      "Team Lausanne Academy",
      "Route des Plaines-du-Loup 7, 1018 Lausanne",
    ].join("\n");
    const html = `<p>Bonjour,</p>
<p>Merci de votre int&eacute;r&ecirc;t pour notre programme <strong>Sport-&eacute;tudes</strong>.</p>
${piece ? "<p>La brochure est <strong>jointe &agrave; ce message</strong>. Vous pouvez aussi l'ouvrir en ligne&nbsp;:</p>" : ""}
<p><a href="${lien}" style="display:inline-block;background:#073eb5;color:#fff;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">${piece ? "Ouvrir la brochure en ligne" : "T&eacute;l&eacute;charger la brochure"}</a></p>
<p>Elle d&eacute;taille le d&eacute;roul&eacute; d'une semaine, les &eacute;coles partenaires, l'encadrement et les conditions d'admission.</p>
<p>Une question, ou l'envie d'en parler de vive voix&nbsp;? R&eacute;pondez simplement &agrave; ce message&nbsp;: nous vous recontactons.</p>
<p>&Agrave; bient&ocirc;t sur les courts,<br>
<strong>Team Lausanne Academy</strong><br>
Route des Plaines-du-Loup 7, 1018 Lausanne</p>`;

    const transporter = nodemailer.createTransport({
      host: smtpHost(hub), port: 465, secure: true, auth: { user: hub, pass },
    });
    const info = await transporter.sendMail({
      from: `"${NOM}" <${EXPEDITEUR}>`, to: adresse, replyTo: EXPEDITEUR,
      subject: sujet, text: texte, html,
      attachments: piece ? [piece] : undefined,
    });

    // Trace dans la messagerie, comme tout envoi sortant. Le PDF n'y est PAS
    // recopie : 5 Mo en base64 par demande, pour un fichier que le site
    // publie deja, ne servirait a rien.
    await supa.from("mail_messages").insert({
      account_address: EXPEDITEUR, direction: "out", message_id: info?.messageId || null,
      from_name: NOM, from_address: EXPEDITEUR, to_address: adresse,
      subject: sujet, snippet: document.titre + (piece ? " (en piece jointe)" : " (lien seul)"),
      body_text: texte, body_html: html,
      received_at: new Date().toISOString(), is_read: true, status: "traite", pushed: true,
    });

    return json({ ok: true, piece: !!piece });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
