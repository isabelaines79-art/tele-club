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
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] ?? char));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  if (!supabaseUrl || !anonKey || !serviceKey || !resendKey || !adminEmail || !emailFrom) {
    console.error("Application notification function is missing required environment configuration");
    return json({ error: "Notification service is not configured" }, 503);
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
    if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return json({ error: "Invalid application id" }, 400);

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: application, error: queryError } = await adminClient
      .from("applications")
      .select("id,user_id,full_name,email,phone,address,created_at")
      .eq("id", applicationId)
      .maybeSingle();
    if (queryError || !application) return json({ error: "Application not found" }, 404);
    if (application.user_id !== authData.user.id) {
      const { data: profile } = await adminClient.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
      if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);
    }

    const safeName = escapeHtml(application.full_name);
    const safeEmail = escapeHtml(application.email);
    const safePhone = escapeHtml(application.phone);
    const safeAddress = escapeHtml(application.address);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom,
        to: [adminEmail],
        subject: "New Telectro membership application",
        text: `A new membership application was submitted.\n\nName: ${application.full_name}\nEmail: ${application.email}\nPhone: ${application.phone}\nDelivery address: ${application.address}\nApplication ID: ${application.id}\n\nReview the application in the secure Telectro admin portal.`,
        html: `<h2>New membership application</h2><p>A member submitted an application for review.</p><p><strong>Name:</strong> ${safeName}<br><strong>Email:</strong> ${safeEmail}<br><strong>Phone:</strong> ${safePhone}<br><strong>Delivery address:</strong> ${safeAddress}<br><strong>Application ID:</strong> ${escapeHtml(application.id)}</p><p>Review the application in the secure Telectro admin portal.</p>`,
      }),
    });
    if (!response.ok) {
      console.error("Email provider returned an error", response.status, await response.text());
      return json({ error: "Could not send admin notification" }, 502);
    }
    return json({ sent: true });
  } catch (error) {
    console.error("Application notification failed", error);
    return json({ error: "Notification failed" }, 500);
  }
});
