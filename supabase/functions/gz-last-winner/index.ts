// gz-last-winner — image publique « dernier vainqueur GameZone » pour la présentation des tournois sur mytennis
// (26.09.2026). Sert la photo du vainqueur la plus récente d'un tournoi GameZone dont la photo est autorisée à la
// publication (gz_player_status.photo_public), redimensionnée en bandeau 800×400 par le stockage Supabase.
// Sans photo disponible : la photo GameZone du site (poignée de main).
// Adresse stable : https://app.teamlausanne.ch/gz/dernier-vainqueur.jpg (réécriture Netlify vers cette fonction).
// Paramètres facultatifs : ?w=800&h=400 (bornés). Cadrage = centre de la photo (version de test ; le centrage sur
// les visages viendra si mytennis accepte cette image externe).
import { createClient } from "npm:@supabase/supabase-js@2";

const FALLBACK = "https://teamlausanne.ch/assets/photos/gamezone-2026.jpg";

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const w = Math.min(Math.max(Number(u.searchParams.get("w")) || 800, 200), 1600);
    const h = Math.min(Math.max(Number(u.searchParams.get("h")) || 400, 100), 1200);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await supa.from("gz_player_status")
      .select("photo_url, updated_at, gz_tournaments!inner(is_gamezone)")
      .eq("is_winner", true).eq("photo_public", true).not("photo_url", "is", null)
      .eq("gz_tournaments.is_gamezone", true)
      .order("updated_at", { ascending: false }).limit(1);
    const photo = data?.[0]?.photo_url as string | undefined;
    let src = FALLBACK;
    if (photo && photo.includes("/storage/v1/object/public/")) {
      src = photo.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${w}&height=${h}&resize=cover&quality=72`;
    }
    const r = await fetch(src);
    if (!r.ok) return Response.redirect(FALLBACK, 302);
    return new Response(r.body, { status: 200, headers: {
      "content-type": r.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=900",          // 15 min : la nouvelle photo apparaît vite après un tournoi
      "access-control-allow-origin": "*",
      "cross-origin-resource-policy": "cross-origin",
    } });
  } catch (_) {
    return Response.redirect(FALLBACK, 302);
  }
});
