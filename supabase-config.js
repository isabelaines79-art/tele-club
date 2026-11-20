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

// The 10-tap gesture is only a shortcut to the dedicated admin sign-in screen.
window.addEventListener('load', () => {
  const openAuth = window.openAuth;
  if (typeof openAuth !== 'function') return;
  window.openAuth = function (mode, isAdmin) {
    if (isAdmin) {
      window.location.assign('/admin-payouts.html');
      return;
    }
    return openAuth.apply(this, arguments);
  };
});
