import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminAction = "list" | "approve" | "reject";

type AdminRequest = {
  action?: AdminAction;
  bucket?: string;
  name?: string;
  username?: string;
  password?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSafePendingName(name: string) {
  return Boolean(name) && !name.includes("/") && !name.includes("..");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminUser = Deno.env.get("GALLERY_ADMIN_USER") || "CARLOSHENRIQUE";
  const adminPasswordHash = Deno.env.get("GALLERY_ADMIN_PASSWORD_HASH");

  if (!supabaseUrl || !serviceRoleKey || !adminPasswordHash) {
    return jsonResponse({ error: "Função admin sem configuração segura." }, 500);
  }

  let payload: AdminRequest;

  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const username = payload.username?.trim().toUpperCase() || "";
  const password = payload.password || "";
  const typedPasswordHash = await sha256(password);

  if (username !== adminUser || typedPasswordHash !== adminPasswordHash) {
    return jsonResponse({ error: "Login ou senha inválidos." }, 401);
  }

  const bucket = payload.bucket || "guest-photos";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  if (payload.action === "list") {
    const { data, error } = await supabase.storage.from(bucket).list("pending", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      return jsonResponse({ error: "Não foi possível carregar as pendências." }, 500);
    }

    const pendingPhotos = (data || []).filter((item) => item.name && !item.name.endsWith("/"));
    const photos = await Promise.all(
      pendingPhotos.map(async (item) => {
        const path = `pending/${item.name}`;
        const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 600);

        return {
          name: item.name,
          url: signedError ? "" : signed.signedUrl,
        };
      }),
    );

    return jsonResponse({ photos: photos.filter((photo) => photo.url) });
  }

  if (!payload.name || !isSafePendingName(payload.name)) {
    return jsonResponse({ error: "Nome de mídia inválido." }, 400);
  }

  const source = `pending/${payload.name}`;

  if (payload.action === "approve") {
    const destination = `approved/${payload.name}`;
    const { error: copyError } = await supabase.storage.from(bucket).copy(source, destination);

    if (copyError) {
      return jsonResponse({ error: "Erro ao aprovar mídia." }, 500);
    }

    const { error: removeError } = await supabase.storage.from(bucket).remove([source]);

    if (removeError) {
      return jsonResponse({ error: "Mídia aprovada, mas não foi removida dos pendentes." }, 500);
    }

    return jsonResponse({ ok: true });
  }

  if (payload.action === "reject") {
    const { error } = await supabase.storage.from(bucket).remove([source]);

    if (error) {
      return jsonResponse({ error: "Erro ao reprovar mídia." }, 500);
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Ação inválida." }, 400);
});
