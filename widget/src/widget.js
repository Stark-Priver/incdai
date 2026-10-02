/*! incdai public widget v0.6.0 · Copyright 2026 INCPRITECH · PolyForm Perimeter 1.0.1
 * <script src="https://YOUR-SERVER/widget.js" data-api="https://YOUR-SERVER" data-site="your-site" async></script>
 * Optional: data-accent="#17B8A8" data-name="Amani" data-position="left" data-theme="light|dark|auto" data-open="true" data-voice="off"
 * JS API: window.incdai.open() · .close() · .ask("question") · .talk()   (voice uses /sdk.js, loaded on first use)
 */
(() => {
  "use strict";
  const script = document.currentScript || document.querySelector("script[data-site][src*='widget']");
  if (!script || window.__incdai) return;
  window.__incdai = true;

  const ds = script.dataset;
  const api = (ds.api || new URL(script.src).origin).replace(/\/$/, "");
  const site = ds.site;
  if (!site) return console.warn("[incdai] data-site is required");
  const store = {
    get: (k) => { try { return sessionStorage.getItem("incdai:" + site + ":" + k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem("incdai:" + site + ":" + k, v); } catch {} },
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const live = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[*-]\s+/gm, "• ").replace(/\n/g, "<br>");
  const rich = (s) => live(s.trim())
    .replace(/(https?:\/\/[^\s<)]+[^\s<).,])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(\+\d[\d ]{8,15}\d)/g, (m) => `<a href="https://wa.me/${m.replace(/\D/g, "")}" target="_blank" rel="noopener">${m}</a>`);

  const ICON = {
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    reset: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>',
    mic: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
    wa: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>',
  };

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .root { --accent: #17B8A8; --bg: #ffffff; --surface: #f4f5f7; --text: #1d222b; --muted: #636b78; --line: #e4e7ec; --deep: #0f1729; --on-deep: #fff;
    --shadow: 0 30px 80px -24px rgba(15, 23, 41, 0.45); position: fixed; bottom: 20px; z-index: 2147483000;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: var(--text);
    display: flex; flex-direction: column; gap: 12px; -webkit-font-smoothing: antialiased; }
  .root.right { right: 20px; align-items: flex-end; } .root.left { left: 20px; align-items: flex-start; }
  .root.dark { --bg: #12161f; --surface: #1b2130; --text: #e8ecf3; --muted: #9aa3b2; --line: #273044; --deep: #0a0e17; }
  .orb { position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
    background: conic-gradient(from 0deg, var(--accent), #6f8cff, #b07cff, var(--accent)); animation: spin 6s linear infinite; }
  .orb::after { content: ""; position: absolute; inset: 22%; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, rgba(255,255,255,.25) 45%, transparent 70%); animation: glow 3.2s ease-in-out infinite; }
  .orb.sm { width: 26px; height: 26px; margin-top: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } } @keyframes glow { 50% { transform: scale(1.15) translate(4%, -4%); opacity: .8; } }
  button { font: inherit; color: inherit; }
  .fab { position: relative; display: flex; align-items: center; gap: 12px; padding: 7px 20px 7px 7px; border: 0; border-radius: 999px; cursor: pointer;
    background: var(--deep); color: var(--on-deep); box-shadow: var(--shadow); animation: fabin .8s cubic-bezier(.22,1,.36,1) .6s both; transition: transform .4s cubic-bezier(.22,1,.36,1); }
  .fab:hover { transform: translateY(-3px); } .fab:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .fab::before { content: ""; position: absolute; left: 7px; top: 7px; width: 40px; height: 40px; border-radius: 50%; background: var(--accent); animation: pulse 2.6s ease-out 2s infinite; z-index: -1; }
  .fab .t { display: grid; text-align: left; line-height: 1.15; } .fab b { font-size: 15px; } .fab small { font-size: 11.5px; opacity: .75; }
  .open .fab { transform: scale(.6); opacity: 0; pointer-events: none; }
  @keyframes fabin { from { opacity: 0; transform: translateY(24px) scale(.85); } }
  @keyframes pulse { 0% { transform: scale(1); opacity: .5; } 70%, 100% { transform: scale(1.9); opacity: 0; } }
  .hello { position: relative; max-width: 260px; margin: 0; padding: 13px 34px 13px 15px; border-radius: 18px 18px 4px 18px; cursor: pointer; font-size: 14px;
    background: var(--bg); box-shadow: var(--shadow), 0 0 0 1px var(--line); opacity: 0; transform: translateY(8px) scale(.96); transition: opacity .35s, transform .5s cubic-bezier(.22,1,.36,1); }
  .left .hello { border-radius: 18px 18px 18px 4px; }
  .hello.show { opacity: 1; transform: none; } .hello b { color: var(--accent); }
  .hello .x { position: absolute; right: 8px; top: 6px; border: 0; background: none; font-size: 18px; line-height: 1; color: var(--muted); cursor: pointer; padding: 2px 4px; }
  .panel { position: absolute; bottom: 0; width: min(390px, calc(100vw - 32px)); height: min(600px, calc(100vh - 100px)); display: flex; flex-direction: column;
    border-radius: 24px; overflow: hidden; background: var(--bg); box-shadow: var(--shadow), 0 0 0 1px var(--line); animation: pin .5s cubic-bezier(.2,1.3,.4,1); }
  .right .panel { right: 0; transform-origin: bottom right; } .left .panel { left: 0; transform-origin: bottom left; }
  .panel.closing { animation: pout .26s ease-in forwards; }
  @keyframes pin { from { opacity: 0; transform: translateY(20px) scale(.88); } } @keyframes pout { to { opacity: 0; transform: translateY(16px) scale(.92); } }
  .head { display: flex; align-items: center; gap: 12px; padding: 14px 12px 14px 16px; background: var(--deep); color: var(--on-deep); }
  .head .id { flex: 1; min-width: 0; } .head .n { margin: 0; font-weight: 700; font-size: 16px; }
  .head .s { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: .78; }
  .head .s i { width: 7px; height: 7px; border-radius: 50%; background: #3ddc84; }
  .ib { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,.1); color: #fff; }
  .ib:hover { background: var(--accent); }
  .log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; scrollbar-width: thin; }
  .m { display: flex; gap: 8px; max-width: 90%; animation: min .4s cubic-bezier(.22,1,.36,1) both; }
  .m.u { align-self: flex-end; } .m p { margin: 0; padding: 10px 14px; border-radius: 18px; font-size: 14.5px; line-height: 1.58; overflow-wrap: anywhere; }
  .m.b p { background: var(--surface); border-top-left-radius: 5px; } .m.u p { background: var(--accent); color: #fff; border-top-right-radius: 5px; }
  .m a { color: inherit; font-weight: 600; } .m.b a { color: var(--accent); }
  @keyframes min { from { opacity: 0; transform: translateY(8px); } }
  .dots { display: inline-flex; gap: 5px; padding: 5px 2px; } .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); opacity: .35; animation: dot 1.2s infinite ease-in-out; }
  .dots i:nth-child(2) { animation-delay: .16s; } .dots i:nth-child(3) { animation-delay: .32s; }
  @keyframes dot { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }
  .caret { display: inline-block; width: 2px; height: 1.05em; margin-left: 2px; vertical-align: -.15em; background: var(--accent); animation: blink .9s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .sugs { display: flex; flex-wrap: wrap; gap: 8px; padding-left: 34px; }
  .sugs button { font-size: 13.5px; padding: 7px 12px; border-radius: 999px; cursor: pointer; background: var(--bg); border: 1.5px solid var(--line); }
  .sugs button:hover { border-color: var(--accent); color: var(--accent); }
  .card { margin-left: 34px; padding: 12px; border-radius: 16px; background: var(--surface); display: grid; gap: 8px; font-size: 13.5px; }
  .card input { width: 100%; font: inherit; font-size: 14px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--text); }
  .card .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border-radius: 999px; border: 0; cursor: pointer; font-size: 13px; font-weight: 600; text-decoration: none; }
  .btn.a { background: var(--accent); color: #fff; } .btn.wa { color: #128c4b; background: rgba(37,211,102,.14); } .root.dark .btn.wa { color: #4ee38a; }
  .form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); }
  .form input { flex: 1; min-width: 0; font: inherit; font-size: 15px; padding: 11px 14px; border-radius: 14px; border: 0; outline: none; color: var(--text); background: var(--surface); }
  .form input:focus { box-shadow: 0 0 0 2px var(--accent); }
  .form button { display: grid; place-items: center; width: 46px; border: 0; border-radius: 14px; cursor: pointer; background: var(--accent); color: #fff; }
  .form button:disabled { opacity: .5; }
  .form .mic { background: var(--surface); color: var(--accent); } .form .mic:hover { background: var(--accent); color: #fff; }
  .vbar { display: flex; align-items: center; gap: 14px; padding: 12px 12px 12px 20px; border-top: 1px solid var(--line); }
  .vorb { --lvl: 0; position: relative; flex: none; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; }
  .vorb:focus-visible { outline: 3px solid var(--accent); outline-offset: 6px; }
  .vorb .orb { display: block; width: 52px; height: 52px; transform: scale(calc(.84 + var(--lvl) * .32)); transition: transform .09s linear; }
  .vorb::before { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid var(--accent);
    opacity: calc(.18 + var(--lvl) * .82); transform: scale(calc(1 + var(--lvl) * .2)); transition: transform .09s linear, opacity .09s linear; }
  .vbar[data-state=transcribing] .orb, .vbar[data-state=thinking] .orb { animation-duration: 1.1s; }
  .vbar[data-state=speaking] .vorb::before { animation: pulse 1.5s ease-out infinite; }
  .vt { flex: 1; min-width: 0; display: grid; line-height: 1.3; } .vt b { font-size: 15px; } .vt small { font-size: 12.5px; color: var(--muted); }
  .vend { flex: none; border: 0; border-radius: 999px; padding: 9px 16px; cursor: pointer; font-size: 13.5px; font-weight: 600; background: var(--surface); }
  .vend:hover { background: #d93f45; color: #fff; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px 10px; font-size: 11.5px; color: var(--muted); }
  .foot a { color: var(--muted); text-decoration: none; } .foot a:hover { color: var(--accent); }
  [hidden] { display: none !important; }
  @media (max-width: 560px) {
    .root.right, .root.left { right: 12px; left: auto; bottom: 12px; } .root.left { left: 12px; right: auto; }
    .fab .t { display: none; } .fab { padding: 7px; }
    .panel { position: fixed; left: 8px; right: 8px; bottom: 8px; width: auto; height: min(80vh, 640px); }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`;

  async function boot() {
    let cfg = { name: "incdai", business: "", greeting: "Hi! Ask me anything.", accent: "#17B8A8", position: "right", suggestions: [], whatsapp: "" };
    try {
      const r = await fetch(`${api}/v1/sites/${encodeURIComponent(site)}/config`);
      if (r.ok) cfg = { ...cfg, ...(await r.json()) };
      else return console.warn("[incdai] site not available:", r.status);
    } catch (e) { return console.warn("[incdai] cannot reach", api); }
    if (ds.accent) cfg.accent = ds.accent;
    if (ds.name) cfg.name = ds.name;
    if (ds.position) cfg.position = ds.position;
    const canTalk = cfg.voice !== false && ds.voice !== "off" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && "AudioWorkletNode" in window && "WebSocket" in window;

    const host = document.createElement("div");
    host.setAttribute("data-lenis-prevent", "");
    document.body.appendChild(host);
    const sh = host.attachShadow({ mode: "open" });
    const theme = ds.theme || "auto";
    const dark = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    sh.innerHTML = `<style>${CSS}</style>
      <div class="root ${cfg.position === "left" ? "left" : "right"} ${dark ? "dark" : ""}" style="--accent:${esc(cfg.accent)}">
        <p class="hello" hidden><button class="x" aria-label="Dismiss">×</button>Hi, I'm <b>${esc(cfg.name)}</b> 👋<br>${esc(cfg.greeting)}</p>
        <button class="fab" aria-expanded="false" aria-label="Chat with ${esc(cfg.name)}">
          <span class="orb"></span><span class="t"><b>${esc(cfg.name)}</b><small>Ask me anything</small></span></button>
        <section class="panel" role="dialog" aria-label="${esc(cfg.name)} assistant" hidden>
          <header class="head"><span class="orb"></span><div class="id"><p class="n">${esc(cfg.name)}</p>
            <p class="s"><i></i>${esc(cfg.business ? cfg.business + " · AI assistant" : "AI assistant")}</p></div>
            <button class="ib reset" aria-label="New conversation" title="New conversation">${ICON.reset}</button>
            <button class="ib close" aria-label="Close">${ICON.close}</button></header>
          <div class="log" aria-live="polite"></div>
          <form class="form"><input maxlength="500" autocomplete="off" placeholder="Type your question…" aria-label="Your question" required>
            ${canTalk ? `<button type="button" class="mic" aria-label="Talk to ${esc(cfg.name)}" title="Talk instead of typing">${ICON.mic}</button>` : ""}
            <button type="submit" aria-label="Send">${ICON.send}</button></form>
          <div class="vbar" hidden><button type="button" class="vorb" aria-label="Done speaking"><span class="orb"></span></button>
            <div class="vt" aria-live="polite"><b class="vs"></b><small class="vh"></small></div>
            <button type="button" class="vend">End</button></div>
          <div class="foot"><span>AI can make mistakes.</span>
            ${cfg.whatsapp ? `<a class="btn wa" href="${esc(cfg.whatsapp)}" target="_blank" rel="noopener">${ICON.wa} Talk to a person</a>` : ""}
            <a href="https://incdai.incpritech.com/?ref=widget" target="_blank" rel="noopener">Powered by incdai</a></div>
        </section></div>`;

    const $ = (s) => sh.querySelector(s);
    const root = $(".root"), fab = $(".fab"), panel = $(".panel"), log = $(".log"), form = $(".form"), input = $(".form input"), send = $(".form button"), hello = $(".hello");
    let history = [], busy = false, stick = true;

    const scroll = (force) => { if (force) stick = true; if (stick) log.scrollTop = log.scrollHeight; };
    log.addEventListener("scroll", () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 60; }, { passive: true });

    function bubble(role, html) {
      const d = document.createElement("div");
      d.className = "m " + (role === "user" ? "u" : "b");
      d.innerHTML = (role === "user" ? "" : '<span class="orb sm"></span>') + `<p>${html}</p>`;
      log.appendChild(d); scroll(true);
      return d.querySelector("p");
    }
    function welcome() {
      history = []; log.innerHTML = "";
      bubble("bot", live(`Hi, I'm **${cfg.name}** 👋 ${cfg.greeting}`));
      if (cfg.suggestions.length) {
        const s = document.createElement("div"); s.className = "sugs";
        cfg.suggestions.forEach((q) => { const b = document.createElement("button"); b.type = "button"; b.textContent = q; b.onclick = () => ask(q); s.appendChild(b); });
        log.appendChild(s);
      }
    }
    welcome();

    function open() {
      hello.hidden = true; store.set("hello", "1");
      panel.hidden = false; panel.classList.remove("closing"); root.classList.add("open");
      fab.setAttribute("aria-expanded", "true"); setTimeout(() => input.focus(), reduce ? 0 : 200);
    }
    function close() {
      if (panel.hidden) return;
      stopVoice();
      fab.setAttribute("aria-expanded", "false");
      if (reduce) { panel.hidden = true; root.classList.remove("open"); return; }
      panel.classList.add("closing");
      panel.addEventListener("animationend", () => { panel.hidden = true; panel.classList.remove("closing"); root.classList.remove("open"); }, { once: true });
    }
    fab.onclick = () => (panel.hidden ? open() : close());
    $(".close").onclick = () => { close(); fab.focus(); };
    $(".reset").onclick = () => { if (!busy) { stopVoice(); welcome(); input.focus(); } };
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); fab.focus(); } });
    document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !e.composedPath().includes(host)) close(); });
    hello.onclick = (e) => { if (e.target.closest(".x")) { hello.classList.remove("show"); store.set("hello", "1"); return; } open(); };
    if (!store.get("hello") && ds.open !== "true") setTimeout(() => {
      if (!panel.hidden) return;
      hello.hidden = false; requestAnimationFrame(() => hello.classList.add("show"));
      setTimeout(() => hello.classList.remove("show"), 9000);
    }, 4000);
    if (ds.open === "true") open();

    function typewriter(p) {
      let target = "", shown = 0, done = false, resolve;
      const finished = new Promise((r) => (resolve = r));
      const tick = () => {
        const backlog = target.length - shown;
        if (backlog > 0) { shown += reduce ? backlog : Math.max(1, Math.ceil(backlog / 18)); p.innerHTML = live(target.slice(0, shown)) + '<span class="caret"></span>'; scroll(); }
        if (done && shown >= target.length) { p.innerHTML = rich(target); resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return { push: (t) => (target += t), end: () => (done = true), text: () => target, finished };
    }

    function leadCard(handoff) {
      const c = document.createElement("div"); c.className = "card";
      c.innerHTML = `<span>Want a person to follow up? Leave your details:</span>
        <input name="name" placeholder="Your name" autocomplete="name"><input name="contact" placeholder="Phone, WhatsApp or email" autocomplete="tel">
        <div class="row"><button class="btn a" type="button">Send</button>${handoff ? `<a class="btn wa" href="${esc(handoff)}" target="_blank" rel="noopener">${ICON.wa} WhatsApp us</a>` : ""}</div>`;
      c.querySelector(".btn.a").onclick = async () => {
        const name = c.querySelector("[name=name]").value.trim(), contact = c.querySelector("[name=contact]").value.trim();
        if (!name || contact.length < 3) return;
        try {
          const r = await fetch(`${api}/v1/sites/${encodeURIComponent(site)}/leads`, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, contact, message: history.slice(-2).map((m) => m.content).join(" | ") }) });
          c.innerHTML = r.ok ? "<span>Thank you! We'll get back to you soon. ✅</span>" : "<span>Sorry, that didn't send. Please try WhatsApp.</span>";
        } catch { c.innerHTML = "<span>Sorry, that didn't send. Please try WhatsApp.</span>"; }
      };
      log.appendChild(c); scroll(true);
    }

    async function ask(q, opts = {}) {
      q = String(q || "").trim();
      if (!q || busy) return;
      if (panel.hidden) open();
      busy = true; send.disabled = true;
      log.querySelector(".sugs")?.remove();
      bubble("user", esc(q)); input.value = "";
      const p = bubble("bot", '<span class="dots"><i></i><i></i><i></i></span>');
      let tw = null, done = null;
      const tw0 = () => (tw ||= typewriter(p));
      const emit = (text) => { tw0().push(text); opts.onToken?.(text); };
      try {
        const r = await fetch(`${api}/v1/sites/${encodeURIComponent(site)}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history, ...(opts.voice ? { mode: "voice", language: opts.language } : {}) }) });
        if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); emit(j.error || "Sorry, I can't answer right now."); }
        else {
          const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
          let buf = "";
          for (;;) {
            const { value, done: end } = await reader.read();
            if (end) break;
            buf += value;
            const lines = buf.split("\n"); buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              try { const ev = JSON.parse(line.slice(5)); if (ev.type === "token") emit(ev.text); else if (ev.type === "done") done = ev; } catch {}
            }
          }
        }
      } catch { emit("I couldn't connect just now. Please try again."); }
      if (!tw0().text().trim()) emit("Sorry, I couldn't answer that.");
      const t = tw0(); t.end(); await t.finished;
      history.push({ role: "user", content: q }, { role: "assistant", content: t.text() }); history = history.slice(-8);
      if (done && done.answered === false) leadCard(done.handoff);
      busy = false; send.disabled = false; if (!voice.on) input.focus();
    }
    form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

    // ── voice: a live, hands-free conversation ───────────────────────────
    // Tap the mic: the incdai SDK (loaded on first use) streams the microphone to the server, which notices when the
    // visitor stops talking, transcribes, answers, and speaks back. Talking over incdai interrupts it.
    const vbar = $(".vbar"), vorb = $(".vorb"), vs = $(".vs"), vh = $(".vh");
    const voice = { on: false, live: null, lang: "", tw: null, p: null };
    const say2 = (en, sw) => (voice.lang === "sw" ? sw : en);
    function setState(st) {
      vbar.dataset.state = st;
      const text = {
        connecting: [say2("Connecting…", "Inaunganisha…"), ""],
        listening: [say2("Listening…", "Nakusikiliza…"), say2("Speak naturally. I'll answer out loud.", "Ongea kawaida. Nitakujibu kwa sauti.")],
        hearing: [say2("Listening…", "Nakusikiliza…"), say2("Pause when you're done.", "Nyamaza kidogo ukimaliza.")],
        thinking: [say2("Thinking…", "Nafikiri…"), ""],
        speaking: [say2("Speaking…", "Ninajibu…"), say2("Talk or tap the orb to interrupt.", "Ongea au gusa duara kunikatiza.")],
      }[st] || ["", ""];
      vs.textContent = text[0]; vh.textContent = text[1];
      if (st !== "listening" && st !== "hearing") vorb.style.setProperty("--lvl", 0);
    }
    const finishReply = () => { if (voice.tw) { voice.tw.end(); voice.tw = null; } };

    async function startVoice() {
      if (voice.on || busy) return;
      if (panel.hidden) open();
      voice.on = true;
      log.querySelector(".sugs")?.remove();
      form.hidden = true; vbar.hidden = false; vorb.focus(); setState("connecting");
      try {
        const { Incdai } = await import(`${api}/sdk.js`);
        const client = new Incdai({ api, site });
        client.history = history;
        const live = (voice.live = client.live({ speak: "server" }));
        live.on("state", (e) => voice.on && setState(e.state));
        live.on("level", (e) => vorb.style.setProperty("--lvl", e.level.toFixed(3)));
        live.on("transcript", (e) => {
          if (!e.text || e.ignored) return;
          finishReply();
          voice.lang = e.language === "sw" ? "sw" : "en";
          bubble("user", esc(e.text));
          voice.p = bubble("bot", '<span class="dots"><i></i><i></i><i></i></span>');
          voice.q = e.text;
        });
        live.on("token", (e) => { if (voice.p) (voice.tw ||= typewriter(voice.p)).push(e.text); });
        live.on("interrupted", finishReply);
        live.on("done", (e) => {
          finishReply();
          history.push({ role: "user", content: voice.q || "" }, { role: "assistant", content: e.text || "" }); history = history.slice(-8);
          if (e.answered === false) leadCard(e.handoff);
        });
        live.on("error", (e) => bubble("bot", esc(e.message || "Voice isn't available right now. Please type your question.")));
        live.on("close", () => stopVoice());
        await live.start();
      } catch (e) {
        bubble("bot", live(e && e.name === "NotAllowedError"
          ? "I can't hear you because the microphone is blocked. Allow the microphone for this website, or type your question."
          : "Voice isn't available right now. Please type your question."));
        stopVoice();
      }
    }

    function stopVoice() {
      if (!voice.on) return;
      voice.on = false;
      finishReply();
      const l = voice.live; voice.live = null;
      try { l?.close(); } catch {}
      vbar.hidden = true; form.hidden = false; setState("");
    }

    vorb.onclick = () => {
      const st = vbar.dataset.state;
      if (st === "speaking") voice.live?.interrupt();   // stop talking and listen
      else if (st === "hearing") voice.live?.endTurn(); // "I'm done", answer now
    };
    $(".vend").onclick = () => { stopVoice(); input.focus(); };
    if (canTalk) $(".mic").onclick = startVoice;
    window.incdai = { open, close, ask, talk: () => canTalk && startVoice() };
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
