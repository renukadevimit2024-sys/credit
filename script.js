/* PayFlow – simulated credit card processing (education only). No real payments. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};
const money = (n, c = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c }).format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Seed data ---------- */
const SEED_TX = [
  ['TXN1001', 'Purchase Payment', 4500, '2026-05-03', 'Visa', 'Successful'],
  ['TXN1002', 'Online Shopping', 2999, '2026-05-12', 'Mastercard', 'Successful'],
  ['TXN1003', 'Grocery Payment', 1840, '2026-06-02', 'RuPay', 'Successful'],
  ['TXN1004', 'Electricity Bill', 3200, '2026-06-15', 'Visa', 'Pending'],
  ['TXN1005', 'Restaurant Payment', 950, '2026-07-08', 'Mastercard', 'Failed'],
  ['TXN1006', 'Travel Booking', 18500, '2026-08-20', 'Visa', 'Successful'],
  ['TXN1007', 'Subscription Payment', 499, '2026-09-05', 'RuPay', 'Successful']
].map(([id, desc, amount, date, method, status]) => ({ id, desc, amount, cur: 'INR', date, method, status }));
const SEED_CARDS = [
  { id: 1, type: 'Visa', last4: '1234', exp: '08/29', def: true },
  { id: 2, type: 'Mastercard', last4: '5678', exp: '11/28', def: false },
  { id: 3, type: 'RuPay', last4: '9012', exp: '03/30', def: false }
];
const SEED_PROFILE = { name: 'Asha Raman', cid: 'CUST1001', email: 'asha@example.com', phone: '9876543210', type: 'Premium Credit' };

let txns = store.get('pf_tx', SEED_TX);
let cards = store.get('pf_cards', SEED_CARDS);
let profile = store.get('pf_profile', SEED_PROFILE);
let busy = false;

/* ---------- Popup ---------- */
function popup(title, html) {
  $('#mTitle').textContent = title; $('#mBody').innerHTML = html;
  $('#modal').hidden = false; $('#mClose').focus();
}
$('#mClose').onclick = () => $('#modal').hidden = true;
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });

/* ---------- Login (demo: hash compare only, not secure) ---------- */
function hash(s) { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h; }
const DEMO_HASH = hash('Demo@123'); // password is never stored as plain text
function showApp(on) { $('#login').hidden = on; $('#app').hidden = !on; if (on) renderAll(); }
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = $('#loginUser').value.trim().toLowerCase(), p = $('#loginPass').value;
  if (!u || !p) return popup('Missing details', '<p>Enter your Customer ID and password.</p>');
  if ((u === 'cust1001' || u === 'demo') && hash(p) === DEMO_HASH) {
    sessionStorage.setItem('pf_in', '1'); showApp(true);
  } else popup('Login failed', '<p>Customer ID or password is incorrect. Demo: CUST1001 / Demo@123.</p>');
};
$('#logoutBtn').onclick = () => { sessionStorage.removeItem('pf_in'); $('#loginPass').value = ''; showApp(false); };
$$('[data-forgot]').forEach(a => a.onclick = e => {
  e.preventDefault();
  const what = a.dataset.forgot;
  popup(`Forgot ${what}`, `<label>Registered email<input id="fpEmail" type="email"></label><p id="fpErr" class="err"></p><button class="btn" id="fpGo">Send reset (demo)</button>`);
  $('#fpGo').onclick = () => {
    const v = $('#fpEmail').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) return $('#fpErr').textContent = 'Enter a valid email address.';
    popup('Request recorded', `<p>Demo only: no email was sent. ${what === 'username' ? 'The demo username is CUST1001.' : 'The demo password is Demo@123.'}</p>`);
  };
});
$$('[data-info]').forEach(a => a.onclick = e => { e.preventDefault(); const [t, b] = a.dataset.info.split('|'); popup(t, `<p>${b}</p>`); });

/* ---------- Theme & nav ---------- */
function setTheme(t) { document.documentElement.dataset.theme = t; store.set('pf_theme', t); }
setTheme(store.get('pf_theme', 'light'));
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#menuBtn').onclick = () => $('#nav').classList.toggle('open');
$('#nav').onclick = () => $('#nav').classList.remove('open');

/* ---------- Dashboard ---------- */
function renderDashboard() {
  $('#dName').textContent = profile.name; $('#dId').textContent = profile.cid;
  const c = s => txns.filter(t => t.status === s).length;
  $('#sTotal').textContent = txns.length; $('#sOk').textContent = c('Successful');
  $('#sPend').textContent = c('Pending'); $('#sFail').textContent = c('Failed');
  $('#sSpent').textContent = money(txns.filter(t => t.status === 'Successful').reduce((a, t) => a + t.amount, 0));
  // Monthly spending (successful only, last 6 months with data)
  const by = {};
  txns.filter(t => t.status === 'Successful').forEach(t => by[t.date.slice(0, 7)] = (by[t.date.slice(0, 7)] || 0) + t.amount);
  const keys = Object.keys(by).sort().slice(-6), max = Math.max(1, ...keys.map(k => by[k]));
  $('#monthly').innerHTML = keys.length ? keys.map(k => `<div class="bar" style="height:${Math.max(4, by[k] / max * 100)}%"><em>${by[k]}</em><i>${k.slice(5)}/${k.slice(2, 4)}</i></div>`).join('') : '<p class="muted">No successful payments yet.</p>';
}

/* ---------- Transactions ---------- */
function filtered() {
  const q = $('#fSearch').value.trim().toLowerCase(), s = $('#fStatus').value, m = $('#fMethod').value, d = $('#fDate').value;
  return txns.filter(t => (!q || t.id.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) &&
    (!s || t.status === s) && (!m || t.method === m) && (!d || t.date === d));
}
function renderTx() {
  const list = filtered();
  $('#txBody').innerHTML = list.map(t => `<tr><td>${t.id}</td><td>${esc(t.desc)}</td><td>${t.date}</td><td>${t.method}</td><td>${money(t.amount, t.cur)}</td>
    <td><span class="badge ${t.status}">${t.status}</span></td><td><button class="btn ghost sm" data-view="${t.id}">View details</button></td></tr>`).join('');
  $('#txEmpty').hidden = list.length > 0;
  $('#txCards').innerHTML = txns.slice(-6).reverse().map(t => `<div class="card tx"><b>${esc(t.desc)}</b><span class="muted">${t.id} · ${t.date}</span>
    <span>${money(t.amount, t.cur)} · ${t.method}</span><span><span class="badge ${t.status}">${t.status}</span> <span class="muted small">simulated</span></span></div>`).join('');
}
['fSearch', 'fStatus', 'fMethod', 'fDate'].forEach(id => $('#' + id).addEventListener('input', renderTx));
$('#fReset').onclick = () => { ['fSearch', 'fStatus', 'fMethod', 'fDate'].forEach(id => $('#' + id).value = ''); renderTx(); };
document.addEventListener('click', e => {
  const id = e.target.dataset?.view; if (!id) return;
  const t = txns.find(x => x.id === id);
  popup('Transaction details', `<dl><dt>ID</dt><dd>${t.id}</dd><dt>Description</dt><dd>${esc(t.desc)}</dd><dt>Amount</dt><dd>${money(t.amount, t.cur)}</dd>
    <dt>Date</dt><dd>${t.date}</dd><dt>Method</dt><dd>${t.method}</dd><dt>Status</dt><dd><span class="badge ${t.status}">${t.status}</span></dd>${t.note ? `<dt>Note</dt><dd>${esc(t.note)}</dd>` : ''}</dl>
    <p class="muted small">Simulated transaction – no money was transferred.</p>`);
});

/* ---------- Saved cards ---------- */
function renderCards() {
  $('#cardList').innerHTML = cards.length ? cards.map(c => `<div class="bank"><span>${c.type}${c.def ? ' <span class="def">Default</span>' : ''}</span>
    <span class="num">•••• •••• •••• ${c.last4}</span><span>Expires ${c.exp}</span>
    <div class="acts">${c.def ? '' : `<button class="btn sm" data-def="${c.id}">Set default</button>`}<button class="btn sm" data-rm="${c.id}">Remove</button></div></div>`).join('')
    : '<p class="muted">No saved cards. Add a demo card below.</p>';
}
$('#cardList').onclick = e => {
  const d = e.target.dataset;
  if (d.def) cards.forEach(c => c.def = c.id == d.def);
  if (d.rm) { cards = cards.filter(c => c.id != d.rm); if (cards.length && !cards.some(c => c.def)) cards[0].def = true; }
  store.set('pf_cards', cards); renderCards();
};
$('#addCard').onsubmit = e => {
  e.preventDefault(); const f = e.target;
  if (!/^\d{4}$/.test(f.last4.value)) return popup('Invalid card', '<p>Enter exactly 4 digits.</p>');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp.value)) return popup('Invalid expiry', '<p>Use MM/YY, for example 08/29.</p>');
  cards.push({ id: Date.now(), type: f.type.value, last4: f.last4.value, exp: f.exp.value, def: !cards.length });
  store.set('pf_cards', cards); renderCards(); f.reset(); popup('Card added', '<p>Demo card added (masked).</p>');
};

/* ---------- Payment flow (mirrors the use-case diagram) ---------- */
const pf = $('#payForm');
const luhn = n => { let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt && (d *= 2) > 9) d -= 9; s += d; alt = !alt; } return s % 10 === 0; };
const yr = new Date().getFullYear();
pf.mm.innerHTML = '<option value="">MM</option>' + Array.from({ length: 12 }, (_, i) => `<option>${String(i + 1).padStart(2, '0')}</option>`).join('');
pf.yy.innerHTML = '<option value="">YYYY</option>' + Array.from({ length: 10 }, (_, i) => `<option>${yr + i}</option>`).join('');
pf.card.addEventListener('input', () => pf.card.value = pf.card.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim());
pf.cvv.addEventListener('input', () => pf.cvv.value = pf.cvv.value.replace(/\D/g, ''));
$('#method').onchange = e => { const m = e.target.value; if (m) pf.holder.placeholder = `${m} cardholder`; };
function resetForm() {
  pf.reset(); pf.date.value = new Date().toISOString().slice(0, 10); $('#payErr').textContent = '';
  $$('.invalid').forEach(x => x.classList.remove('invalid'));
  $$('#steps li').forEach(li => li.className = '');
  const d = cards.find(c => c.def); if (d) pf.method.value = d.type;
}
$('#clearBtn').onclick = resetForm;
function validate() {
  const f = pf, errs = [], bad = el => { el.classList.add('invalid'); };
  $$('.invalid', pf).forEach(x => x.classList.remove('invalid'));
  const req = (el, msg) => { if (!el.value.trim()) { errs.push(msg); bad(el); return false; } return true; };
  req(f.name, 'Customer name is required.'); req(f.cid, 'Customer ID is required.');
  if (req(f.email, 'Email is required.') && !/^\S+@\S+\.\S+$/.test(f.email.value)) { errs.push('Email is not valid.'); bad(f.email); }
  if (req(f.phone, 'Phone is required.') && !/^\d{10}$/.test(f.phone.value.replace(/\D/g, ''))) { errs.push('Phone must have 10 digits.'); bad(f.phone); }
  req(f.desc, 'Choose a payment description.'); req(f.method, 'Choose a payment method.'); req(f.holder, 'Cardholder name is required.');
  if (!(parseFloat(f.amount.value) > 0)) { errs.push('Enter an amount greater than 0.'); bad(f.amount); }
  return errs;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const step = (i, cls) => $$('#steps li')[i].className = cls;
function nextId() { return 'TXN' + (Math.max(1000, ...txns.map(t => +t.id.slice(3) || 0)) + 1); }

pf.onsubmit = async e => {
  e.preventDefault(); if (busy) return;
  const errs = validate(); $('#payErr').textContent = errs[0] || '';
  if (errs.length) return;
  busy = true; $('#payBtn').disabled = true; $('#payBtn').textContent = 'Processing…';
  $$('#steps li').forEach(li => li.className = '');
  const amount = parseFloat(pf.amount.value), digits = pf.card.value.replace(/\D/g, '');
  let status = 'Successful', note = '', stop = false;
  const run = async (i, fn) => { if (stop) return; step(i, 'now'); await sleep(450); const r = fn(); step(i, r === false ? 'fail' : 'done'); };

  // 1. Enter card details
  await run(0, () => digits.length >= 13 && !!pf.mm.value && !!pf.yy.value && pf.cvv.value.length >= 3 || (stop = true, status = 'Failed', note = 'Missing card details.', false));
  // 2. Validate card details (extend: invalid card message)
  await run(1, () => (luhn(digits) && digits.length >= 13) || (stop = true, status = 'Failed', note = 'Invalid card number.', popup('Invalid card', '<p>The card number failed validation. Try the fictional 4242 4242 4242 4242.</p>'), false));
  // 3. Enter payment amount
  await run(2, () => true);
  // 4. Authorize payment (extend: payment declined by gateway/bank)
  await run(3, () => !(digits.endsWith('0000') || amount > 50000) || (stop = true, status = 'Failed', note = 'Declined by simulated bank.', false));
  // 5. Process payment (extend: payment failed)
  await run(4, () => Math.random() > 0.1 || (stop = true, status = 'Failed', note = 'Processing error (simulated).', false));
  // 6. Verify transaction (extend: flag as suspicious)
  await run(5, () => amount <= 20000 || (status = 'Pending', note = 'Flagged as suspicious for review.', false));
  if (!stop) { step(6, 'now'); await sleep(450); step(6, 'done'); } // 7. Generate receipt

  const t = { id: nextId(), desc: pf.desc.value, amount, cur: pf.cur.value, date: pf.date.value || new Date().toISOString().slice(0, 10), method: pf.method.value, status, note }; // only the card type is kept, never the number or CVV
  txns.push(t); store.set('pf_tx', txns); renderAll();
  const msg = { Successful: 'Payment successful.', Pending: 'Payment pending review.', Failed: 'Payment failed.' }[status];
  if (!(stop && note === 'Invalid card number.')) popup(msg, `<dl><dt>Receipt</dt><dd>${t.id}</dd><dt>Amount</dt><dd>${money(amount, t.cur)}</dd><dt>Status</dt><dd><span class="badge ${status}">${status}</span></dd>${note ? `<dt>Note</dt><dd>${note}</dd>` : ''}</dl><p class="muted small">Simulated – no money was transferred.</p>`);
  pf.card.value = ''; pf.cvv.value = '';
  busy = false; $('#payBtn').disabled = false; $('#payBtn').textContent = 'Submit payment';
};

/* ---------- Profile ---------- */
const prf = $('#profForm');
function renderProfile() { Object.keys(profile).forEach(k => prf[k].value = profile[k]); }
$('#editBtn').onclick = () => { prf.name.disabled = prf.email.disabled = prf.phone.disabled = false; $('#saveBtn').disabled = false; prf.name.focus(); };
prf.onsubmit = e => {
  e.preventDefault();
  if (!prf.name.value.trim() || !/^\S+@\S+\.\S+$/.test(prf.email.value) || prf.phone.value.replace(/\D/g, '').length !== 10)
    return popup('Check your details', '<p>Name is required, email must be valid and phone needs 10 digits.</p>');
  Object.assign(profile, { name: prf.name.value.trim(), email: prf.email.value.trim(), phone: prf.phone.value.trim() });
  store.set('pf_profile', profile);
  ['name', 'email', 'phone'].forEach(k => prf[k].disabled = true); $('#saveBtn').disabled = true;
  renderDashboard(); popup('Profile saved', '<p>Your demo profile was updated.</p>');
};

/* ---------- Contact ---------- */
$('#contactForm').onsubmit = e => {
  e.preventDefault(); const f = e.target;
  const err = !f.name.value.trim() ? 'Name is required.' : !/^\S+@\S+\.\S+$/.test(f.email.value) ? 'Enter a valid email.' :
    !f.subject.value.trim() ? 'Subject is required.' : f.msg.value.trim().length < 10 ? 'Message needs at least 10 characters.' : '';
  $('#cErr').textContent = err; if (err) return;
  f.reset(); popup('Message received', '<p>Thanks! This is a demo, so nothing was sent anywhere.</p>');
};

/* ---------- Init ---------- */
function renderAll() { renderDashboard(); renderTx(); renderCards(); renderProfile(); }
resetForm();
Object.assign(pf, {}); pf.name.value = profile.name; pf.cid.value = profile.cid; pf.email.value = profile.email; pf.phone.value = profile.phone;
showApp(sessionStorage.getItem('pf_in') === '1');
