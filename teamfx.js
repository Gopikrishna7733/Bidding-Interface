/* Page effects for the team, quiz master and live pages. Load after the other scripts.
   - Liquid glass bubbles rise from the button, input or menu item you hover, focus or tap.
   - Sparkles drift over the team in 1st place on the scoreboard (2nd and 3rd glow through CSS).
   One canvas draws everything. */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SEL = "button, select, textarea, input, a, .pill, .search";
  const REST = ".menu button.on, .menu a.on, .seg button.on"; // the active menu item keeps a few gentle bubbles
  const LEAD = ".bar.r1, .brows li.r1, .teamtable tr.r1"; // the team in 1st place: team page bars, live scoreboard, quiz master table
  const TINT = [[176, 214, 240], [196, 181, 245], [255, 179, 138], [255, 255, 255]]; // powder blue, lavender, peach, clear
  const SPARK = [[255, 255, 255], [176, 214, 240], [196, 181, 245], [196, 181, 245], [255, 179, 138], [255, 179, 138]];
  const MAXB = 90, MAXS = 160;

  const cv = document.createElement("canvas");
  cv.className = "sparkle";
  cv.setAttribute("aria-hidden", "true");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0;
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let hover = null, focus = null, cur = null, rests = [], lx = 0, ly = 0, touchT = 0;
  let bubbles = [], sparks = [], sheen = null, running = false, last = 0, acc = 0, restAcc = 0, leadAcc = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const pick = (n) => {
    const el = n && n.closest ? n.closest(SEL) : null;
    if (!el || el.disabled || el.type === "hidden") return null;
    return el.closest(".pill, .search") || el;
  };
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    const rad = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
    return { x: r.left, y: r.top, w: r.width, h: r.height, rad };
  }
  function inside(r, px, py) {
    const dx = Math.max(r.x + r.rad - px, 0, px - (r.x + r.w - r.rad));
    const dy = Math.max(r.y + r.rad - py, 0, py - (r.y + r.h - r.rad));
    return dx * dx + dy * dy <= r.rad * r.rad;
  }
  function roundPath(r) {
    const { x, y, w, h, rad } = r;
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  /* ---------- liquid glass bubbles ---------- */
  function spawnBubbles(r, n, follow) {
    for (let i = 0; i < n && bubbles.length < MAXB; i++) {
      for (let t = 0; t < 6; t++) {
        let px = r.x + Math.random() * r.w;
        if (follow && r.w > 240) px = clamp(lx + rnd(-110, 110), r.x, r.x + r.w);
        const py = r.y + r.h * rnd(0.35, 1);
        if (!inside(r, px, py)) continue;
        const big = Math.random() < 0.16;
        bubbles.push({
          x: px, y: py, vx: rnd(-6, 6), vy: -rnd(26, 72), r: big ? rnd(8, 13) : rnd(2.5, 7),
          age: 0, max: rnd(1.1, 2.2), sway: rnd(5, 14), wf: rnd(2.5, 5), ph: rnd(0, 6.28), col: TINT[(Math.random() * TINT.length) | 0],
        });
        break;
      }
    }
  }
  function burst(x, y) { // a tap sends a spray of bubbles outwards
    for (let i = 0; i < 9 && bubbles.length < MAXB + 20; i++) {
      const a = rnd(0, 6.283), s = rnd(25, 85);
      bubbles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25, r: rnd(3, 9), drag: 0.93,
        age: 0, max: rnd(0.8, 1.5), sway: 4, wf: 3, ph: rnd(0, 6.28), col: TINT[(Math.random() * TINT.length) | 0],
      });
    }
  }
  function drawBubble(p, t) {
    const life = p.age / p.max;
    if (life > 0.86) { // the pop: a thin ring that widens and fades
      const q = (life - 0.86) / 0.14;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + q * 0.55), 0, 6.283);
      ctx.lineWidth = Math.max(0.6, p.r * 0.07); ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - q)})`; ctx.stroke();
      return;
    }
    const a = Math.min(1, life / 0.12) * 0.95;                         // quick fade in
    const wob = 1 + 0.09 * Math.sin((t / 1000) * p.wf * 2 + p.ph);      // the liquid wobble
    const rx = p.r * wob, ry = p.r / wob, [r, g, b] = p.col;
    ctx.save(); ctx.translate(p.x, p.y);
    const body = ctx.createRadialGradient(0, 0, p.r * 0.1, 0, 0, p.r);  // clear centre, tinted glassy edge
    body.addColorStop(0, `rgba(${r},${g},${b},0)`);
    body.addColorStop(0.72, `rgba(${r},${g},${b},${0.1 * a})`);
    body.addColorStop(1, `rgba(${r},${g},${b},${0.38 * a})`);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.283); ctx.fillStyle = body; ctx.fill();
    ctx.lineWidth = Math.max(0.7, p.r * 0.09); ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`; ctx.stroke();
    if (p.r > 3.5) {
      ctx.beginPath(); ctx.ellipse(-rx * 0.34, -ry * 0.42, rx * 0.3, ry * 0.15, -0.7, 0, 6.283);   // main highlight
      ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; ctx.fill();
      ctx.beginPath(); ctx.arc(rx * 0.42, ry * 0.46, Math.max(0.7, p.r * 0.1), 0, 6.283);          // small glint
      ctx.fillStyle = `rgba(255,255,255,${0.55 * a})`; ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- sparkles for the leader ---------- */
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
  function star(x, y, s) { // four-point glint
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

    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);

    const leads = modal ? [] : [...document.querySelectorAll(LEAD)];
    if (cur && cur.isConnected) {
      const r = rectOf(cur);
      acc += dt * clamp((r.w * r.h) / 420, 8, 34);
      const n = Math.floor(acc); acc -= n;
      spawnBubbles(r, n, true);
      if (sheen && sheen.el === cur) { // a soft glass sheen sliding across the control
        const p = (t - sheen.t0) / 700;
        if (p >= 1) sheen = null;
        else {
          const e = 1 - Math.pow(1 - p, 3), bw = r.w * 0.4, bx = r.x - bw + (r.w + bw * 2) * e;
          ctx.save(); roundPath(r); ctx.clip();
          const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, `rgba(255,255,255,${0.26 * (1 - p * 0.5)})`); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
        }
      }
    }
    if (!modal) {
      restAcc += dt * 5;
      const k = Math.floor(restAcc); restAcc -= k;
      if (k) rests.forEach((el) => { if (el.isConnected && el !== cur) spawnBubbles(rectOf(el), Math.ceil(k / rests.length), false); });
    }
    leads.forEach((lead) => {
      const r = rectOf(lead);
      if (r.y + r.h > 0 && r.y < H) { leadAcc += dt * 55 / leads.length; const n = Math.floor(leadAcc); leadAcc -= n; spawnSparks(r, n); }
    });

    ctx.globalCompositeOperation = "lighter"; // sparkles glow
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
    ctx.globalCompositeOperation = "source-over"; // bubbles are glass, not light
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const p = bubbles[i];
      p.age += dt;
      if (p.age >= p.max) { bubbles.splice(i, 1); continue; }
      const f = Math.pow(p.drag || 0.995, dt * 60);
      p.vx *= f; p.vy = p.vy * f - 6 * dt;
      p.x += (p.vx + Math.sin((t / 1000) * p.wf + p.ph) * p.sway) * dt; p.y += p.vy * dt;
      drawBubble(p, t);
    }

    if (cur || bubbles.length || sparks.length || sheen || (!modal && (rests.length || leads.length))) requestAnimationFrame(frame);
    else running = false;
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }

  function update() {
    const el = hover || focus;
    if (el !== cur) {
      cur = el;
      if (el) { spawnBubbles(rectOf(el), 12, true); sheen = { el, t0: performance.now() }; }
    }
    if (cur) start();
  }

  document.addEventListener("pointerover", (e) => { hover = pick(e.target); update(); });
  document.addEventListener("pointermove", (e) => { lx = e.clientX; ly = e.clientY; });
  document.addEventListener("pointerdown", (e) => { if (pick(e.target)) { burst(e.clientX, e.clientY); start(); } });
  document.documentElement.addEventListener("mouseleave", () => { hover = null; update(); });
  document.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    clearTimeout(touchT);
    touchT = setTimeout(() => { hover = null; update(); }, 700);
  });
  document.addEventListener("focusin", (e) => { const el = pick(e.target); focus = el && e.target.matches(":focus-visible") ? el : null; update(); });
  document.addEventListener("focusout", () => { focus = null; update(); });
  document.addEventListener("close", () => { hover = null; focus = null; update(); }, true);
  window.addEventListener("resize", size);

  /* the page re-renders often: re-find the element under the pointer if ours was replaced */
  setInterval(() => {
    if (hover && !hover.isConnected) hover = pick(document.elementFromPoint(lx, ly));
    else if (hover) hover = pick(hover);
    if (focus && (!focus.isConnected || (focus !== document.activeElement && !focus.contains(document.activeElement)))) focus = null;
    rests = [...document.querySelectorAll(REST)];
    update();
    if (rests.length || document.querySelector(LEAD)) start();
  }, 250);

  size();
  document.body.appendChild(cv);
})();