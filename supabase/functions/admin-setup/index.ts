import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const setupSecret = Deno.env.get("ADMIN_SETUP_SECRET");

  if (!supabaseUrl || !anonKey || !serviceKey || !setupSecret) {
    return json({ error: "Admin setup is not configured" }, 503);
  }

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const secret = typeof body?.setupSecret === "string" ? body.setupSecret : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (!secret) return json({ error: "Setup secret is required" }, 400);

    const provided = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const expected = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(setupSecret));
    const providedBytes = new Uint8Array(provided);
    const expectedBytes = new Uint8Array(expected);
    let mismatch = 0;
    for (let i = 0; i < providedBytes.length; i++) mismatch |= providedBytes[i] ^ expectedBytes[i];
    if (mismatch !== 0) return json({ error: "Invalid setup secret" }, 403);

    const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: existingUser, error: lookupError } = await auth.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lookupError) return json({ error: "Could not inspect existing accounts" }, 500);

    let userId = existingUser.users.find((user) => user.email?.toLowerCase() === email)?.id;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Administrator" },
      });
      if (createError) return json({ error: createError.message }, 400);
      userId = created.user?.id;
    } else {
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (updateError) return json({ error: updateError.message }, 400);
    }

    if (!userId) return json({ error: "Could not prepare the admin account" }, 500);

    const { error: profileError } = await admin.from("profiles").upsert(
      { id: userId, full_name: "Administrator", role: "admin" },
      { onConflict: "id" },
    );
    if (profileError) return json({ error: "Account created, but admin role could not be assigned" }, 500);

    return json({ success: true, email });
  } catch (error) {
    console.error("Admin setup failed", error);
    return json({ error: "Admin setup failed" }, 500);
  }
});
