import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/paystack.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) return json({ error: 'Payments are not configured yet' }, 503);

    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in to continue' }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your session expired. Sign in again.' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: application, error: applicationError } = await admin
      .from('applications').select('id,user_id,email,payment_status')
      .eq('user_id', user.id).maybeSingle();
    if (applicationError || !application) return json({ error: 'Submit your membership application before paying' }, 409);
    if (application.payment_status === 'confirmed') return json({ error: 'This membership is already paid' }, 409);
    if (!application.email || !/^\S+@\S+\.\S+$/.test(application.email)) {
      return json({ error: 'A valid email address is required by Paystack' }, 400);
    }

    const reference = `TC-${crypto.randomUUID()}`;
    const callback = new URL('/payment.html', request.headers.get('origin') || 'https://tele-club.vercel.app');
    const initialized = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: application.email,
        amount: 7500000,
        currency: 'NGN',
        reference,
        callback_url: callback.toString(),
        metadata: { user_id: user.id, application_id: application.id, purpose: 'telectro_membership' }
      })
    });
    const result = await initialized.json();
    if (!initialized.ok || !result.status || !result.data?.authorization_url) {
      console.error('Paystack initialize failed', result.message || initialized.status);
      return json({ error: 'Could not start secure checkout. Please try again.' }, 502);
    }
    const { error: saveError } = await admin.from('payment_transactions').insert({
      user_id: user.id,
      application_id: application.id,
      paystack_reference: reference,
      amount_kobo: 7500000,
      currency: 'NGN',
      authorization_url: result.data.authorization_url
    });
    if (saveError) {
      console.error('Could not save payment initialization', saveError.message);
      return json({ error: 'Checkout could not be recorded. Please contact support before retrying.' }, 500);
    }
    return json({ authorization_url: result.data.authorization_url });
  } catch (error) {
    console.error('Paystack initialization error', error);
    return json({ error: 'Checkout is temporarily unavailable. Please try again.' }, 500);
  }
});
