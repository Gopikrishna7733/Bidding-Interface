/* Particle glance effect: sparkles rise from the button, input or menu item you hover or focus,
   with a quick light sweep across it. One canvas draws everything. Load after the other scripts. */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SEL = "button, select, textarea, input, a, .pill, .search";
  const REST = ".menu button.on, .menu a.on, .seg button.on"; // active menu items keep a gentle sparkle
  const COLORS = [[255, 255, 255], [176, 214, 240], [196, 181, 245], [196, 181, 245], [255, 179, 138], [255, 179, 138]]; // powder blue, lavender, peach glints
  const MAX = 240;

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
  let parts = [], sweep = null, running = false, last = 0, acc = 0, restAcc = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
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

  function spawn(r, n, follow) {
    for (let i = 0; i < n && parts.length < MAX; i++) {
      for (let t = 0; t < 6; t++) {
        let px = r.x + Math.random() * r.w;
        if (follow && r.w > 240) px = Math.min(Math.max(lx + rnd(-110, 110), r.x), r.x + r.w);
        const py = r.y + Math.random() * r.h;
        if (!inside(r, px, py)) continue;
        const glint = Math.random() < 0.28;
        parts.push({
          x: px, y: py, vx: rnd(-8, 8), vy: glint ? rnd(-10, -2) : -rnd(10, 42),
          age: 0, max: glint ? rnd(0.5, 1.1) : rnd(0.7, 1.5),
          size: glint ? rnd(4, 8) : rnd(0.9, 2.4), glint,
          col: COLORS[(Math.random() * COLORS.length) | 0], ph: rnd(0, 6.28), fr: rnd(10, 22),
        });
        break;
      }
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
    ctx.globalCompositeOperation = "lighter";

    if (cur && cur.isConnected) {
      const r = rectOf(cur);
      acc += dt * Math.min(Math.max((r.w * r.h) / 150, 30), 140);
      const n = Math.floor(acc); acc -= n;
      spawn(r, n, true);
      if (sweep && sweep.el === cur) { // light glance sweeping across the control
        const p = (t - sweep.t0) / 650;
        if (p >= 1) sweep = null;
        else {
          const e = 1 - Math.pow(1 - p, 3), bw = r.w * 0.45, bx = r.x - bw + (r.w + bw * 2) * e;
          ctx.save(); roundPath(r); ctx.clip();
          const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          g.addColorStop(0, "rgba(200,185,250,0)"); g.addColorStop(0.5, `rgba(235,228,255,${0.42 * (1 - p * 0.5)})`); g.addColorStop(1, "rgba(200,185,250,0)");
          ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
        }
      }
    }
    if (!modal) {
      restAcc += dt * 14;
      const k = Math.floor(restAcc); restAcc -= k;
      rests.forEach((el) => { if (el.isConnected && el !== cur) spawn(rectOf(el), Math.ceil(k / rests.length), false); });
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
      const life = p.age / p.max;
      const a = Math.sin(Math.PI * life) * (0.55 + 0.45 * Math.sin(t / 1000 * p.fr + p.ph));
      const [r, g, b] = p.col;
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(a, 0)})`;
      if (p.glint) {
        star(p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(Math.PI * life)));
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(a, 0) * 0.18})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 1.6, 0, 6.283); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); }
    }

    if (cur || parts.length || sweep || (rests.length && !modal)) requestAnimationFrame(frame);
    else running = false;
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }

  function update() {
    const el = hover || focus;
    if (el !== cur) {
      cur = el;
      if (el) { spawn(rectOf(el), 16, true); sweep = { el, t0: performance.now() }; }
    }
    if (cur) start();
  }

  document.addEventListener("pointerover", (e) => { hover = pick(e.target); update(); });
  document.addEventListener("pointermove", (e) => { lx = e.clientX; ly = e.clientY; });
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
    if (rests.length) start();
  }, 250);

  size();
  document.body.appendChild(cv);
})();