// notes-frais-lire — lit un justificatif PDF et en propose les champs.
//
// CE QU'ELLE FAIT, et surtout ce qu'elle ne fait pas : elle PROPOSE. Elle
// n'écrit aucune dépense, ne valide rien, ne touche pas à la base. Elle rend
// quatre champs que l'employé relit avant d'enregistrer. C'est volontaire :
// un montant mal lu qui s'enregistrerait tout seul finirait en remboursement
// faux, et personne ne s'en apercevrait.
//
// TROIS GARDES.
//
//  1. Le PDF appartient-il à celui qui demande ? Le chemin commence par
//     l'identifiant de la personne ; on le compare au compte connecté. Sans
//     ça, n'importe quel employé pourrait faire lire le justificatif d'un
//     autre — c'est-à-dire ses restaurants et ses déplacements.
//  2. Les catégories viennent de la BASE, pas d'une liste écrite ici. Le
//     modèle doit choisir un code existant, sinon Arsalan retrouve des
//     dépenses rangées sous un compte inventé.
//  3. Ce qui n'est pas lisible reste VIDE. Un champ deviné est pire qu'un
//     champ absent : l'un se remarque, l'autre se recopie.

import Anthropic from "npm:@anthropic-ai/sdk@0.126.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, *",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const MODELE = Deno.env.get("NF_MODELE") || "claude-sonnet-5-5";

const CONSIGNES = `Tu lis un justificatif de dépense (ticket de caisse, facture, reçu) pour une note de frais, et tu en extrais quatre renseignements.

LE MONTANT est celui RÉELLEMENT PAYÉ : le total TTC, celui du bas du ticket. Pas un sous-total, pas la TVA, pas un prix unitaire, pas un montant d'une ligne. Si le ticket montre un total et un « montant donné » avec de la monnaie rendue, c'est le TOTAL qui compte.

LA DATE est celle de l'achat, au format AAAA-MM-JJ. Attention aux dates écrites JJ.MM.AAAA : en Suisse 03.04.2026 est le 3 avril, pas le 4 mars.

LE N° DE TRANSACTION est celui imprimé sur le justificatif : n° de ticket, n° de reçu, n° de facture, référence de transaction. S'il y en a plusieurs, prends celui qui identifie l'achat.

LA CATÉGORIE doit être l'un des codes fournis, et un seul. Choisis d'après ce qui a été acheté, pas d'après le nom du commerce.

RÈGLE ABSOLUE : ce que tu ne lis pas clairement reste vide (null). Ne devine jamais, ne complète jamais par vraisemblance. Un champ vide se remarque et se corrige ; un champ inventé se recopie sans que personne ne le voie.

Rends la confiance « haute » si tout était net, « moyenne » si tu as hésité, « basse » si le document est difficile à lire.`;

const OUTIL = {
  name: "depense_lue",
  description: "Les renseignements tirés du justificatif.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: ["string", "null"], description: "Date de l'achat, AAAA-MM-JJ" },
      montant: { type: ["number", "null"], description: "Total payé" },
      transaction: { type: ["string", "null"], description: "N° de ticket / reçu / facture" },
      categorie: { type: ["string", "null"], description: "Un des codes de catégorie fournis" },
      note: { type: ["string", "null"], description: "Le commerce et ce qui a été acheté, en quelques mots" },
      confiance: { type: "string", enum: ["haute", "moyenne", "basse"] },
    },
    required: ["confiance"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Route inconnue." }, 404);

  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "clé absente" }, 503);
    const b = await req.json().catch(() => ({}));
    const jwt = String(b?.jwt || "");
    const path = String(b?.path || "");
    if (!jwt || !path) return json({ error: "requête incomplète" }, 400);

    // --- Qui demande, et a-t-il le droit de lire CE fichier ? ---------------
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: jwt } } });
    const { data: u } = await anon.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "non connecté" }, 403);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: peut } = await supa.rpc("can_notes_frais", { uid });
    if (!peut) return json({ error: "réservé à l'équipe" }, 403);

    const { data: tout } = await supa.rpc("can_notes_frais_all", { uid });
    const { data: prof } = await supa.from("profiles").select("person_id").eq("user_id", uid).maybeSingle();
    const moi = prof?.person_id || null;
    // Le dossier du fichier EST son propriétaire : « <person_id>/<nom>.pdf ».
    const proprio = path.split("/")[0];
    if (!tout && proprio !== moi) return json({ error: "ce justificatif n'est pas le vôtre" }, 403);

    // --- Le PDF ------------------------------------------------------------
    const dl = await supa.storage.from("notes-de-frais").download(path);
    if (dl.error || !dl.data) return json({ error: "justificatif introuvable" }, 404);
    const octets = new Uint8Array(await dl.data.arrayBuffer());
    if (octets.length > 10 * 1024 * 1024) return json({ error: "PDF trop lourd" }, 413);
    // Encodage en base64 par tranches : un spread sur un tableau de plusieurs
    // mégaoctets dépasse la pile d'appels.
    let brut = "";
    for (let i = 0; i < octets.length; i += 0x8000) {
      brut += String.fromCharCode(...octets.subarray(i, i + 0x8000));
    }
    const b64 = btoa(brut);

    // --- Les catégories, telles qu'elles sont en base ----------------------
    const { data: cats } = await supa.from("expense_categories")
      .select("code,label").eq("active", true).order("sort");
    const liste = (cats || []).map((c: Record<string, unknown>) => `- ${c.code} : ${c.label}`).join("\n");

    const client = new Anthropic();
    const r = await client.messages.create({
      model: MODELE,
      max_tokens: 800,
      system: CONSIGNES + "\n\nCATÉGORIES POSSIBLES (rends le code, pas le libellé) :\n" + liste,
      tools: [OUTIL],
      tool_choice: { type: "tool", name: "depense_lue" },
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          { type: "text", text: "Lis ce justificatif et rends les champs." },
        ],
      }],
    } as never);

    const appel = (r.content || []).find((c: { type: string }) => c.type === "tool_use") as
      { input: Record<string, unknown> } | undefined;
    if (!appel) return json({ error: "rien n'a pu être lu" }, 422);
    const lu = appel.input || {};

    // --- On ne rend que ce qui tient debout --------------------------------
    const codes = new Set((cats || []).map((c: Record<string, unknown>) => String(c.code)));
    const date = typeof lu.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lu.date) ? lu.date : null;
    const montant = typeof lu.montant === "number" && lu.montant > 0
      ? Math.round(lu.montant * 100) / 100 : null;
    const categorie = typeof lu.categorie === "string" && codes.has(lu.categorie) ? lu.categorie : null;

    return json({
      ok: true,
      champs: {
        date,
        montant,
        transaction: typeof lu.transaction === "string" ? lu.transaction.slice(0, 60) : null,
        categorie,
        note: typeof lu.note === "string" ? lu.note.slice(0, 120) : null,
        confiance: typeof lu.confiance === "string" ? lu.confiance : "basse",
      },
    });
  } catch (e) {
    console.error("notes-frais-lire:", e);
    return json({ error: "lecture impossible pour le moment" }, 500);
  }
});
