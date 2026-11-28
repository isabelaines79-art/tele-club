import { createClient } from 'npm:@supabase/supabase-js@2';
import { confirmPayment, corsHeaders, json } from '../_shared/paystack.ts';

function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
function fromHex(value: string) {
  if (!/^[\da-f]{128}$/i.test(value)) return new Uint8Array();
  return new Uint8Array(value.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) return json({ error: 'Webhook is not configured' }, 503);
  try {
    const raw = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
    if (!equalBytes(digest, fromHex(signature))) return json({ error: 'Invalid signature' }, 401);

    const event = JSON.parse(raw);
    if (event.event !== 'charge.success') return json({ received: true });
    const reference = event.data?.reference;
    if (typeof reference !== 'string' || !reference) return json({ error: 'Missing transaction reference' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await confirmPayment(admin, reference, secret);
    return json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing failed', error);
    return json({ error: 'Webhook verification failed' }, 400);
  }
});
