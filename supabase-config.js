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

// The 10-tap gesture reveals the GitHub-authenticated admin entry only.
window.addEventListener('load', async () => {
  const shortcut = document.createElement('script');
  shortcut.src = '/membership-shortcut.js';
  document.body.appendChild(shortcut);

  const isAdminPage = window.location.pathname.endsWith('/admin-payouts.html');
  if (isAdminPage && window.supabase) {
    const client = window.supabase.createClient(window.TELECTRO_CONFIG.url, window.TELECTRO_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = await client.auth.getSession();
    if (!data.session) {
      window.location.replace('/admin-github-login.html');
      return;
    }
  }

  const openAuth = window.openAuth;
  if (typeof openAuth !== 'function') return;
  window.openAuth = function (mode, isAdmin) {
    if (isAdmin) {
      window.location.assign('/admin-github-login.html');
      return;
    }
    return openAuth.apply(this, arguments);
  };
});
