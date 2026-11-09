// Flux Instagram du site public — @team_lausanne_academy.
//
// Le site ne parle JAMAIS a Meta : il appelle cette fonction, qui sert un
// cache. Trois raisons : le jeton reste cote serveur, Meta ne voit pas les
// visiteurs du site, et une panne de Meta ne fait pas tomber la page.
//
// ⚠ Les media_url du CDN Meta EXPIRENT (quelques jours). Le cache n'est donc
// pas « on garde pour toujours » : on rafraichit des qu'il a plus de 6 h, et
// on force si le cache est vide. Une page visitee de temps en temps garde donc
// des adresses valides.
//
// Jeton : « Instagram API with Instagram Login » (graph.instagram.com), le
// chemin le plus court — compte professionnel + app Meta, sans page Facebook.
// Il dure 60 jours et se renouvelle tout seul : on le rafraichit des qu'il
// lui reste moins de 10 jours. Il vit dans insta_secret, table sans policy,
// donc illisible autrement que par la cle de service.
//
// Reponse : { posts: [...], source: "cache" | "meta", raison?: "..." }
// Sans jeton, on repond 200 avec posts: [] — le site garde ses photos. Un
// bandeau d'images n'est pas une raison de faire une page en erreur.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const SIX_H = 6 * 3600 * 1000;
const DIX_JOURS = 10 * 24 * 3600 * 1000;
const COMBIEN = 12;              // ce que le bandeau peut montrer, large

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Secret = { token: string; expires_at: string | null; user_id: string | null };

// --- le jeton, et son entretien -------------------------------------------
async function jeton(): Promise<Secret | null> {
  const { data } = await supa.from("insta_secret").select("token, expires_at, user_id").eq("id", 1).maybeSingle();
  if (!data?.token) return null;

  // Moins de 10 jours de validite : on le renouvelle. Meta refuse de
  // rafraichir un jeton de moins de 24 h, et c'est sans importance ici —
  // on ne touche qu'aux jetons qui approchent de leur fin.
  const fin = data.expires_at ? Date.parse(data.expires_at) : 0;
  if (fin && fin - Date.now() < DIX_JOURS) {
    try {
      const r = await fetch("https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token"
        + `&access_token=${encodeURIComponent(data.token)}`);
      const j = await r.json();
      if (r.ok && j.access_token) {
        const neuf = {
          token: j.access_token as string,
          expires_at: new Date(Date.now() + (Number(j.expires_in) || 5184000) * 1000).toISOString(),
          refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supa.from("insta_secret").update(neuf).eq("id", 1);
        return { ...data, token: neuf.token, expires_at: neuf.expires_at };
      }
      console.warn("instagram: renouvellement refuse", j?.error?.message || r.status);
    } catch (e) {
      console.warn("instagram: renouvellement impossible", (e as Error).message);
    }
  }
  return data as Secret;
}

// --- les publications ------------------------------------------------------
async function depuisMeta(s: Secret) {
  const champs = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";
  const cible = s.user_id ? encodeURIComponent(s.user_id) : "me";
  const url = `https://graph.instagram.com/${cible}/media?fields=${champs}`
    + `&limit=${COMBIEN}&access_token=${encodeURIComponent(s.token)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Meta a repondu ${r.status}`);

  const posts = (j.data || []).map((m: Record<string, unknown>) => ({
    id: String(m.id),
    permalink: String(m.permalink || ""),
    media_type: String(m.media_type || ""),
    // Une video n'a pas d'image : sa vignette fait l'affaire dans un bandeau.
    media_url: String(m.media_type === "VIDEO" ? (m.thumbnail_url || m.media_url) : (m.media_url || "")),
    thumbnail_url: m.thumbnail_url ? String(m.thumbnail_url) : null,
    caption: m.caption ? String(m.caption).slice(0, 400) : null,
    posted_at: m.timestamp ? new Date(String(m.timestamp)).toISOString() : null,
    fetched_at: new Date().toISOString(),
  })).filter((p: { permalink: string; media_url: string }) => p.permalink && p.media_url);

  if (posts.length) {
    // Insert groupe : toutes les lignes ont EXACTEMENT les memes clefs, sinon
    // PostgREST refuse tout le lot (PGRST102). Elles sortent du meme map,
    // donc c'est acquis — mais on lit quand meme l'erreur.
    const { error } = await supa.from("insta_posts").upsert(posts, { onConflict: "id" });
    if (error) console.error("instagram: ecriture du cache", error.message);
    // On ne garde que ce qu'on montre : les anciennes lignes portent des
    // adresses CDN mortes, elles n'ont plus d'interet.
    const gardes = posts.map((p: { id: string }) => p.id);
    await supa.from("insta_posts").delete().not("id", "in", `(${gardes.map((g: string) => `"${g}"`).join(",")})`);
  }
  return posts;
}

async function cache() {
  const { data } = await supa.from("insta_posts")
    .select("id, permalink, media_type, media_url, caption, posted_at, fetched_at")
    .order("posted_at", { ascending: false }).limit(COMBIEN);
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const vieux = await cache();
    const frais = vieux.length
      && Date.now() - Date.parse(vieux[0].fetched_at) < SIX_H;
    if (frais) return json({ posts: vieux, source: "cache" });

    const s = await jeton();
    // Pas de jeton : le site garde ses photos, sans rien casser.
    if (!s) return json({ posts: vieux, source: "cache", raison: "jeton absent" });

    try {
      const posts = await depuisMeta(s);
      return json({ posts, source: "meta" });
    } catch (e) {
      // Meta en panne ou jeton perime : on sert le cache, meme vieux. Des
      // photos d'il y a trois jours valent mieux qu'un trou dans la page.
      console.error("instagram:", (e as Error).message);
      return json({ posts: vieux, source: "cache", raison: (e as Error).message });
    }
  } catch (e) {
    console.error("instagram: panne", (e as Error).message);
    return json({ posts: [], source: "cache", raison: "panne" });
  }
});
