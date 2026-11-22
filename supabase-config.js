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

// Capture the page's Supabase client when it is created. This script loads before
// index.html initializes the client, so capturing it here avoids a load-time race.
if (window.supabase?.createClient) {
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    const authForm = document.getElementById('af');
    if (authForm) authForm.__telectroSupabase = client;

    // Older dashboard code expects an email identifier. For phone-auth accounts,
    // use the verified phone as that display/application compatibility fallback.
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

  // Use phone/password for member signup and login, leaving the dashboard intact.
  const form = document.getElementById('af');
  const input = document.getElementById('ae');
  if (!form || !input) return;

  input.type = 'tel';
  input.autocomplete = 'tel';
  input.inputMode = 'tel';
  input.placeholder = '+2348012345678';
  input.maxLength = 20;
  input.required = true;
  const phoneLabel = form.querySelector('label[for="ae"]');
  if (phoneLabel) phoneLabel.textContent = 'Mobile number';
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
    const client = form.__telectroSupabase;
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
    if (!client) return say('Authentication is not configured. Reload the page and try again.', 'er');

    button.disabled = true;
    say('');
    try {
      const result = form.dataset.authMode === 'signup'
        ? await client.auth.signUp({
            phone,
            password,
            options: { data: { full_name: document.getElementById('an')?.value.trim() || '' } }
          })
        : await client.auth.signInWithPassword({ phone, password });
      if (result.error) {
        say(result.error.message || 'Authentication failed. Check your phone number and password.', 'er');
      } else if (form.dataset.authMode === 'signup' && !result.data?.session) {
        say('Account created, but phone confirmation is enabled in Supabase Auth. Complete the SMS confirmation before logging in.', 'er');
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
});
