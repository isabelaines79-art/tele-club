/* Member dashboard refresh: responsive account, progress, payout and verified referral views. */
(() => {
  'use strict';

  const config = window.TELECTRO_CONFIG || {};
  let db = null;
  let observer = null;
  let queued = false;
  let busy = false;
  let renderedKey = '';
  let saveInProgress = false;
  const $ = (id, root = document) => root.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
  const date = value => value ? new Date(value).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }) : '—';
  const month = value => value ? new Date(value + (String(value).length === 7 ? '-01' : '') + 'T00:00:00').toLocaleDateString('en-NG', { month:'short', year:'numeric' }) : '—';
  const statusLabel = value => String(value || 'pending').replaceAll('_', ' ');
  const statusClass = value => ['paid','approved','confirmed','delivered','earned'].includes(value) ? 'good' : ['failed','rejected'].includes(value) ? 'bad' : 'pending';
  const toast = message => {
    let node = $('telectroMemberToast');
    if (!node) { node = document.createElement('div'); node.id = 'telectroMemberToast'; node.className = 'tm-toast'; node.setAttribute('role','status'); document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('visible'), 3000);
  };

  function client() {
    if (db) return db;
    const fromAuthForm = $('af')?.__telectroSupabase;
    if (fromAuthForm) return (db = fromAuthForm);
    if (window.supabase && config.url && config.anonKey) {
      db = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
    }
    return db;
  }

  function installStyles() {
    if ($('telectro-member-refresh-styles')) return;
    const style = document.createElement('style');
    style.id = 'telectro-member-refresh-styles';
    style.textContent = `
      #app.tm-member{max-width:980px;padding:24px 16px 70px;color:#40516c}
      #app.tm-member .tm-stack{display:grid;gap:16px}
      #app.tm-member .tm-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      #app.tm-member .tm-head h1{font-size:clamp(25px,4vw,36px);line-height:1.15;margin:0;color:#40516c}
      #app.tm-member .tm-head .tm-spacer{flex:1}
      #app.tm-member .tm-card{padding:22px;border:1px solid #dfe5ee;border-radius:20px;background:#fff;box-shadow:0 10px 28px #32445e0b}
      #app.tm-member .tm-card h2{font-size:19px;color:#40516c;margin:0 0 3px}
      #app.tm-member .tm-muted{color:#75839a;font-size:14px;line-height:1.6}
      #app.tm-member .tm-hero{position:relative;overflow:hidden;color:#fff;background:linear-gradient(125deg,#526fc2,#6879c8 58%,#56a69c);border:0}
      #app.tm-member .tm-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,#ffffff20 50%,transparent 70%);transform:translateX(-110%);pointer-events:none}
      #app.tm-member .tm-hero.tm-shine::after{animation:tmShine 1.1s ease}
      @keyframes tmShine{to{transform:translateX(110%)}}
      #app.tm-member .tm-label{font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:750;color:#e5edff}
      #app.tm-member .tm-total{font-size:clamp(36px,8vw,56px);font-weight:800;letter-spacing:-.04em;margin:4px 0;color:#fff;font-variant-numeric:tabular-nums}
      #app.tm-member .tm-hero .tm-muted{color:#f2f5ff}
      #app.tm-member .tm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      #app.tm-member .tm-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      #app.tm-member .tm-stat{padding:14px;border:1px solid #ffffff38;border-radius:15px;background:#ffffff14}
      #app.tm-member .tm-stat small{display:block;color:#e8edff;font-size:12px}
      #app.tm-member .tm-stat b{display:block;margin-top:3px;color:#fff;font-size:22px}
      #app.tm-member .tm-ring-wrap{display:grid;place-items:center;position:relative;margin:16px auto 8px;width:172px;height:172px}
      #app.tm-member .tm-ring{width:172px;height:172px;transform:rotate(-90deg)}
      #app.tm-member .tm-ring-track{stroke:#e8edf5}
      #app.tm-member .tm-ring-bar{stroke:url(#tm-gradient);transition:stroke-dashoffset .8s ease}
      #app.tm-member .tm-ring-label{position:absolute;text-align:center;color:#40516c}
      #app.tm-member .tm-ring-label b{display:block;font-size:30px;line-height:1.1;color:#40516c}
      #app.tm-member .tm-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      #app.tm-member .tm-chip{padding:5px 10px;border-radius:30px;background:#f0f3f8;color:#61718a;font-size:12px}
      #app.tm-member .tm-chip b{color:#40516c}
      #app.tm-member .tm-status{display:inline-flex;align-items:center;padding:4px 9px;border-radius:99px;text-transform:capitalize;font-size:12px;font-weight:700;white-space:nowrap}
      #app.tm-member .tm-status.good{background:#e8f4ec;color:#287653}
      #app.tm-member .tm-status.pending{background:#fbf3e3;color:#8a6428}
      #app.tm-member .tm-status.bad{background:#fbebed;color:#ad4b5a}
      #app.tm-member .tm-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-top:1px solid #e7ebf2}
      #app.tm-member .tm-line:first-of-type{border-top:0}
      #app.tm-member .tm-line span:first-child{color:#75839a}
      #app.tm-member .tm-amount{font-weight:750;color:#40516c}
      #app.tm-member .tm-timeline{list-style:none;padding:4px 0 0;margin:12px 0 0}
      #app.tm-member .tm-timeline li{position:relative;display:flex;gap:12px;padding:0 0 17px;color:#75839a}
      #app.tm-member .tm-timeline li:not(:last-child)::before{content:"";position:absolute;left:11px;top:24px;bottom:0;width:2px;background:#dfe5ee}
      #app.tm-member .tm-timeline li.tm-done:not(:last-child)::before{background:#36a47e}
      #app.tm-member .tm-dot{position:relative;z-index:1;display:grid;place-items:center;flex:none;width:24px;height:24px;border:2px solid #dfe5ee;border-radius:50%;background:#fff;font-size:12px}
      #app.tm-member .tm-done .tm-dot{border-color:#36a47e;background:#36a47e;color:white}
      #app.tm-member .tm-now{color:#40516c;font-weight:650}
      #app.tm-member .tm-now .tm-dot{border-color:#526fc2;box-shadow:0 0 0 4px #526fc226}
      #app.tm-member .tm-bars{display:flex;align-items:flex-end;gap:8px;height:55px;margin-top:16px}
      #app.tm-member .tm-bars i{flex:1;min-width:5px;height:6px;border-radius:7px 7px 3px 3px;background:#ffffff55;transition:height .7s ease}
      #app.tm-member .tm-bars i.is-paid{background:#fff}
      #app.tm-member .tm-bar-labels{display:flex;gap:8px;margin-top:4px;color:#f2f5ff;font-size:11px}
      #app.tm-member .tm-bar-labels span{flex:1;text-align:center}
      #app.tm-member .tm-table{overflow:auto;border:1px solid #e2e8f0;border-radius:14px;-webkit-overflow-scrolling:touch}
      #app.tm-member table{width:100%;border-collapse:collapse;min-width:440px}
      #app.tm-member th,#app.tm-member td{padding:12px;text-align:left;border-bottom:1px solid #e7ebf2;color:#586981}
      #app.tm-member th{background:#f0f3f8;font-size:12px}
      #app.tm-member .tm-button{min-height:42px;padding:9px 14px;border:1px solid #d9e1ec;border-radius:11px;background:#eef2f8;color:#586981;font:inherit;font-weight:650;cursor:pointer}
      #app.tm-member .tm-primary{border:0;color:#fff;background:linear-gradient(135deg,#5574c9,#6c69c3)}
      #app.tm-member .tm-button:disabled{opacity:.6;cursor:wait}
      #app.tm-member .tm-form{display:grid;gap:12px;margin-top:14px}
      #app.tm-member .tm-form label{display:grid;gap:6px;color:#66768d;font-size:13px}
      #app.tm-member .tm-form input{min-height:46px;padding:11px 13px;border:1px solid #cfd8e5;border-radius:11px;background:#fff;color:#40516c;font:inherit}
      #app.tm-member .tm-form input:focus{outline:2px solid #6881cb;border-color:transparent}
      #app.tm-member .tm-account-saved{display:grid;gap:10px;margin-top:14px;padding:15px;border:1px solid #dfe5ee;border-radius:15px;background:#f8fafc}
      #app.tm-member .tm-account-saved[hidden],#app.tm-member .tm-account-form[hidden]{display:none}
      #app.tm-member .tm-warning{margin-top:12px;padding:10px 12px;border-radius:12px;background:#fbf3e3;color:#805d25;font-size:13px}
      #app.tm-member .tm-referral{border-color:#dbe5f4;background:linear-gradient(145deg,#fff,#f6f9ff)}
      #app.tm-member .tm-code{margin:12px 0;padding:12px;border:1px dashed #b9c7df;border-radius:12px;background:#f8faff;color:#40516c;font-weight:750;overflow-wrap:anywhere}
      #app.tm-member .tm-empty{padding:12px 0;color:#75839a}
      #app.tm-member .tm-toast{position:fixed;z-index:50;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0));transform:translate(-50%,140px);padding:11px 18px;border:1px solid #596b86;border-radius:14px;background:#40516c;color:#fff;box-shadow:0 12px 32px #26344924;transition:transform .25s}
      #app.tm-member .tm-toast.visible{transform:translate(-50%,0)}
      @media(max-width:680px){#app.tm-member{padding:18px 14px 52px}.tm-grid{grid-template-columns:1fr!important}.tm-grid3{grid-template-columns:repeat(3,minmax(0,1fr))!important}.tm-card{padding:18px!important}}
      @media(max-width:390px){#app.tm-member .tm-grid3{grid-template-columns:1fr!important}#app.tm-member .tm-total{font-size:38px}}
      @media(prefers-reduced-motion:reduce){#app.tm-member *,#app.tm-member *::before,#app.tm-member *::after{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function status(value) { return `<span class="tm-status ${statusClass(value)}">${esc(statusLabel(value))}</span>`; }
  function paymentRows(payouts) {
    if (!payouts.length) return '<div class="tm-empty">No payouts have been recorded yet.</div>';
    return `<div class="tm-table"><table><thead><tr><th>Month</th><th>Amount</th><th>Status</th><th>Paid date</th></tr></thead><tbody>${payouts.map(p => `<tr><td>${esc(month(p.payout_month))}</td><td>${money(p.amount)}</td><td>${status(p.status)}</td><td>${esc(date(p.paid_at))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function referralCard(profile, credits) {
    const code = profile.referral_code;
    if (!code) return `<section class="tm-card tm-referral"><h2>Invite a friend</h2><p class="tm-muted">Referral rewards are not set up for this account yet. Please check back later.</p></section>`;
    const inviteUrl = `${location.origin}/?ref=${encodeURIComponent(code)}`;
    const earned = credits.filter(row => row.status === 'earned');
    const pending = credits.filter(row => row.status === 'pending');
    const total = earned.reduce((sum, row) => sum + Number(row.reward_amount || 10000), 0);
    return `<section class="tm-card tm-referral"><div class="tm-label">Member referrals</div><h2 style="margin-top:5px">Invite friends. Earn a fixed reward.</h2><p class="tm-muted">You receive ₦10,000 for each referred member after their application is approved and their payment is independently confirmed. Pending referrals are not yet earned; reward terms and payout timing apply.</p><div class="tm-code">Your invite code: ${esc(code)}</div><div class="tm-code" id="tmInviteUrl">${esc(inviteUrl)}</div><div class="tm-row" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="tm-button tm-primary" data-tm-copy>Copy invite link</button><button type="button" class="tm-button" data-tm-share>Share invite</button></div><div class="tm-grid3" style="margin-top:14px"><div class="tm-stat"><small>Earned rewards</small><b>${money(total)}</b></div><div class="tm-stat"><small>Successful referrals</small><b>${earned.length}</b></div><div class="tm-stat"><small>Awaiting verification</small><b>${pending.length}</b></div></div><p class="tm-muted" style="margin-top:12px">Referral rewards are fixed and verified. There is no random cash-prize or vehicle spin.</p></section>`;
  }

  function accountCard(details) {
    if (!details) return `<section class="tm-card"><h2>Payout account</h2><p class="tm-muted">Add the account Telectro should use for eligible payments. Never provide a PIN, password, card details, or OTP.</p><form class="tm-form" data-tm-account-form><label>Account holder name<input name="holder" autocomplete="name" maxlength="120" required></label><label>Bank name<input name="bank" autocomplete="organization" maxlength="120" required></label><label>Account number<input name="account" inputmode="numeric" autocomplete="off" pattern="[0-9]{6,20}" minlength="6" maxlength="20" required></label><button class="tm-button tm-primary" type="submit">Save payout account</button><p class="tm-muted" data-tm-account-message role="status" aria-live="polite"></p></form><div class="tm-warning">🔒 Your account details are private to you and authorized administrators.</div></section>`;
    return `<section class="tm-card"><h2>Payout account</h2><p class="tm-muted">Your payout account is saved. Details are hidden until you choose to view them.</p><div class="tm-account-saved"><b>Account details saved securely</b><span>Account number: •••• ${esc(String(details.account_number).slice(-4))}</span><button type="button" class="tm-button" data-tm-view-account>View account details</button><div data-tm-account-private hidden><div class="tm-line"><span>Account holder</span><b class="tm-amount">${esc(details.account_name)}</b></div><div class="tm-line"><span>Bank</span><b class="tm-amount">${esc(details.bank_name)}</b></div><div class="tm-line"><span>Account number</span><b class="tm-amount">${esc(details.account_number)}</b></div><p class="tm-muted">For security, contact Telectro support to change your saved details.</p></div></div><div class="tm-warning">🔒 Never share your PIN, password, card details, or OTP.</div></section>`;
  }

  function render(app, profile, details, payouts, credits, phone) {
    const paid = payouts.filter(p => p.status === 'paid');
    const planned = payouts.filter(p => p.status === 'planned');
    const failed = payouts.filter(p => p.status === 'failed');
    const total = paid.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const steps = [
      ['Application submitted', true],
      ['Application approved', app.application_status === 'approved'],
      ['Payment confirmed', app.payment_status === 'confirmed'],
      ['Preparing your order', ['preparing','dispatched','delivered'].includes(app.delivery_status)],
      ['Dispatched', ['dispatched','delivered'].includes(app.delivery_status)],
      ['Delivered', app.delivery_status === 'delivered']
    ];
    const complete = steps.filter(step => step[1]).length;
    const progress = Math.round(complete / steps.length * 100);
    const memberSince = date(app.approved_at || app.created_at);
    const schedule = Array.from({length:5}, (_, i) => {
      const p = payouts.slice().sort((x,y) => String(x.payout_month).localeCompare(String(y.payout_month)))[i];
      return p ? `<div class="tm-line"><span>${esc(month(p.payout_month))}</span><b class="tm-amount">${money(p.amount)}</b>${status(p.status)}</div>` : `<div class="tm-line"><span>Month ${i+1}</span><span class="tm-muted">Not scheduled</span><span class="tm-status pending">Not scheduled</span></div>`;
    }).join('');
    const barMax = Math.max(1, ...payouts.map(p => Number(p.amount || 0)));
    const bars = Array.from({length:5}, (_,i) => {
      const p = payouts.slice().sort((x,y) => String(x.payout_month).localeCompare(String(y.payout_month)))[i];
      const height = p ? Math.max(10, Math.round(Number(p.amount || 0) / barMax * 54)) : 6;
      return `<i class="${p?.status === 'paid' ? 'is-paid' : ''}" style="height:${height}px"></i>`;
    }).join('');
    const timeline = steps.map(([label, done], index) => `<li class="${done ? 'tm-done' : index === steps.findIndex(step => !step[1]) ? 'tm-now' : ''}"><span class="tm-dot">${done ? '✓' : ''}</span><span>${esc(label)}${!done && index === steps.findIndex(step => !step[1]) ? ` ${status('pending')}` : ''}</span></li>`).join('');
    const name = profile.full_name || app.full_name || phone || 'Member';

    return `<div class="tm-stack" data-telectro-member-dashboard>
      <div class="tm-head"><div><div class="tm-label" style="color:#287f84">Member dashboard</div><h1>Welcome back, ${esc(name.split(' ')[0])}</h1><p class="tm-muted">Your membership, payment progress, and account details.</p></div><span class="tm-spacer"></span><button type="button" class="tm-button" data-tm-refresh>Refresh dashboard</button></div>
      <section class="tm-card tm-hero" id="tmTotalHero"><div class="tm-label">Total received</div><div class="tm-total">${money(total)}</div><div class="tm-muted">Across ${paid.length} paid month(s) · Member since ${esc(memberSince)}</div><div class="tm-bars">${bars}</div><div class="tm-bar-labels">${[1,2,3,4,5].map(i=>`<span>Month ${i}</span>`).join('')}</div></section>
      <div class="tm-grid"><section class="tm-card"><h2>Months paid</h2><div class="tm-muted">of your 5-month membership</div><div class="tm-ring-wrap"><svg class="tm-ring" viewBox="0 0 120 120" role="img" aria-label="${paid.length} of 5 months paid"><defs><linearGradient id="tm-gradient"><stop offset="0" stop-color="#5574c9"/><stop offset="1" stop-color="#36a47e"/></linearGradient></defs><circle class="tm-ring-track" cx="60" cy="60" r="52" fill="none" stroke-width="10"/><circle class="tm-ring-bar" cx="60" cy="60" r="52" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="${326.7 * (1 - Math.min(paid.length,5)/5)}"/></svg><div class="tm-ring-label"><b>${paid.length}/5</b><span class="tm-muted">months</span></div></div><div class="tm-chip-row"><span class="tm-chip">Paid <b>${paid.length}</b></span><span class="tm-chip">Planned <b>${planned.length}</b></span><span class="tm-chip">Failed <b>${failed.length}</b></span></div></section>
      <section class="tm-card"><h2>Your journey</h2><div class="tm-muted">Application to delivery · <b>${progress}%</b></div><ol class="tm-timeline">${timeline}</ol></section></div>
      <div class="tm-grid"><section class="tm-card"><h2>Monthly payouts</h2><p class="tm-muted">Recorded payout history</p>${paymentRows(payouts)}</section><section class="tm-card"><h2>Month by month</h2><p class="tm-muted">Your membership at a glance</p>${schedule}</section></div>
      <div class="tm-grid">${accountCard(details)}<section class="tm-card"><h2>Your details</h2><p class="tm-muted">Contact Telectro support to update your application information.</p><div class="tm-line"><span>Phone</span><b class="tm-amount">${esc(app.phone || phone || '—')}</b></div><div class="tm-line"><span>Login ID</span><b class="tm-amount">${esc(phone || '—')}</b></div><div class="tm-line"><span>Member since</span><b class="tm-amount">${esc(memberSince)}</b></div><div class="tm-line"><span>Application</span>${status(app.application_status)}</div><div class="tm-line"><span>Payment</span>${status(app.payment_status)}</div></section></div>
      ${referralCard(profile, credits)}
    </div>`;
  }

  async function loadAndRender(force = false) {
    const appRoot = $('app');
    const db = client();
    if (!appRoot || !db || busy || appRoot.classList.contains('hidden') || appRoot.querySelector('.tabs.admin') || !appRoot.querySelector('.hd')) return;
    if (appRoot.querySelector('.sk')) return;
    busy = true;
    try {
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) return;
      const [profileResult, applicationResult] = await Promise.all([
        db.from('profiles').select('full_name,role,referral_code').eq('id', user.id).maybeSingle(),
        db.from('applications').select('*').eq('user_id', user.id).maybeSingle()
      ]);
      if (profileResult.error || profileResult.data?.role === 'admin' || applicationResult.error || !applicationResult.data) return;
      const application = applicationResult.data;
      if (application.application_status === 'rejected') return;
      const [accountResult, payoutResult, referralResult] = await Promise.all([
        db.from('member_payment_details').select('account_name,bank_name,account_number').eq('user_id', user.id).maybeSingle(),
        db.from('member_payouts').select('payout_month,amount,status,paid_at,reference').eq('user_id', user.id).order('payout_month'),
        db.from('referral_credits').select('referred_user_id,reward_amount,status,created_at,earned_at').eq('referrer_id', user.id).order('created_at', { ascending:false })
      ]);
      const payouts = payoutResult.error ? [] : payoutResult.data || [];
      const credits = referralResult.error ? [] : referralResult.data || [];
      const key = [user.id, application.updated_at, accountResult.data?.updated_at, payouts.length, credits.length, credits.map(c=>c.status).join(',')].join('|');
      if (!force && renderedKey === key && appRoot.querySelector('[data-telectro-member-dashboard]')) return;
      const phone = user.phone || user.email || '';
      appRoot.classList.add('tm-member');
      appRoot.innerHTML = render(application, profileResult.data || {}, accountResult.error ? null : accountResult.data, payouts, credits, phone);
      renderedKey = key;
    } catch (error) {
      console.error('Could not render member dashboard', error);
    } finally {
      busy = false;
    }
  }

  function scheduleRender() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; loadAndRender(); }, 100);
  }

  async function saveAccount(form) {
    if (saveInProgress) return;
    const db = client();
    const button = form.querySelector('[type=submit]');
    const message = form.querySelector('[data-tm-account-message]');
    if (!db) { if (message) message.textContent = 'Authentication service is unavailable. Reload the page and retry.'; return; }
    saveInProgress = true;
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }
    try {
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw new Error('Your session expired. Sign in again and retry.');
      const values = new FormData(form);
      const details = {
        user_id: user.id,
        account_name: String(values.get('holder') || '').trim(),
        bank_name: String(values.get('bank') || '').trim(),
        account_number: String(values.get('account') || '').trim()
      };
      const { error } = await db.from('member_payment_details').upsert(details, { onConflict:'user_id' });
      if (error) throw error;
      toast('Payout account saved. The form is now hidden.');
      renderedKey = '';
      await loadAndRender(true);
    } catch (error) {
      if (message) { message.textContent = error.message || 'Could not save your account details.'; message.style.color = '#ad4b5a'; }
      if (button) { button.disabled = false; button.textContent = 'Save payout account'; }
    } finally {
      saveInProgress = false;
    }
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.matches('[data-tm-account-form]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAccount(form);
      return;
    }
    if (form.id === 'bf' || form.id === 'detailsForm') {
      event.preventDefault();
      event.stopImmediatePropagation();
      // For an older cached page, preserve the existing account save handler.
    }
  }, true);

  document.addEventListener('click', async event => {
    const view = event.target.closest('[data-tm-view-account]');
    if (view) {
      const privateDetails = view.parentElement.querySelector('[data-tm-account-private]');
      privateDetails.hidden = !privateDetails.hidden;
      view.textContent = privateDetails.hidden ? 'View account details' : 'Hide account details';
      return;
    }
    if (event.target.closest('[data-tm-refresh]')) { renderedKey = ''; await loadAndRender(true); return; }
    if (event.target.closest('[data-tm-copy]')) {
      const link = $('tmInviteUrl')?.textContent;
      if (!link) return;
      try { await navigator.clipboard.writeText(link); toast('Invite link copied'); }
      catch { toast('Copy unavailable. Select and copy the invite link.'); }
      return;
    }
    if (event.target.closest('[data-tm-share]')) {
      const url = $('tmInviteUrl')?.textContent;
      if (!url) return;
      if (navigator.share) { try { await navigator.share({ title:'Join Telectro', text:'Join me on Telectro using my invite link.', url }); } catch {} }
      else { try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { toast('Copy unavailable. Select and copy the invite link.'); } }
    }
  });

  function start() {
    installStyles();
    const appRoot = $('app');
    if (!appRoot) return;
    observer = new MutationObserver(scheduleRender);
    observer.observe(appRoot, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    scheduleRender();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
