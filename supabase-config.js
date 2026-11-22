// Supabase project URL and publishable key are safe in the browser when RLS is enabled.
// Never place a service-role key or provider secret in this file.
window.TELECTRO_CONFIG = {
  url: "https://ooiawhnemxazflyjqcst.supabase.co",
  anonKey: "sb_publishable_LLDzFZ0gv9bOE3PxR6AXXA_E17cxGmr"
};

// Apply the shared light visual theme on every page that loads this config.
if (document.head && !document.querySelector('link[data-telectro-theme]')) {
  const theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = '/site-theme.css';
  theme.dataset.telectroTheme = 'true';
  document.head.appendChild(theme);
}

// Make the existing member dashboard's email fallback work for phone-auth users.
// Older application records still have an email field, so retain the phone as its identifier there.
if (window.supabase?.createClient) {
  const createClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = (...args) => {
    const client = createClient(...args);
    const normalizeSession = session => {
      if (session?.user && !session.user.email) session.user.email = session.user.phone || '';
      return session;
    };
    const onAuthStateChange = client.auth.onAuthStateChange.bind(client.auth);
    client.auth.onAuthStateChange = callback => onAuthStateChange((event, session) => callback(event, normalizeSession(session)));
    const getSession = client.auth.getSession.bind(client.auth);
    client.auth.getSession = async () => {
      const result = await getSession();
      normalizeSession(result.data?.session);
      return result;
    };
    return client;
  };
}

// The 10-tap gesture is only a shortcut to the dedicated admin sign-in screen.
window.addEventListener('load', () => {
  const openAuth = window.openAuth;
  if (typeof openAuth === 'function') {
    window.openAuth = function (mode, isAdmin) {
      if (isAdmin) {
        window.location.assign('/admin-payouts.html');
        return;
      }
      return openAuth.apply(this, arguments);
    };
  }

  // Switch the existing member auth dialog to phone/password without changing the
  // application dashboard or role-based admin flow.
  const form = document.getElementById('af');
  const input = document.getElementById('ae');
  if (!form || !input) return;

  input.type = 'tel';
  input.autocomplete = 'tel';
  input.inputMode = 'tel';
  input.placeholder = '+2348012345678';
  input.maxLength = 20;
  input.removeAttribute('required');
  input.required = true;
  const emailLabel = form.querySelector('label[for="ae"]');
  if (emailLabel) emailLabel.textContent = 'Mobile number';
  const forgot = document.getElementById('fg');
  if (forgot) forgot.hidden = true;

  const intro = document.querySelector('#pub .g4 .card .sub');
  if (intro && intro.textContent.includes('email')) {
    intro.textContent = 'Sign up with your mobile number and password.';
  }

  const normalizePhone = value => {
    const trimmed = value.trim();
    const hadPlus = trimmed.startsWith('+');
    let digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
    else if (!hadPlus && digits.length === 10) digits = `234${digits}`;
    if (digits.length < 8 || digits.length > 15) return '';
    return `+${digits}`;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const message = document.getElementById('am');
    const button = document.getElementById('ab');
    const client = window.supabase && window.TELECTRO_CONFIG?.url
      ? window.supabase
      : null;
    // The configured client is created by the page's existing script; expose it
    // through the same auth API by using the client reference captured by the form.
    const phone = normalizePhone(input.value);
    const password = document.getElementById('apw')?.value || '';
    const say = (text, kind = '') => {
      if (message) {
        message.textContent = text;
        message.className = `msg ${kind}`;
      }
    };
    if (!phone) return say('Enter a valid phone number, including your country code.', 'er');
    if (!password) return say('Enter your password.', 'er');

    // The page keeps its Supabase client in a private variable. Its original
    // submit handler is intercepted only after we obtain that client below.
    const clientFromForm = form.__telectroSupabase;
    if (!client || !clientFromForm) return say('Authentication is not configured. Reload the page and try again.', 'er');

    button.disabled = true;
    say('');
    try {
      const result = form.dataset.authMode === 'signup'
        ? await clientFromForm.auth.signUp({
            phone,
            password,
            options: { data: { full_name: document.getElementById('an')?.value.trim() || '' } }
          })
        : await clientFromForm.auth.signInWithPassword({ phone, password });
      if (result.error) {
        say(result.error.message || 'Authentication failed. Check your phone number and password.', 'er');
      } else if (form.dataset.authMode === 'signup' && !result.data?.session) {
        say('Account created. Phone confirmation still appears to be enabled in Supabase Auth; disable Confirm Phone to sign in without an SMS code.', 'er');
      } else {
        document.getElementById('dlg')?.close();
      }
    } catch (error) {
      say(error.message || 'Authentication failed. Please try again.', 'er');
    } finally {
      button.disabled = false;
    }
  }, true);

  // Keep the selected tab in sync with the existing dialog controls.
  const updateMode = mode => { form.dataset.authMode = mode; };
  document.getElementById('tLogin')?.addEventListener('click', () => updateMode('login'));
  document.getElementById('tSign')?.addEventListener('click', () => updateMode('signup'));
  updateMode('login');

  // Attach the page's existing Supabase client when the auth form is submitted.
  // The lexical client is not exposed globally, so wrap createClient before the
  // page script initializes it and attach each created client to the dialog.
  const originalCreateClient = window.supabase?.createClient;
  if (originalCreateClient && !originalCreateClient.__telectroBound) {
    const wrappedCreateClient = function (...args) {
      const client = originalCreateClient.apply(this, args);
      const authForm = document.getElementById('af');
      if (authForm) authForm.__telectroSupabase = client;
      return client;
    };
    wrappedCreateClient.__telectroBound = true;
    window.supabase.createClient = wrappedCreateClient;
  }
});
