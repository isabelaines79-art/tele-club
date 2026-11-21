'use strict';
// Add direct links to the membership-payment views inside the existing portals.
window.addEventListener('load', () => {
  const addLink = (container, id, label, href) => {
    if (!container || document.getElementById(id)) return;
    const link = document.createElement('a');
    link.id = id;
    link.href = href;
    link.textContent = label;
    link.className = 'btn btn-quiet';
    link.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;margin:10px 8px 10px 0;padding:9px 13px;border:1px solid #dfe5ee;border-radius:8px;text-decoration:none;font:600 13px system-ui;color:#245fce;background:#fff';
    container.appendChild(link);
  };
  const memberPortal = document.getElementById('memberPortal');
  if (memberPortal) {
    const target = memberPortal.querySelector('.portal-head') || memberPortal;
    addLink(target, 'memberPaymentsShortcut', 'Membership payments', '/member-membership.html');
  }
  const adminHeader = document.querySelector('#dashboard .hero');
  if (adminHeader) addLink(adminHeader, 'adminMembershipShortcut', 'Approvals & monthly payments', '/admin-memberships.html');
  const observer = new MutationObserver(() => {
    if (memberPortal && memberPortal.classList.contains('open')) {
      addLink(memberPortal.querySelector('.portal-head') || memberPortal, 'memberPaymentsShortcut', 'Membership payments', '/member-membership.html');
    }
    const dashboard = document.querySelector('#dashboard .hero');
    if (dashboard && !document.getElementById('adminMembershipShortcut')) addLink(dashboard, 'adminMembershipShortcut', 'Approvals & monthly payments', '/admin-memberships.html');
  });
  observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
});
