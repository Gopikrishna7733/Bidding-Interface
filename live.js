/* Projector page (live.html). Read-only: shows bidding, locked bids, the leader,
   who won or lost the bid, who is answering and whether the answer was right or wrong.
   It follows the question that is open for bids, then the one being answered, then the latest result.
   Like the other pages it reads the data saved by store.js. */

let manual = null, primed = false, lastBidCount = 0, flashT = 0;
const lastPhase = new Map();
const DONE = ["correct", "wrong", "timeout", "unsold"];
const LABEL = { bidding: "Bidding open", answering: "Answering now", correct: "Answered correctly", wrong: "Answered wrong", timeout: "Time ran out", unsold: "No bids" };
const lock = '<svg class="lk" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

function clock(ms) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`;
}
const doneAt = (l) => { const a = answerOf(l); return a ? a.at : phase(l) === "timeout" ? answerBy(l) : l.endsAt; };
function setHTML(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }

/* which question is on the big screen */
function featured() {
  const L = state.lots;
  if (!L.length) return null;
  if (manual !== null) { const m = L.find((l) => l.id === manual); if (m) return m; manual = null; }
  const by = (p) => L.filter((l) => phase(l) === p);
  const b = by("bidding").sort((x, y) => x.endsAt - y.endsAt); if (b.length) return b[0];
  const a = by("answering").sort((x, y) => answerBy(x) - answerBy(y)); if (a.length) return a[0];
  return [...L].sort((x, y) => doneAt(y) - doneAt(x))[0];
}

/* one row per team that bid, highest first */
function ladderRows(lot) {
  const m = new Map();
  bidsFor(lot.id).forEach((b) => { const k = nk(b.name), x = m.get(k); if (!x || b.amount > x.amount) m.set(k, { name: b.name.trim(), amount: b.amount, at: b.at }); });
  return [...m.values()].sort((a, b) => b.amount - a.amount || a.at - b.at);
}

function ladderHTML(lot, ph) {
  const rows = ladderRows(lot);
  if (!rows.length) return ph === "bidding" ? '<p class="dim big2">No bids yet. Be the first to bid.</p>' : "";
  const max = rows[0].amount, now = Date.now();
  return '<div class="ladder">' + rows.map((r, i) => {
    let chip;
    if (i === 0) {
      if (ph === "bidding") chip = `<span class="chip lead">${lock} Leading · ${pts(r.amount)} pts locked</span>`;
      else if (ph === "answering") chip = `<span class="chip win">${lock} Won the bid · ${pts(r.amount)} pts locked</span>`;
      else if (ph === "correct") chip = `<span class="chip good">Won the bid · correct +${pts(r.amount)}</span>`;
      else if (ph === "wrong") chip = `<span class="chip bad">Won the bid · wrong −${pts(r.amount)}</span>`;
      else chip = `<span class="chip bad">Won the bid · no answer −${pts(r.amount)}</span>`;
    } else chip = ph === "bidding" ? '<span class="chip out">Outbid</span>' : '<span class="chip lost">Lost the bid</span>';
    return `<div class="lrow ${i === 0 ? "first" : ""} ${now - r.at < 5000 ? "fresh" : ""}" style="--w:${Math.max(4, (r.amount / max) * 100)}%">
      <span class="rk">${i + 1}</span><span class="tm">${esc(r.name)}</span><b class="am">${pts(r.amount)}<small> pts</small></b>${chip}</div>`;
  }).join("") + "</div>";
}

function revealHTML(lot) {
  const a = answerOf(lot), m = qmode(lot);
  let body;
  if (m === "text") {
    body = `<div class="ansreview"><p>Answer given: <b class="${a && isRight(lot, a) ? "ok" : "no"}">${a ? esc(a.choice) : "No answer"}</b></p><p>Correct answer: <b>${esc((lot.accept || []).join(" / "))}</b></p></div>`;
  } else if (m === "match") {
    body = '<div class="mlist">' + lot.pairs.map((p, i) => {
      const c = a && Array.isArray(a.choice) ? a.choice[i] : null, ok = c === i;
      return `<div class="mrow"><span class="ml"><b>${i + 1}</b>${esc(p.l)}</span><span class="mr ${ok ? "right" : "wrongpick"}">${c != null && lot.pairs[c] ? esc(lot.pairs[c].r) : "No answer"}</span>${ok ? "" : `<small>Correct: ${esc(p.r)}</small>`}</div>`;
    }).join("") + "</div>";
  } else {
    body = `<div class="opts">${lot.opts.map((o, i) => {
      let cls = "opt"; if (i === lot.correct) cls += " right"; else if (a && a.choice === i) cls += " wrongpick";
      return `<div class="${cls}"><b>${LETTERS[i]}</b><span>${esc(o)}</span></div>`;
    }).join("")}</div>`;
  }
  return `<div class="reveal">${mediaHTML(lot)}<p class="qtext">${esc(lot.q)}</p>${body}</div>`;
}

function mainHTML(lot) {
  const ph = phase(lot), top = topBid(lot.id);
  const box = (k, v) => `<div class="mbox"><span class="k">${k}</span>${v}</div>`;
  const num = (n, cls = "") => `<b class="mv ${cls}">${pts(n)}<small> pts</small></b>`;
  const nm = (t) => `<b class="mv name">${esc(t)}</b>`;
  let boxes, status = "";
  if (ph === "bidding") {
    boxes = box(top ? "Current bid" : "Starting bid", num(current(lot)))
      + box("Leading team", top ? nm(top.name) : '<b class="mv name dim">No bids yet</b>')
      + box("Bidding closes in", `<b class="mv timer count" data-end="${lot.endsAt}"></b>`);
    status = top ? `${lock}<span><b>${esc(top.name)}</b> has <b>${pts(top.amount)} pts</b> locked. Next bid: at least <b>${pts(minNext(lot))} pts</b>.</span>`
                 : `<span>Opening bid <b>${pts(lot.start)} pts</b>. Each raise: at least <b>${pts(lot.inc)} pts</b>.</span>`;
  } else if (ph === "answering") {
    boxes = box("Winning bid", num(top.amount)) + box("Answering team", nm(top.name))
      + box("Time to answer", `<b class="mv timer count" data-end="${answerBy(lot)}"></b>`);
    status = `<span><b>${esc(top.name)}</b> won the bid with <b>${pts(top.amount)} pts</b> and is answering now. The question stays hidden from everyone else.</span>`;
  } else if (ph === "correct") {
    boxes = box("Winning bid", num(top.amount)) + box("Answered by", nm(top.name)) + box("Result", `<b class="mv good">Correct ✓</b>`);
    status = `<span><b>${esc(top.name)}</b> answered <b>correctly</b> and gains <b>${pts(top.amount)} pts</b>.</span>`;
  } else if (ph === "wrong") {
    boxes = box("Winning bid", num(top.amount)) + box("Answered by", nm(top.name)) + box("Result", `<b class="mv badtxt">Wrong ✗</b>`);
    status = `<span><b>${esc(top.name)}</b> answered <b>wrong</b> and loses <b>${pts(top.amount)} pts</b>.</span>`;
  } else if (ph === "timeout") {
    boxes = box("Winning bid", num(top.amount)) + box("Team", nm(top.name)) + box("Result", `<b class="mv badtxt">No answer</b>`);
    status = `<span><b>${esc(top.name)}</b> did not answer in time and loses <b>${pts(top.amount)} pts</b>.</span>`;
  } else {
    boxes = box("Starting bid", num(lot.start)) + box("Winner", '<b class="mv name dim">None</b>') + box("Result", '<b class="mv dim">No bids</b>');
    status = "<span>Nobody bid on this question.</span>";
  }
  return `<div class="mhead">
      <div class="mmeta"><span class="qchip">Question ${lot.id}</span><span class="dchip">${esc(lot.difficulty)}</span><span class="dchip">${esc(typeName(lot))}</span><span class="subj">${esc(lot.subject || "")}</span></div>
      <span class="phase ph-${ph}">${LABEL[ph]}</span>
    </div>
    <h2 class="mtopic">${esc(lot.topic)}</h2>
    <div class="mnums">${boxes}</div>
    <div class="mstatus st-${ph}">${status}</div>
    ${ladderHTML(lot, ph)}
    ${DONE.includes(ph) && ph !== "unsold" ? revealHTML(lot) : ""}`;
}

const emptyMain = () => '<div class="emptyhero"><h2 class="mtopic">Waiting for the first question</h2><p>The quiz master has not added a question yet. Bids will appear here live.</p></div>';

function othersHTML(cur) {
  const list = state.lots.filter((l) => cur && l.id !== cur.id && ["bidding", "answering"].includes(phase(l)));
  if (!list.length) return "";
  return '<span class="olabel">Also in play</span>' + list.map((l) => {
    const p = phase(l), t = topBid(l.id), end = p === "bidding" ? l.endsAt : answerBy(l);
    return `<button class="ochip" data-pin="${l.id}" type="button"><b>Q${l.id}</b> ${esc(l.topic)}
      <small>${p === "bidding" ? (t ? esc(t.name) + " leads " + pts(t.amount) : "No bids") : esc(t.name) + " answering"} · <span class="count" data-end="${end}"></span></small></button>`;
  }).join("");
}

function boardHTML() {
  const rows = teams();
  /* podium effects start once points differ; tied teams share a rank */
  const podium = new Set(rows.map((r) => r.pts)).size > 1, rankOf = (r) => 1 + rows.filter((x) => x.pts > r.pts).length;
  const body = rows.length ? '<ol class="brows">' + rows.map((r, i) => `<li class="${podium && rankOf(r) <= 3 ? "r" + rankOf(r) : ""}">
      <span class="rk">${i + 1}</span><span class="tm">${esc(r.name)}${r.held ? `<small>${lock} ${pts(r.held)} locked in bids</small>` : ""}</span><b class="am">${pts(r.pts)}</b></li>`).join("") + "</ol>"
    : '<p class="dim">Teams appear here as soon as they join.</p>';
  return `<h2>Scoreboard</h2>${body}`;
}

function feedHTML() {
  const time = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const lotOf = (id) => state.lots.find((x) => x.id === id);
  const tag = (l) => (l ? `Q${l.id} · ${esc(l.topic)}` : "Question");
  const ev = [
    ...state.bids.map((b) => ({ t: b.at, h: `<b>${esc(b.name)}</b> bid ${pts(b.amount)} pts<small>${tag(lotOf(b.lotId))} · ${time(b.at)}</small>` })),
    ...state.lots.filter((l) => !isLive(l) && topBid(l.id)).map((l) => {
      const t = topBid(l.id); return { t: l.endsAt, h: `<b>${esc(t.name)}</b> won the bid · ${pts(t.amount)} pts<small>${tag(l)} · ${time(l.endsAt)}</small>` };
    }),
    ...state.answers.map((a) => {
      const l = lotOf(a.lotId), t = l && topBid(l.id); if (!l || !t) return null;
      const ok = isRight(l, a);
      return { t: a.at, h: `<b>${esc(a.name)}</b> answered ${ok ? "correctly: +" : "wrong: −"}${pts(t.amount)} pts<small>${tag(l)} · ${time(a.at)}</small>` };
    }).filter(Boolean),
  ].sort((x, y) => y.t - x.t).slice(0, 8);
  return `<h2>Live activity</h2><ol id="feed">${ev.length ? ev.map((e) => `<li>${e.h}</li>`).join("") : '<li class="empty">Bids and answers appear here as they happen.</li>'}</ol>`;
}

/* big banner when something happens: new bid, bid won, answer right or wrong */
function flash(cls, text, sub) {
  const f = $("#flash");
  f.className = "flash show " + cls;
  f.innerHTML = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ""}`;
  clearTimeout(flashT); flashT = setTimeout(() => f.classList.remove("show"), 6500);
}
function announce() {
  const L = state.lots; let msg = null;
  if (primed) {
    if (state.bids.length > lastBidCount) {
      const b = state.bids[state.bids.length - 1], l = L.find((x) => x.id === b.lotId);
      msg = ["bid", `${esc(b.name)} bids ${pts(b.amount)} pts`, l ? `Q${l.id} · ${esc(l.topic)}` : ""];
    }
    L.forEach((l) => {
      const p = phase(l), old = lastPhase.get(l.id), t = topBid(l.id), q = `Q${l.id} · ${esc(l.topic)}`;
      if (old === undefined) msg = ["bid", "New question open for bids", q];
      else if (old !== p) {
        const lost = ladderRows(l).length > 1 ? " Other teams lost the bid." : "";
        if (p === "answering") msg = ["win", `${esc(t.name)} won the bid`, `${pts(t.amount)} pts locked · answering now.${lost}`];
        else if (p === "correct") msg = ["good", `${esc(t.name)} answered correctly!`, `+${pts(t.amount)} pts · ${q}`];
        else if (p === "wrong") msg = ["bad", `${esc(t.name)} answered wrong`, `−${pts(t.amount)} pts · ${q}`];
        else if (p === "timeout") msg = ["bad", `${esc(t.name)} ran out of time`, `−${pts(t.amount)} pts · ${q}`];
        else if (p === "unsold") msg = ["bid", "No bids placed", q];
      }
    });
  }
  lastBidCount = state.bids.length;
  L.forEach((l) => lastPhase.set(l.id, phase(l)));
  [...lastPhase.keys()].forEach((id) => { if (!L.some((l) => l.id === id)) lastPhase.delete(id); });
  primed = true;
  if (msg) flash(...msg);
}

/* timers show from the count elements; returns true when one has just reached zero */
function tick() {
  let hit = false;
  document.querySelectorAll(".count[data-end]").forEach((el) => {
    const left = Number(el.dataset.end) - Date.now();
    el.textContent = clock(left);
    if (left <= 0 && !el.dataset.hit) { el.dataset.hit = "1"; hit = true; }
  });
  $("#clock").textContent = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return hit;
}

function render() {
  const lot = featured();
  setHTML($("#main"), lot ? mainHTML(lot) : emptyMain());
  setHTML($("#others"), othersHTML(lot));
  setHTML($("#board"), boardHTML());
  setHTML($("#feed2"), feedHTML());
  $("#autoQ").classList.toggle("on", manual === null);
  announce();
  tick();
}

function step(d) {
  const L = state.lots, cur = featured();
  if (!L.length || !cur) return;
  const i = L.findIndex((l) => l.id === cur.id);
  manual = L[(i + d + L.length) % L.length].id;
  render();
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
}

$("#prevQ").addEventListener("click", () => step(-1));
$("#nextQ").addEventListener("click", () => step(1));
$("#autoQ").addEventListener("click", () => { manual = null; render(); });
$("#fsBtn").addEventListener("click", fullscreen);
$("#others").addEventListener("click", (e) => { const b = e.target.closest("[data-pin]"); if (b) { manual = Number(b.dataset.pin); render(); } });
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select")) return;
  if (e.key === "ArrowRight") step(1);
  else if (e.key === "ArrowLeft") step(-1);
  else if (e.key.toLowerCase() === "a") { manual = null; render(); }
  else if (e.key.toLowerCase() === "f") fullscreen();
});
window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); render(); } });
setInterval(() => { if (tick()) { state = load(); render(); } }, 250);
setInterval(() => { state = load(); render(); }, 1000);

render();