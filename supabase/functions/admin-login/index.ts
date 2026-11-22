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

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Authentication service is not configured" }, 503);

  let username = "";
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 1 || password.length > 256) {
      return json({ error: "Invalid username or password" }, 401);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: locked } = await admin.rpc("admin_login_is_locked", { p_username: username });
    if (locked) return json({ error: "Too many failed attempts. Try again in 15 minutes." }, 429);

    const { data: account } = await admin.from("admin_usernames").select("user_id").eq("username", username).maybeSingle();
    if (!account?.user_id) {
      await admin.rpc("admin_login_failure", { p_username: username });
      return json({ error: "Invalid username or password" }, 401);
    }

    const [{ data: authUser, error: userError }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(account.user_id),
      admin.from("profiles").select("role").eq("id", account.user_id).maybeSingle(),
    ]);
    if (userError || !authUser.user?.email || profile?.role !== "admin") {
      await admin.rpc("admin_login_failure", { p_username: username });
      return json({ error: "Invalid username or password" }, 401);
    }

    // Verify the supplied password through Supabase Auth; the service key is never sent to the browser.
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: authUser.user.email, password });
    if (error || !data.session) {
      await admin.rpc("admin_login_failure", { p_username: username });
      return json({ error: "Invalid username or password" }, 401);
    }

    await admin.rpc("admin_login_success", { p_username: username });
    return json({ session: data.session });
  } catch (error) {
    console.error("Admin username login failed", error instanceof Error ? error.message : "unknown error");
    if (username) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceKey && url) {
        const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        await admin.rpc("admin_login_failure", { p_username: username });
      }
    }
    return json({ error: "Could not sign in. Try again." }, 500);
  }
});
