import { createClient } from 'npm:@supabase/supabase-js@2';
import { confirmPayment, corsHeaders, json } from '../_shared/paystack.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) return json({ error: 'Payments are not configured yet' }, 503);
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in to verify your payment' }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your session expired. Sign in again.' }, 401);
    const { reference } = await request.json();
    if (typeof reference !== 'string' || !reference) return json({ error: 'Missing payment reference' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: payment, error } = await admin.from('payment_transactions')
      .select('user_id').eq('paystack_reference', reference).maybeSingle();
    if (error || !payment || payment.user_id !== user.id) return json({ error: 'Payment reference not found for this account' }, 404);
    await confirmPayment(admin, reference, secret);
    return json({ status: 'confirmed' });
  } catch (error) {
    console.error('Paystack return verification failed', error);
    return json({ error: error instanceof Error ? error.message : 'Payment verification failed' }, 400);
  }
});
