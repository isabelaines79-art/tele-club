// Supabase project URL and publishable key are safe to use in the browser when
// Row Level Security is enabled. Never put a service-role key or provider secret here.
window.TELECTRO_CONFIG = {
  url: "https://ooiawhnemxazflyjqcst.supabase.co",
  anonKey: "sb_publishable_LLDzFZ0gv9bOE3PxR6AXXA_E17cxGmr"
};

// The main page's hidden admin gesture previously opened a password form.
// Route that gesture to the dedicated email-code admin portal instead.
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
