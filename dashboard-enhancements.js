/* Dashboard interaction and persistence enhancements. */
(() => {
  'use strict';

  const config = window.TELECTRO_CONFIG || {};
  let client = null;
  let saving = false;

  function getClient() {
    if (client) return client;
    const formClient = document.getElementById('af')?.__telectroSupabase;
    if (formClient) return (client = formClient);
    if (window.supabase && config.url && config.anonKey) {
      client = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  function setMessage(form, text, failed = false) {
    const message = form.querySelector('#bm, #message, #payoutMessage');
    if (!message) return;
    message.textContent = text;
    message.className = 'msg ' + (failed ? 'er error' : 'ok success');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
  }

  async function saveAccount(form) {
    if (saving) return;
    const db = getClient();
    const button = form.querySelector('button[type="submit"]');
    if (!db) {
      setMessage(form, 'Authentication is not configured. Please reload and try again.', true);
      return;
    }

    saving = true;
    if (button) {
      button.disabled = true;
      button.dataset.originalLabel ||= button.textContent;
      button.textContent = 'Saving…';
    }

    try {
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw new Error('Your session expired. Sign in again, then retry.');

      const byName = name => form.elements.namedItem(name)?.value?.trim() || '';
      const isStandalone = form.id === 'detailsForm';
      const details = {
        user_id: user.id,
        account_name: isStandalone ? document.getElementById('accountName')?.value.trim() : byName('n'),
        bank_name: isStandalone ? document.getElementById('bankName')?.value.trim() : byName('b'),
        account_number: isStandalone ? document.getElementById('accountNumber')?.value.trim() : byName('x')
      };
      const { error } = await db.from('member_payment_details').upsert(details, { onConflict: 'user_id' });
      if (error) throw error;

      setMessage(form, 'Payout account saved securely. This form will stay open so you can review or update it.');
      if (button) {
        button.textContent = 'Saved';
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = button.dataset.originalLabel || 'Save account';
        }, 2200);
      }
    } catch (error) {
      setMessage(form, error?.message || 'Could not save your account details. Please try again.', true);
    } finally {
      saving = false;
      if (button) button.disabled = false;
    }
  }

  // Handle account saves before the page's legacy submit handler. Do not navigate,
  // close the page, or rerender the form after a successful upsert.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form || !['bf', 'detailsForm'].includes(form.id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    saveAccount(form);
  }, true);

  function polishDashboard() {
    const app = document.getElementById('app');
    if (!app || app.classList.contains('hidden')) return;
    const isAdmin = !!app.querySelector('.tabs.admin');
    document.body.classList.toggle('telectro-admin', isAdmin);
    document.body.classList.toggle('telectro-member', !isAdmin);
  }

  const observer = new MutationObserver(polishDashboard);
  function start() {
    const app = document.getElementById('app');
    if (app) observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    polishDashboard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
