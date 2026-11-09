/* Team page: bid on questions and answer the ones you win. No create, edit or delete. */

let filter = "all", metric = "board", sel = null, activeLot = null, pick = null;

const icon = (p) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = [
  '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M8 17h11"/>',
  '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
  '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
  '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M18 20a5 5 0 0 0-3-4.6"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
].map(icon);
const CHEV = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const me = () => $("#bidder").value.trim();
/* search looks at the topic, subject, difficulty and number only, never the hidden question text */
const matches = (l) => {
  const q = $("#search").value.trim().toLowerCase();
  return !q || [l.topic, l.subject, l.difficulty, typeName(l), "q" + l.id].join(" ").toLowerCase().includes(q);
};
const visible = () => state.lots.filter((l) => (filter === "all" || (filter === "open") === (phase(l) === "bidding")) && matches(l));

/* the answer area differs by question type */
function answerBody(lot, mode, a) {
  const m = qmode(lot);
  if (m === "text") {
    if (mode === "answer") return `<input class="ans" data-text type="text" maxlength="200" autocomplete="off" placeholder="Type your answer" aria-label="Your answer" value="${esc(typeof pick === "string" ? pick : "")}">`;
    const ok = a && isRight(lot, a);
    return `<div class="ansreview"><p>Answer given: <b class="${ok ? "ok" : "no"}">${a ? esc(a.choice) : "No answer"}</b></p><p>Correct answer: <b>${esc((lot.accept || []).join(" / "))}</b></p></div>`;
  }
  if (m === "match") {
    const order = matchOrder(lot), cur = Array.isArray(pick) ? pick : [];
    return '<div class="mlist">' + lot.pairs.map((p, i) => {
      if (mode === "answer") {
        return `<div class="mrow"><span class="ml"><b>${i + 1}</b>${esc(p.l)}</span><select class="msel" data-match="${i}" aria-label="Match for ${esc(p.l)}"><option value="">Choose a match…</option>${order.map((j) => `<option value="${j}" ${cur[i] === j ? "selected" : ""}>${esc(lot.pairs[j].r)}</option>`).join("")}</select></div>`;
      }
      const c = a && Array.isArray(a.choice) ? a.choice[i] : null, ok = c === i;
      return `<div class="mrow"><span class="ml"><b>${i + 1}</b>${esc(p.l)}</span><span class="mr ${ok ? "right" : "wrongpick"}">${c != null && lot.pairs[c] ? esc(lot.pairs[c].r) : "No answer"}</span>${ok ? "" : `<small>Correct: ${esc(p.r)}</small>`}</div>`;
    }).join("") + "</div>";
  }
  return '<div class="opts">' + lot.opts.map((o, i) => {
    let cls = "opt";
    if (mode === "answer" && pick === i) cls += " picked";
    if (mode === "review") { if (i === lot.correct) cls += " right"; else if (a && a.choice === i) cls += " wrongpick"; }
    return `<button class="${cls}" ${mode === "answer" ? `data-opt="${i}"` : "disabled"} type="button"><b>${LETTERS[i]}</b><span>${esc(o)}</span></button>`;
  }).join("") + "</div>";
}

function questionCard(lot, mode) {
  const a = answerOf(lot);
  return `<div class="qcard">${mediaHTML(lot)}<p class="qtext">${esc(lot.q)}</p>${answerBody(lot, mode, a)}
    ${mode === "answer" ? '<div class="qfoot"><button class="cta" data-lock type="button">Lock in answer</button></div>' : ""}</div>`;
}

function renderHero() {
  /* do not redraw while a team is typing or choosing a match, or the entry would be lost */
  const ae = document.activeElement;
  if (ae && ae.matches && ae.matches("#hero [data-text], #hero [data-match]")) return;
  const list = visible();
  if (!list.length) {
    $("#hero").innerHTML = `<div class="emptyhero"><h2 class="big">${state.lots.length ? "No questions in this view" : "No questions yet"}</h2><p>${state.lots.length ? "Try another filter or clear the search." : "Questions appear here as soon as the quiz master adds them. Check back soon."}</p></div>`;
    $("#tiles").innerHTML = "";
    return;
  }
  const lot = list.find((l) => l.id === sel) || list[0];
  sel = lot.id;
  const ph = phase(lot), top = topBid(lot.id);
  const iWon = !!(top && me() && nk(top.name) === nk(me()));
  const reveal = ph === "correct" || ph === "wrong" || ph === "timeout";
  const showCard = (ph === "answering" && iWon) || reveal;
  const stage = showCard ? questionCard(lot, ph === "answering" ? "answer" : "review")
                         : `<div class="noimg" aria-hidden="true">Q${lot.id}</div>`;

  let lbl = "Winning bid:", note = "", who = "", cta = "";
  if (ph === "bidding") {
    lbl = top ? "Current bid:" : "Starting bid:";
    note = `<span class="timer count" data-fmt="hms" data-end="${lot.endsAt}">${fmtHMS(lot.endsAt - Date.now())}</span><span class="tl"> until bidding closes</span>`;
    who = top ? `Leading: <mark>${esc(top.name)}</mark>` : `No bids yet · raise by ${pts(lot.inc)} pts`;
    cta = `<button class="cta" data-bid="${lot.id}" type="button">Place bid</button>`;
  } else if (ph === "answering") {
    note = `<span class="timer count" data-fmt="hms" data-end="${answerBy(lot)}">${fmtHMS(answerBy(lot) - Date.now())}</span><span class="tl"> left to answer</span>`;
    who = `<mark>${esc(top.name)}</mark> won the bidding`;
    cta = `<button class="cta" type="button" disabled>${iWon ? "Your turn: answer above" : "Waiting for " + esc(top.name)}</button>`;
  } else if (ph === "correct") {
    note = `<span class="res good">Correct · +${pts(top.amount)} pts</span>`;
    who = `<mark>${esc(top.name)}</mark> answered correctly`;
    cta = `<button class="cta" type="button" disabled>Question closed</button>`;
  } else if (ph === "wrong") {
    note = `<span class="res bad">Wrong answer · −${pts(top.amount)} pts</span>`;
    who = `<mark>${esc(top.name)}</mark> answered incorrectly`;
    cta = `<button class="cta" type="button" disabled>Question closed</button>`;
  } else if (ph === "timeout") {
    note = `<span class="res bad">Time ran out · −${pts(top.amount)} pts</span>`;
    who = `<mark>${esc(top.name)}</mark> did not answer in time`;
    cta = `<button class="cta" type="button" disabled>Question closed</button>`;
  } else {
    lbl = "Starting bid:";
    note = `<span class="res">No bids placed</span>`;
    cta = `<button class="cta" type="button" disabled>Question closed</button>`;
  }

  $("#hero").innerHTML = `
    <div class="heroTop">
      <div>
        <h2 class="big">${esc(lot.topic)}</h2>
        <p class="sub"><span>${esc(lot.subject || "")}</span><span class="ref">Question ${lot.id}</span><span class="ref tchip">${esc(typeName(lot))}</span></p>
      </div>
      ${lot.hint ? `<div class="about"><p>${esc(lot.hint)}</p>${lot.hint.length > 110 ? '<button class="link" data-more type="button">Read more</button>' : ""}</div>` : ""}
    </div>
    <div class="stage ${showCard ? "live" : ""}">${stage}</div>
    <div class="heroBottom">
      <div>
        <span class="lbl">${lbl}</span>
        <b class="bigprice">${pts(top && ph !== "bidding" ? top.amount : current(lot))}<small> pts</small></b>
        <div>${note}</div>
        <span class="who">${who}</span>
      </div>
      <div class="actions">
        <button class="round" data-nav="-1" type="button" aria-label="Previous question">${CHEV("M15 6l-6 6 6 6")}</button>
        ${cta}
        <button class="round" data-nav="1" type="button" aria-label="Next question">${CHEV("M9 6l6 6-6 6")}</button>
      </div>
      <div class="lotpick"><span>Question:</span>
        <div class="dots">${list.map((l) => {
          const p = phase(l), done = p === "correct" || p === "wrong" || p === "timeout" || p === "unsold";
          return `<button class="dot ${l.id === lot.id ? "on" : ""} ${done ? "ended" : ""}" data-sel="${l.id}" type="button" aria-label="Question ${l.id}: ${esc(l.topic)}">${l.id}</button>`;
        }).join("")}</div>
      </div>
    </div>`;

  const tiles = [
    { k: "Subject", v: lot.subject || "–" }, { k: "Difficulty", v: lot.difficulty },
    { k: "Starting bid", v: pts(lot.start) + " pts" }, { k: "Minimum raise", v: pts(lot.inc) + " pts" },
    { k: "Bids placed", v: String(bidsFor(lot.id).length) }, { k: "Status", v: PHASE_SHORT[ph] },
  ];
  $("#tiles").innerHTML = tiles.map((t, i) => `<div class="tile">${ICONS[i]}<span>${esc(t.k)}</span><b>${esc(t.v)}</b></div>`).join("");
}

function renderChart() {
  const note = $("#chartNote");
  if (metric === "board") {
    const rows = teams();
    note.textContent = `The white tick marks the ${pts(state.startPts)} points every team starts with.`;
    if (!rows.length) { $("#bars").innerHTML = '<p class="empty">Teams appear here as soon as they enter a team name.</p>'; return; }
    const max = Math.max(state.startPts, ...rows.map((r) => r.pts));
    $("#bars").innerHTML = rows.map((r, i) => `<div class="bar ${me() && nk(r.name) === nk(me()) ? "me" : ""}">
      <span class="bl">${i + 1}. ${esc(r.name)}${me() && nk(r.name) === nk(me()) ? " (you)" : ""}</span>
      <div class="track"><div class="fill" style="width:${Math.max(1.5, (r.pts / max) * 100)}%"></div><i class="start" style="left:${(state.startPts / max) * 100}%"></i></div>
      <b>${pts(r.pts)}</b><small>${r.held ? pts(r.held) + " held" : ""}</small></div>`).join("");
    return;
  }
  note.textContent = "The white tick on each bar marks the starting bid.";
  if (!state.lots.length) { $("#bars").innerHTML = '<p class="empty">The chart appears when the first question is added.</p>'; return; }
  const max = Math.max(1, ...state.lots.map((l) => current(l)));
  $("#bars").innerHTML = state.lots.map((l) => {
    const top = topBid(l.id), closed = phase(l) !== "bidding";
    return `<div class="bar ${closed ? "ended" : ""}">
      <span class="bl">Q${l.id}. ${esc(l.topic)}</span>
      <div class="track"><div class="fill" style="width:${Math.max(1.5, (current(l) / max) * 100)}%"></div><i class="start" style="left:${(l.start / max) * 100}%" title="Starting bid ${pts(l.start)}"></i></div>
      <b>${pts(current(l))}</b><small>${top ? esc(top.name) : "–"}</small></div>`;
  }).join("");
}

function renderFeed() {
  const time = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const topicOf = (id) => { const l = state.lots.find((x) => x.id === id); return l ? "Q" + l.id + " · " + esc(l.topic) : "Question " + id; };
  const ev = [
    ...state.bids.map((b) => ({ t: b.at, h: `<b>${esc(b.name)}</b> bid ${pts(b.amount)} pts<small>${topicOf(b.lotId)} · ${time(b.at)}</small>` })),
    ...state.answers.map((a) => {
      const l = state.lots.find((x) => x.id === a.lotId), t = l && topBid(l.id);
      if (!l || !t) return null;
      const ok = isRight(l, a);
      return { t: a.at, h: `<b>${esc(a.name)}</b> answered ${ok ? "correctly: +" : "wrong: −"}${pts(t.amount)} pts<small>${topicOf(a.lotId)} · ${time(a.at)}</small>` };
    }).filter(Boolean),
  ].sort((x, y) => y.t - x.t).slice(0, 14);
  $("#feed").innerHTML = ev.length ? ev.map((e) => `<li>${e.h}</li>`).join("") : '<li class="empty">Bids and answers appear here as they happen.</li>';
}

function renderWallet() {
  const n = me(), w = $("#wallet");
  $("#avatar").textContent = n ? n[0].toUpperCase() : "?";
  if (!n) { w.dataset.team = ""; w.innerHTML = '<span class="tl">Enter your team name to see your score</span>'; return; }
  const locked = entered(n);
  let inp = $("#myPts");
  if (!inp || inp.dataset.locked !== String(locked) || w.dataset.team !== nk(n)) {
    w.dataset.team = nk(n);
    w.innerHTML = '<span>Points secured till now</span>'
      + `<input id="myPts" type="number" min="0" step="1" inputmode="numeric" aria-label="Points secured till now" data-locked="${locked}" ${locked ? "readonly" : ""}>`
      + (locked ? "" : '<button class="ghost" id="lockPts" type="button">Lock in my points</button>')
      + '<span class="tl wmeta"><span id="myNote"></span> · <span id="myRank"></span></span>';
    inp = $("#myPts");
  }
  if (locked || (inp.dataset.dirty !== "1" && document.activeElement !== inp)) inp.value = points(n);
  $("#myNote").textContent = locked ? "Locked. Points can be entered only once." : "You can enter your points only once.";
  const rows = teams(), i = rows.findIndex((r) => nk(r.name) === nk(n));
  $("#myRank").textContent = i >= 0 ? `Rank ${i + 1} of ${rows.length} on the leaderboard` : "Press Enter in the Team box to join the leaderboard";
}

function renderRules() {
  $("#rules").innerHTML = `
    <h2>How it works</h2>
    <div class="rulegrid">
      <p><b>Start.</b> Every team begins with ${pts(state.startPts)} points.</p>
      <p><b>Bid.</b> Spend points to win the right to answer a question. The highest bid when the timer ends wins.</p>
      <p><b>Answer.</b> Only the winning team sees the question, and has limited time to answer.</p>
      <p><b>Score.</b> Correct answer: you gain your bid. Wrong or no answer: you lose it.</p>
    </div>`;
}

function render() { renderHero(); renderChart(); renderFeed(); renderWallet(); renderRules(); }

/* ---------- bidding ---------- */
function openBid(id) {
  const lot = state.lots.find((l) => l.id === id);
  if (!lot || !isLive(lot)) return;
  if (!me()) { $("#bidder").focus(); toast("Enter your team name first"); return; }
  const free = available(me(), lot.id), top = topBid(lot.id);
  if (top && nk(top.name) === nk(me())) { toast("You are already leading this question"); return; }
  if (free < minNext(lot)) { toast(`Not enough points. You have ${pts(free)} free; the minimum bid is ${pts(minNext(lot))}.`); return; }
  activeLot = lot;
  $("#bidTitle").textContent = lot.topic;
  $("#bidInfo").textContent = `Current bid ${pts(current(lot))} pts. Minimum next bid ${pts(minNext(lot))} pts. You can bid up to ${pts(free)} pts.`;
  $("#bidAmount").value = minNext(lot);
  $("#bidErr").textContent = "";
  const amts = [...new Set([0, 1, 2, 4].map((k) => minNext(lot) + k * lot.inc).filter((a) => a <= free).concat(free))];
  $("#quick").innerHTML = amts.map((a) => `<button type="button" data-amt="${a}">${a === free && amts.length > 1 ? "Max " : ""}${pts(a)}</button>`).join("");
  $("#bidDialog").showModal();
}

function placeBid() {
  state = load(); // check against the latest data
  const lot = state.lots.find((l) => l.id === activeLot.id);
  if (!lot) { $("#bidErr").textContent = "This question was removed."; return; }
  const amount = Math.floor(Number($("#bidAmount").value)), name = me(), top = topBid(lot.id);
  if (!isLive(lot)) { $("#bidErr").textContent = "Bidding has closed for this question."; return; }
  if (top && nk(top.name) === nk(name)) { $("#bidErr").textContent = "You are already leading this question."; return; }
  if (!(amount >= minNext(lot))) { $("#bidErr").textContent = `Bid at least ${pts(minNext(lot))} points.`; return; }
  if (amount > available(name, lot.id)) { $("#bidErr").textContent = `You only have ${pts(available(name, lot.id))} points free.`; return; }
  state.bids.push({ lotId: lot.id, name, amount, at: Date.now() });
  if (lot.endsAt - Date.now() < 30000) lot.endsAt += 30000; // last-second bids add 30 s
  save(state);
  $("#bidDialog").close();
  render();
  toast(`Bid placed: ${pts(amount)} pts`);
}

function lockAnswer() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  state = load();
  const lot = state.lots.find((l) => l.id === sel), top = lot && topBid(lot.id);
  if (!lot || phase(lot) !== "answering" || !top || nk(top.name) !== nk(me())) { toast("This question can't be answered now"); render(); return; }
  const m = qmode(lot); let choice;
  if (m === "text") {
    choice = String(pick || "").trim();
    if (!choice) { toast("Type your answer first"); return; }
  } else if (m === "match") {
    const c = lot.pairs.map((_, i) => (Array.isArray(pick) && Number.isInteger(pick[i]) ? pick[i] : null));
    if (c.some((v) => v === null)) { toast("Match every item first"); return; }
    if (new Set(c).size !== c.length) { toast("Each option can be used only once"); return; }
    choice = c;
  } else {
    if (typeof pick !== "number") { toast("Choose an option first"); return; }
    choice = pick;
  }
  state.answers.push({ lotId: lot.id, name: top.name, choice, at: Date.now() });
  save(state);
  pick = null;
  render();
  toast("Answer locked in");
}

/* when the quiz master resets the event, every team page forgets its team name */
function syncEpoch() {
  const seen = localStorage.getItem("pmm3-epoch"), now = String(state.epoch || 0);
  // a changed marker means a reset happened since this browser last looked (also true for browsers with no marker yet)
  if (seen !== now && (seen !== null || now !== "0")) {
    localStorage.removeItem("pmm3-team"); $("#bidder").value = ""; pick = null; sel = null;
  }
  localStorage.setItem("pmm3-epoch", now);
  /* the quiz master may have renamed or removed this team */
  let mine = localStorage.getItem("pmm3-team");
  if (mine) {
    const saved = mine;
    for (let i = 0; i < 20; i++) {
      const r = (state.renamed || []).find((x) => nk(x.from) === nk(mine));
      if (!r || r.to === mine) break;
      mine = r.to;
    }
    if (mine !== saved) { localStorage.setItem("pmm3-team", mine); $("#bidder").value = mine; pick = null; }
    if ((state.removed || {})[nk(mine)] && !(state.roster || []).some((x) => nk(x) === nk(mine))) {
      localStorage.removeItem("pmm3-team"); $("#bidder").value = ""; pick = null; sel = null;
    }
  }
}

/* a team joins the leaderboard once its name is entered (on Enter or when leaving the field) */
function registerTeam() {
  const n = me();
  if (!n) return;
  state = load(); state.roster = state.roster || [];
  if (state.removed) delete state.removed[nk(n)];
  if (!state.roster.some((x) => nk(x) === nk(n))) { state.roster.push(n); save(state); }
  render();
}

/* ---------- events ---------- */
$("#hero").addEventListener("click", (e) => {
  const bid = e.target.closest("[data-bid]"), nav = e.target.closest("[data-nav]"), dot = e.target.closest("[data-sel]");
  const more = e.target.closest("[data-more]"), opt = e.target.closest("[data-opt]"), lock = e.target.closest("[data-lock]");
  if (bid) openBid(Number(bid.dataset.bid));
  if (dot) { sel = Number(dot.dataset.sel); pick = null; renderHero(); }
  if (nav) {
    const list = visible(), i = list.findIndex((l) => l.id === sel);
    sel = list[(i + Number(nav.dataset.nav) + list.length) % list.length].id; pick = null; renderHero();
  }
  if (more) { const box = more.closest(".about"); box.classList.toggle("open"); more.textContent = box.classList.contains("open") ? "Show less" : "Read more"; }
  if (opt) { pick = Number(opt.dataset.opt); renderHero(); }
  if (lock) lockAnswer();
});
/* typed answers and matches are kept as they change, without redrawing the card */
$("#hero").addEventListener("input", (e) => { if (e.target.matches("[data-text]")) pick = e.target.value; });
$("#hero").addEventListener("change", (e) => {
  const s = e.target.closest("[data-match]"); if (!s) return;
  if (!Array.isArray(pick)) pick = [];
  pick[Number(s.dataset.match)] = s.value === "" ? null : Number(s.value);
});
$("#hero").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-text]")) lockAnswer(); });
function lockPoints() {
  const n = me(), inp = $("#myPts");
  if (!n || !inp) return;
  if (inp.value.trim() === "") { toast("Type your points first"); return; }
  const v = Math.floor(Number(inp.value));
  if (!(v >= 0)) { toast("Enter 0 or more points"); return; }
  state = load();
  if (entered(n)) { toast("Points were already entered for this team"); render(); return; }
  if (!confirm(`Lock in ${pts(v)} points for ${n}? You can enter your points only once.`)) return;
  state.base = state.base || {};
  state.base[nk(n)] = v - settled(n); // so the team's total now equals what it typed
  state.roster = state.roster || [];
  if (state.removed) delete state.removed[nk(n)];
  if (!state.roster.some((x) => nk(x) === nk(n))) state.roster.push(n);
  save(state); render(); toast("Points locked in");
}
$("#wallet").addEventListener("click", (e) => { if (e.target.closest("#lockPts")) lockPoints(); });
$("#wallet").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "myPts" && !e.target.readOnly) lockPoints(); });
$("#wallet").addEventListener("input", (e) => { if (e.target.id === "myPts") e.target.dataset.dirty = "1"; });
$("#search").addEventListener("input", () => { pick = null; renderHero(); });
$("#quick").addEventListener("click", (e) => { const b = e.target.closest("[data-amt]"); if (b) $("#bidAmount").value = b.dataset.amt; });
$("#bidGo").addEventListener("click", placeBid);
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]"); if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("on", x === b));
  renderHero();
});
$("#metric").addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]"); if (!b) return;
  metric = b.dataset.m;
  document.querySelectorAll("#metric button").forEach((x) => x.classList.toggle("on", x === b));
  renderChart();
});
$("#bidder").value = localStorage.getItem("pmm3-team") || "";
syncEpoch();
$("#bidder").addEventListener("input", (e) => { localStorage.setItem("pmm3-team", e.target.value.trim()); pick = null; renderHero(); renderWallet(); renderChart(); });
$("#bidder").addEventListener("change", registerTeam);
registerTeam();
window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); syncEpoch(); render(); } });

setInterval(() => {
  let ended = false;
  document.querySelectorAll(".count[data-end]").forEach((el) => {
    const left = Number(el.dataset.end) - Date.now();
    if (left <= 0 && el.textContent !== "Ended") ended = true;
    el.textContent = el.dataset.fmt === "hms" ? fmtHMS(left) : fmtLeft(left);
  });
  if (ended) render();
}, 1000);

render();