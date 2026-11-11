/* Page effects for the team, quiz master and live pages. Load after the other scripts.
   - Liquid glass popup: click or tap a button, input, menu item or card and a glass blob
     springs out of the exact spot, wobbles like liquid, throws off droplets and melts away.
   - Sparkles drift over the team in 1st place on the scoreboard (2nd and 3rd glow through CSS).
   The popup is plain DOM + CSS (injected below); one canvas draws the leader sparkles. */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SEL = "button, select, textarea, input, a, .pill, .search"; // what triggers the popup
  const LEAD = ".bar.r1, .brows li.r1, .teamtable tr.r1";           // 1st place: sparkles
  const SPARK = [[255, 255, 255], [176, 214, 240], [196, 181, 245], [196, 181, 245], [255, 179, 138], [255, 179, 138]];
  const MAXS = 160;

  /* ---------- liquid glass popup ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .lg-pop, .lg-ring, .lg-drop { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 2147483000; }
  .lg-pop {
    width: var(--s); height: var(--s); margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
    transform: translate(var(--x), var(--y)) scale(0);
    background:
      radial-gradient(circle at 30% 24%, rgba(255,255,255,.85) 0 7%, rgba(255,255,255,0) 22%),
      radial-gradient(circle at 70% 80%, rgba(255,255,255,.35) 0 5%, rgba(255,255,255,0) 18%),
      radial-gradient(circle at 50% 50%, rgba(255,255,255,.04) 30%, rgba(176,214,240,.22) 70%, rgba(196,181,245,.34) 100%);
    -webkit-backdrop-filter: blur(7px) saturate(1.8) brightness(1.08);
    backdrop-filter: blur(7px) saturate(1.8) brightness(1.08);
    border: 1.5px solid rgba(255,255,255,.65);
    box-shadow:
      inset 0 0 18px rgba(255,255,255,.55),
      inset 6px 8px 14px rgba(255,255,255,.35),
      inset -8px -10px 18px rgba(196,181,245,.30),
      0 10px 30px rgba(80,90,140,.25);
    border-radius: 58% 42% 55% 45% / 48% 56% 44% 52%;
    animation: lgPop .95s cubic-bezier(.2,.9,.25,1) forwards;
    will-change: transform, border-radius, opacity;
  }
  @keyframes lgPop {
    0%   { transform: translate(var(--x), var(--y)) scale(0);    opacity: 0; border-radius: 50%; }
    18%  { transform: translate(var(--x), var(--y)) scale(1.18, .86); opacity: 1; border-radius: 62% 38% 52% 48% / 44% 60% 40% 56%; }
    34%  { transform: translate(var(--x), var(--y)) scale(.92, 1.1);  border-radius: 45% 55% 40% 60% / 58% 42% 58% 42%; }
    52%  { transform: translate(var(--x), var(--y)) scale(1.05, .97); border-radius: 56% 44% 60% 40% / 46% 54% 46% 54%; opacity: 1; }
    75%  { transform: translate(var(--x), var(--y)) scale(1, 1);      border-radius: 50%; opacity: .85; }
    100% { transform: translate(var(--x), var(--y)) scale(1.35);      border-radius: 50%; opacity: 0; }
  }
  .lg-ring {
    width: var(--s); height: var(--s); margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
    border-radius: 50%; border: 2px solid rgba(255,255,255,.7);
    box-shadow: 0 0 14px rgba(176,214,240,.6), inset 0 0 10px rgba(196,181,245,.35);
    transform: translate(var(--x), var(--y)) scale(.2);
    animation: lgRing .85s cubic-bezier(.15,.7,.3,1) forwards;
  }
  @keyframes lgRing {
    0%   { transform: translate(var(--x), var(--y)) scale(.2); opacity: .9; }
    100% { transform: translate(var(--x), var(--y)) scale(2.6); opacity: 0; }
  }
  .lg-drop {
    width: var(--d); height: var(--d); margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2);
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 14%, rgba(255,255,255,.1) 40%, rgba(176,214,240,.35) 100%);
    -webkit-backdrop-filter: blur(3px) saturate(1.6); backdrop-filter: blur(3px) saturate(1.6);
    border: 1px solid rgba(255,255,255,.7);
    transform: translate(var(--x), var(--y)) scale(0);
    animation: lgDrop .8s cubic-bezier(.2,.8,.3,1) forwards;
  }
  @keyframes lgDrop {
    0%   { transform: translate(var(--x), var(--y)) scale(0); opacity: 0; }
    15%  { opacity: 1; transform: translate(var(--x), var(--y)) scale(1); }
    100% { transform: translate(calc(var(--x) + var(--dx)), calc(var(--y) + var(--dy))) scale(.2); opacity: 0; }
  }`;
  document.head.appendChild(css);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (n) => {
    const el = n && n.closest ? n.closest(SEL) : null;
    if (!el || el.disabled || el.type === "hidden") return null;
    return el.closest(".pill, .search") || el;
  };
  function mk(cls, x, y, vars, life) {
    const d = document.createElement("div");
    d.className = cls;
    d.setAttribute("aria-hidden", "true");
    d.style.setProperty("--x", x + "px");
    d.style.setProperty("--y", y + "px");
    for (const k in vars) d.style.setProperty(k, vars[k]);
    (document.querySelector("dialog[open]") || document.body).appendChild(d); // stay above an open dialog
    setTimeout(() => d.remove(), life);
  }
  function popup(x, y, el) {
    const r = el.getBoundingClientRect();
    const s = Math.round(Math.min(Math.max(Math.min(r.width, r.height) * 1.6, 90), 170));
    mk("lg-ring", x, y, { "--s": s * 0.7 + "px" }, 900);
    mk("lg-pop", x, y, { "--s": s + "px" }, 1000);
    const n = 5 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), dist = rnd(s * 0.7, s * 1.25);
      mk("lg-drop", x, y, { "--d": rnd(6, 14) + "px", "--dx": Math.cos(a) * dist + "px", "--dy": Math.sin(a) * dist + "px" }, 850);
    }
  }
  document.addEventListener("pointerdown", (e) => {
    const el = pick(e.target);
    if (el) popup(e.clientX, e.clientY, el);
  });
  document.addEventListener("keydown", (e) => { // keyboard "click" on a focused button or link
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("button, a")) {
      const r = e.target.getBoundingClientRect();
      popup(r.left + r.width / 2, r.top + r.height / 2, e.target);
    }
  });

  /* ---------- sparkles for the leader ---------- */
  const cv = document.createElement("canvas");
  cv.className = "sparkle";
  cv.setAttribute("aria-hidden", "true");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, sparks = [], running = false, last = 0, leadAcc = 0;
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
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);

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

    if (sparks.length || leads.length) requestAnimationFrame(frame);
    else running = false;
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }

  window.addEventListener("resize", size);
  setInterval(() => { if (document.querySelector(LEAD)) start(); }, 250); // the page re-renders often
  size();
  document.body.appendChild(cv);
})();