// Dashboard minimal (status + QR + conversații recente), fără build step. JS-ul e servit separat
// la /app.js ca CSP-ul să rămână `script-src 'self'` (fără inline scripts). Textul din DB e
// inserat DOAR prin textContent (fără innerHTML) → fără XSS din mesajele contactelor.

export const DASHBOARD_HTML = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WhatsApp AI</title>
<style>
  :root { --bg:#0f1115; --card:#181b22; --ink:#e7e9ee; --muted:#8b93a7; --acid:#25d366; --warn:#f5a524; --err:#f31260; --line:#262a35; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:960px; margin:0 auto; padding:16px; display:grid; gap:16px; }
  h1 { font-size:20px; margin:4px 0; }
  h2 { font-size:15px; margin:0 0 10px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .row { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .pill { padding:2px 10px; border-radius:999px; font-size:13px; border:1px solid var(--line); }
  .ok { color:var(--acid); } .warn { color:var(--warn); } .err { color:var(--err); }
  button { background:#232835; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:8px 14px; font:inherit; cursor:pointer; }
  button:hover { border-color:var(--muted); }
  button.primary { background:var(--acid); color:#06210f; border-color:var(--acid); font-weight:600; }
  input[type=number] { width:70px; background:#0f1115; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:6px; font:inherit; }
  #qr img { background:#fff; padding:8px; border-radius:8px; display:block; }
  .grid { display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1.4fr); gap:16px; }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  ul { list-style:none; margin:0; padding:0; }
  .conv { padding:10px; border-radius:8px; cursor:pointer; border:1px solid transparent; }
  .conv:hover, .conv.active { border-color:var(--line); background:#1d212a; }
  .conv .top { display:flex; justify-content:space-between; gap:8px; font-weight:600; }
  .conv .last { color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .msgs { display:flex; flex-direction:column; gap:6px; max-height:65vh; overflow-y:auto; }
  .msg { max-width:85%; padding:8px 10px; border-radius:10px; white-space:pre-wrap; word-wrap:break-word; }
  .msg.in { background:#232835; align-self:flex-start; }
  .msg.out { background:#14432a; align-self:flex-end; }
  .msg.ai { background:#1d3557; align-self:flex-end; }
  .meta { font-size:12px; color:var(--muted); margin-top:2px; }
  .muted { color:var(--muted); }
</style>
</head>
<body>
<main>
  <div class="row" style="justify-content:space-between">
    <h1>WhatsApp AI</h1>
    <span class="muted" id="model"></span>
  </div>

  <section class="card">
    <h2>Stare</h2>
    <div class="row">
      <span>WhatsApp: <b id="wa-status">…</b></span>
      <span class="muted" id="wa-phone"></span>
      <button id="btn-connect">Conectează (QR nou)</button>
      <button id="btn-disconnect">Deconectează</button>
    </div>
    <div id="qr" style="margin-top:12px"></div>
    <div class="row" style="margin-top:12px">
      <span>Agent AI: <b id="ai-status">…</b></span>
      <button id="btn-toggle" class="primary">…</button>
      <label class="row" style="gap:6px">Timer <input id="timer" type="number" min="1" max="60"> min</label>
      <button id="btn-timer">Salvează</button>
      <span class="muted" id="replies"></span>
    </div>
  </section>

  <div class="grid">
    <section class="card">
      <h2>Conversații recente</h2>
      <ul id="convs"><li class="muted">Se încarcă…</li></ul>
    </section>
    <section class="card">
      <h2 id="msgs-title">Mesaje</h2>
      <div class="msgs" id="msgs"><span class="muted">Alege o conversație.</span></div>
    </section>
  </div>
</main>
<script src="/app.js"></script>
</body>
</html>`

export const DASHBOARD_JS = `(() => {
  const $ = (id) => document.getElementById(id);
  let state = null;
  let activePhone = null;

  async function api(path, opts) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmt(ts) { return new Date(ts).toLocaleString('ro-RO'); }

  async function refreshStatus() {
    try {
      state = await api('/api/status');
    } catch (e) { $('wa-status').textContent = 'eroare API'; return; }
    const wa = state.whatsapp;
    const labels = { connected: ['conectat', 'ok'], pairing: ['așteaptă scanare QR', 'warn'], connecting: ['se conectează…', 'warn'], disconnected: ['deconectat', 'err'] };
    const [label, cls] = labels[wa.status] || [wa.status, ''];
    $('wa-status').textContent = label;
    $('wa-status').className = cls;
    $('wa-phone').textContent = wa.phoneNumber ? '+' + wa.phoneNumber : '';
    const qr = $('qr');
    qr.replaceChildren();
    if (wa.qrDataUrl) {
      const img = el('img'); img.src = wa.qrDataUrl; img.alt = 'QR WhatsApp'; img.width = 280; img.height = 280;
      qr.append(img, el('p', 'muted', 'WhatsApp → Dispozitive conectate → Conectează un dispozitiv.'));
    }
    const ai = state.ai;
    const paused = ai.pauseUntil ? ' (pauză până la ' + fmt(ai.pauseUntil) + ')' : '';
    $('ai-status').textContent = (ai.isActive ? 'activ' : 'inactiv') + paused;
    $('ai-status').className = ai.isActive && !ai.pauseUntil ? 'ok' : 'err';
    $('btn-toggle').textContent = ai.isActive ? 'Dezactivează' : 'Activează';
    if (document.activeElement !== $('timer')) $('timer').value = ai.timerMinutes;
    $('replies').textContent = ai.replies24h + ' răspunsuri AI în 24h';
    $('model').textContent = ai.model;
  }

  async function refreshConversations() {
    let data;
    try { data = await api('/api/conversations'); } catch { return; }
    const list = $('convs');
    list.replaceChildren();
    if (!data.conversations.length) { list.append(el('li', 'muted', 'Nicio conversație încă.')); return; }
    for (const c of data.conversations) {
      const li = el('li', 'conv' + (c.contactPhone === activePhone ? ' active' : ''));
      const top = el('div', 'top');
      top.append(el('span', '', '+' + c.contactPhone), el('span', 'muted', fmt(c.lastAt)));
      const prefix = c.isAi ? '🤖 ' : c.fromMe ? 'Tu: ' : '';
      li.append(top, el('div', 'last', prefix + c.lastMessage));
      li.addEventListener('click', () => { activePhone = c.contactPhone; refreshMessages(); refreshConversations(); });
      list.append(li);
    }
  }

  async function refreshMessages() {
    if (!activePhone) return;
    let data;
    try { data = await api('/api/conversations/' + encodeURIComponent(activePhone) + '/messages'); } catch { return; }
    $('msgs-title').textContent = 'Mesaje +' + activePhone;
    const box = $('msgs');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.replaceChildren();
    for (const m of data.messages) {
      const d = el('div', 'msg ' + (m.isAi ? 'ai' : m.fromMe ? 'out' : 'in'), m.body);
      d.append(el('div', 'meta', (m.isAi ? 'AI · ' : m.fromMe ? 'Tu · ' : '') + fmt(m.at)));
      box.append(d);
    }
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  $('btn-connect').addEventListener('click', async () => {
    if (!confirm('Pornește o asociere nouă (șterge sesiunea curentă)?')) return;
    await api('/api/whatsapp/connect', { method: 'POST' }).catch(() => alert('Eroare la conectare'));
    setTimeout(refreshStatus, 1500);
  });
  $('btn-disconnect').addEventListener('click', async () => {
    if (!confirm('Deconectezi WhatsApp?')) return;
    await api('/api/whatsapp/disconnect', { method: 'POST' }).catch(() => alert('Eroare'));
    refreshStatus();
  });
  $('btn-toggle').addEventListener('click', async () => {
    if (!state) return;
    await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ isActive: !state.ai.isActive }) }).catch(() => alert('Eroare'));
    refreshStatus();
  });
  $('btn-timer').addEventListener('click', async () => {
    const v = parseInt($('timer').value, 10);
    if (!(v >= 1 && v <= 60)) { alert('Timer între 1 și 60 minute'); return; }
    await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ timerMinutes: v }) }).catch(() => alert('Eroare'));
    refreshStatus();
  });

  refreshStatus(); refreshConversations();
  setInterval(refreshStatus, 4000);
  setInterval(() => { refreshConversations(); refreshMessages(); }, 8000);
})();`
