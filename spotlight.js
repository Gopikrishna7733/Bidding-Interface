/* Spotlight effect: a light cone with a bright cap that slides between buttons, inputs and menus.
   One floating element follows whatever you hover or focus. Include after the other scripts. */
(function () {
  const SEL = "button, select, textarea, input, .pill";
  const spot = document.createElement("div");
  spot.className = "spot";
  spot.setAttribute("aria-hidden", "true");
  let hover = null, focus = null, cur = null, hideT = 0, lx = 0, ly = 0, placed = false, touchT = 0;

  const pick = (n) => {
    const el = n && n.closest ? n.closest(SEL) : null;
    if (!el || el.disabled || el.type === "hidden") return null;
    return el.closest(".pill") || el;
  };
  const hostOf = (el) => el.closest("dialog[open]") || document.body;

  function place() {
    if (!cur || !cur.isConnected) return;
    const r = cur.getBoundingClientRect();
    spot.style.width = r.width + "px";
    spot.style.height = r.height + "px";
    spot.style.transform = `translate(${r.left}px, ${r.top}px)`;
    spot.style.borderRadius = getComputedStyle(cur).borderRadius;
    spot.style.setProperty("--cw", Math.round(Math.min(Math.max(r.width * 1.3, 90), 240)) + "px");
    if (r.width <= 240) spot.style.setProperty("--cx", "50%");
  }

  function show(el) {
    clearTimeout(hideT);
    if (!el) {
      hideT = setTimeout(() => { cur = null; placed = false; spot.classList.remove("on"); }, 90);
      return;
    }
    const host = hostOf(el);
    if (spot.parentNode !== host) { host.appendChild(spot); placed = false; }
    const snap = !placed || !spot.classList.contains("on");
    if (snap) spot.classList.add("snap");
    cur = el;
    place();
    spot.classList.add("on");
    placed = true;
    if (snap) requestAnimationFrame(() => requestAnimationFrame(() => spot.classList.remove("snap")));
  }
  const update = () => show(hover || focus);

  document.addEventListener("pointerover", (e) => { hover = pick(e.target); update(); });
  document.addEventListener("pointermove", (e) => {
    lx = e.clientX; ly = e.clientY;
    if (cur && hover === cur) {
      const r = cur.getBoundingClientRect();
      if (r.width > 240) spot.style.setProperty("--cx", Math.min(Math.max(lx - r.left, 0), r.width) + "px");
    }
  });
  document.documentElement.addEventListener("mouseleave", () => { hover = null; update(); });
  document.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    clearTimeout(touchT);
    touchT = setTimeout(() => { hover = null; update(); }, 700);
  });
  document.addEventListener("focusin", (e) => { const el = pick(e.target); focus = el && e.target.matches(":focus-visible") ? el : null; update(); });
  document.addEventListener("focusout", () => { focus = null; update(); });
  document.addEventListener("close", () => { hover = null; focus = null; update(); }, true);

  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
  window.addEventListener("scroll", later, true);
  window.addEventListener("resize", later);

  /* the page re-renders often: re-find the element under the pointer if ours was replaced */
  setInterval(() => {
    if (hover && !hover.isConnected) hover = pick(document.elementFromPoint(lx, ly));
    else if (hover) hover = pick(hover);
    if (focus && (!focus.isConnected || !focus.contains(document.activeElement) && focus !== document.activeElement)) focus = null;
    if (cur) { update(); place(); }
  }, 250);

  document.body.appendChild(spot);
})();
