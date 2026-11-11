/* Page effects for the team, quiz master and live pages. Load after the other scripts.
   - Dark neon lens: a glowing glass pill that slides between items like the "2 · Dark neon lens" menu.
     It rests on the active item, glides to whatever you hover, focus or tap (stretching and leaving a
     soft smear while it moves, squashing when pressed) and settles on the item with a springy wobble.
     Menus, segmented switches, toolbars and dialog buttons each get their own lens; every other
     button, link, select and input shares one free lens that glides from control to control.
   - Sparkles drift over the team in 1st place on the scoreboard (2nd and 3rd glow through CSS).
   Colours: change --nl-a / --nl-b below to recolour the lens (e.g. teal: 62, 224, 176 / 31, 157, 138). */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const GROUPS = ".menu, .seg, .lctl, .quick, .form-actions, .row";   // containers that own a lens
  const REST = ".on, [aria-current='page']";                          // the active item the lens rests on
  const LEAD = ".bar.r1, .brows li.r1, .teamtable tr.r1";             // 1st place: sparkles
  const SPARK = [[255, 255, 255], [176, 214, 240], [196, 181, 245], [196, 181, 245], [255, 179, 138], [255, 179, 138]];
  const MAXS = 160, MAXAREA = 90000;

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
  :root { --nl-a: 176, 214, 240; --nl-b: 196, 181, 245; }
  .nl-lens, .nl-tail { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 2147483000; opacity: 0; transition: opacity .28s ease; will-change: transform, width, height; }
  .nl-tail { filter: blur(9px); background: radial-gradient(closest-side, rgba(var(--nl-a), .55), rgba(var(--nl-b), .18) 70%, transparent); }
  .nl-lens {
    background: radial-gradient(130% 150% at 28% 8%, rgba(255,255,255,.34), rgba(var(--nl-a), .15) 46%, rgba(var(--nl-b), .13) 100%);
    border: 1px solid rgba(225, 238, 255, .55);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.65),
      inset 0 -6px 12px rgba(var(--nl-a), .22),
      inset 0 0 14px rgba(var(--nl-a), .35),
      0 0 16px rgba(var(--nl-a), .42),
      0 0 34px rgba(var(--nl-b), .24);
    -webkit-backdrop-filter: brightness(1.22) saturate(1.5);
    backdrop-filter: brightness(1.22) saturate(1.5);
    transition: opacity .28s ease, box-shadow .18s ease;
  }
  .nl-lens::after { content: ""; position: absolute; inset: 2px; border-radius: inherit; border: 1px solid rgba(255,255,255,.16); border-bottom-color: rgba(255,255,255,.4); }
  .nl-lens.show, .nl-tail.show { opacity: 1; }
  .nl-lens.press {
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.8),
      inset 0 -6px 14px rgba(var(--nl-a), .4),
      inset 0 0 20px rgba(var(--nl-a), .6),
      0 0 24px rgba(var(--nl-a), .7),
      0 0 48px rgba(var(--nl-b), .4);
  }`;
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mkDiv = (cls) => { const d = document.createElement("div"); d.className = cls; d.setAttribute("aria-hidden", "true"); return d; };
  const sp = (c) => ({ c, v: 0 });
  function step(s, target, k, damp, dt) { s.v += (target - s.c) * k * dt; s.v *= Math.exp(-damp * dt); s.c += s.v * dt; }
  function pick(n) {
    if (!n || !n.closest) return null;
    let el = n.closest("button, a, select");
    if (!el) { el = n.closest("input, textarea"); if (el) el = el.closest(".pill, .search") || el; }
    if (!el) el = n.closest(".pill, .search");
    if (!el || el.disabled || el.type === "hidden") return null;
    return el;
  }
  const radiusOf = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;

  /* ---------- neon lenses ---------- */
  let hover = null, focus = null, press = null, pressT = 0, touchT = 0, lx = 0, ly = 0;
  const lenses = new Map();           // group element (or null for the free lens) -> lens state
  let running = false, last = 0;

  function makeLens(g) {
    const L = { g, tail: mkDiv("nl-tail"), lens: mkDiv("nl-lens"), shown: false, host: null, el: null,
      x: sp(0), y: sp(0), w: sp(0), h: sp(0), r: 12,
      tx: sp(0), ty: sp(0), tw: sp(0), th: sp(0) };
    lenses.set(g, L);
    return L;
  }
  function dropLens(L) { L.tail.remove(); L.lens.remove(); lenses.delete(L.g); }
  const owns = (L, el) => el && (L.g ? L.g.contains(el) : !el.closest(GROUPS));
  function targetOf(L) {
    const cand = [press, hover, focus].find((e) => e && e.isConnected && owns(L, e));
    if (cand) return cand;
    return L.g && L.g.isConnected ? L.g.querySelector(REST) : null;
  }

  function updateLens(L, dt) {
    const el = targetOf(L);
    let rect = null;
    if (el) {
      const b = el.getBoundingClientRect();
      if (b.width && b.height && b.width * b.height <= MAXAREA && b.bottom > -50 && b.top < window.innerHeight + 50) {
        const inset = press === el ? 3 : 0;
        rect = { x: b.left + inset, y: b.top + inset * 0.7, w: b.width - inset * 2, h: b.height - inset * 1.4 };
      }
    }
    const on = !!rect;
    if (on) {
      const host = el.closest("dialog") || document.body;
      if (L.host !== host) { L.host = host; host.appendChild(L.tail); host.appendChild(L.lens); }
      if (el !== L.el) { L.el = el; L.r = radiusOf(el); }
      if (!L.shown) { // appear: snap onto the item a little smaller, then spring open
        const f = 0.74;
        L.x.c = rect.x + rect.w * (1 - f) / 2; L.y.c = rect.y + rect.h * (1 - f) / 2; L.w.c = rect.w * f; L.h.c = rect.h * f;
        L.tx.c = L.x.c; L.ty.c = L.y.c; L.tw.c = L.w.c; L.th.c = L.h.c;
        L.x.v = L.y.v = L.w.v = L.h.v = L.tx.v = L.ty.v = L.tw.v = L.th.v = 0;
      }
      L.shown = true;
      step(L.x, rect.x, 430, 23, dt); step(L.y, rect.y, 430, 23, dt); step(L.w, rect.w, 380, 21, dt); step(L.h, rect.h, 380, 21, dt);
      step(L.tx, rect.x, 150, 15, dt); step(L.ty, rect.y, 150, 15, dt); step(L.tw, rect.w, 150, 15, dt); step(L.th, rect.h, 150, 15, dt);
    } else L.shown = false;

    L.lens.classList.toggle("show", on);
    L.tail.classList.toggle("show", on);
    L.lens.classList.toggle("press", on && press === el);
    if (!L.host) return false;

    /* liquid stretch: faster movement makes the lens longer and a little flatter */
    const sx = Math.abs(L.x.v), sy = Math.abs(L.y.v), speed = Math.hypot(sx, sy);
    const stretchX = Math.min(sx * 0.05, 46), stretchY = Math.min(sy * 0.05, 22);
    const w = Math.max(8, L.w.c + stretchX), h = Math.max(8, (L.h.c + stretchY) * (1 - Math.min(stretchX / 46, 1) * 0.12));
    const x = L.x.c - stretchX / 2, y = L.y.c - (h - L.h.c) / 2;
    const s = L.lens.style;
    s.width = w + "px"; s.height = h + "px"; s.borderRadius = Math.min(L.r + 2, h / 2) + "px";
    s.transform = `translate(${x}px, ${y}px)`;

    const tw = Math.max(8, L.tw.c + stretchX * 1.6), th = Math.max(8, L.th.c * 0.92);
    const ts = L.tail.style;
    ts.width = tw + "px"; ts.height = th + "px"; ts.borderRadius = Math.min(L.r + 4, th / 2) + "px";
    ts.transform = `translate(${L.tx.c - stretchX * 0.8}px, ${L.ty.c + (L.th.c - th) / 2}px)`;
    ts.opacity = on ? Math.min(0.85, speed / 900) : 0;

    return on;
  }

  function syncGroups() {
    document.querySelectorAll(GROUPS).forEach((g) => { if (!lenses.has(g)) makeLens(g); });
    [...lenses.values()].forEach((L) => { if (L.g && !L.g.isConnected) dropLens(L); });
    if (!lenses.has(null)) makeLens(null);
  }

  /* ---------- sparkles for the leader ---------- */
  const cv = document.createElement("canvas");
  cv.className = "sparkle";
  cv.setAttribute("aria-hidden", "true");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, sparks = [], leadAcc = 0;
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawnSparks(r, n) {
    for (let i = 0; i < n && sparks.length < MAXS; i++) {
      const px = r.x + Math.random() * r.w, py = r.y + Math.random() * r.h, glint = Math.random() < 0.28;
      sparks.push({
        x: px, y: py, vx: rnd(-8, 8), vy: glint ? rnd(-10, -2) : -rnd(10, 42),
        age: 0, max: glint ? rnd(0.5, 1.1) : rnd(0.7, 1.5), size: glint ? rnd(4, 8) : rnd(0.9, 2.4), glint,
        col: SPARK[(Math.random() * SPARK.length) | 0], ph: rnd(0, 6.28), fr: rnd(10, 22),
      });
    }
  }
  function star(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }

  function frame(t) {
    const modal = document.querySelector("dialog[open]");
    const host = modal || document.body;
    if (cv.parentNode !== host) host.appendChild(cv);
    const dt = Math.min(0.033, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);

    let busy = false;
    lenses.forEach((L) => { if (updateLens(L, dt)) busy = true; });   // a resting lens keeps tracking its item

    const leads = modal ? [] : [...document.querySelectorAll(LEAD)];
    leads.forEach((lead) => {
      const b = lead.getBoundingClientRect();
      if (b.bottom > 0 && b.top < H) {
        leadAcc += dt * 55 / leads.length;
        const n = Math.floor(leadAcc); leadAcc -= n;
        spawnSparks({ x: b.left, y: b.top, w: b.width, h: b.height }, n);
      }
    });
    ctx.globalCompositeOperation = "lighter";
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.max) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
      const life = p.age / p.max, a = Math.max(0, Math.sin(Math.PI * life) * (0.55 + 0.45 * Math.sin((t / 1000) * p.fr + p.ph)));
      const [r, g, b] = p.col;
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      if (p.glint) {
        star(p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(Math.PI * life)));
        ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.18})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.6, 0, 6.283); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); }
    }
    ctx.globalCompositeOperation = "source-over";

    if (busy || sparks.length || leads.length) requestAnimationFrame(frame);
    else running = false;
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }

  /* ---------- input ---------- */
  document.addEventListener("pointerover", (e) => { hover = pick(e.target); start(); });
  document.addEventListener("pointermove", (e) => { lx = e.clientX; ly = e.clientY; });
  document.documentElement.addEventListener("mouseleave", () => { hover = null; start(); });
  document.addEventListener("pointerdown", (e) => {
    const el = pick(e.target);
    if (el) { clearTimeout(pressT); press = el; hover = el; start(); }
  });
  const release = (e) => {
    clearTimeout(pressT);
    pressT = setTimeout(() => { press = null; start(); }, 140);   // keep the squash visible for a moment
    if (e.pointerType === "touch") { clearTimeout(touchT); touchT = setTimeout(() => { hover = null; start(); }, 700); }
  };
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("button, a")) {
      press = e.target; clearTimeout(pressT); pressT = setTimeout(() => { press = null; start(); }, 160); start();
    }
  });
  document.addEventListener("focusin", (e) => { const el = pick(e.target); focus = el && e.target.matches(":focus-visible") ? el : null; start(); });
  document.addEventListener("focusout", () => { focus = null; start(); });
  document.addEventListener("close", () => { hover = null; focus = null; press = null; start(); }, true);
  window.addEventListener("resize", () => { size(); start(); });

  /* the pages re-render often: re-find things that were replaced, and pick up new menus */
  setInterval(() => {
    if (hover && !hover.isConnected) hover = pick(document.elementFromPoint(lx, ly));
    if (focus && (!focus.isConnected || (focus !== document.activeElement && !focus.contains(document.activeElement)))) focus = null;
    syncGroups();
    start();
  }, 250);

  size();
  document.body.appendChild(cv);
  syncGroups();
  start();
})();