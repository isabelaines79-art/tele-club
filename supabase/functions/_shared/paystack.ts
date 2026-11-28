export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export async function verifyWithPaystack(reference: string, secret: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.status || result.data?.status !== 'success') {
    throw new Error('Paystack has not verified a successful payment');
  }
  if (result.data.reference !== reference || result.data.amount !== 7500000 || result.data.currency !== 'NGN') {
    throw new Error('Verified transaction does not match the expected amount and currency');
  }
  return result.data;
}

export async function confirmPayment(admin: any, reference: string, secret: string) {
  const verified = await verifyWithPaystack(reference, secret);
  const { data: payment, error: lookupError } = await admin
    .from('payment_transactions')
    .select('user_id,application_id,amount_kobo,currency')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (lookupError || !payment) throw new Error('Payment reference was not initialized by Telectro');
  if (payment.amount_kobo !== verified.amount || payment.currency !== verified.currency) {
    throw new Error('Transaction does not match the initialized payment');
  }
  const { error } = await admin.rpc('confirm_paystack_payment', { p_reference: reference });
  if (error) throw new Error(`Could not record verified payment: ${error.message}`);
  return payment;
}
