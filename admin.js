/* Quiz master page: adds, ends and deletes questions.
   IMPORTANT: this passcode only hides the page from casual visitors. Anyone can read
   it in the page source. Real protection needs a backend sign-in (e.g. Firebase Auth). */

function showPanel() {
  $("#gate").hidden = true; $("#panel").hidden = false; $("#lockBtn").hidden = false;
  state = load(); $("#sPts").value = state.startPts; renderRows(); renderTeams(); renderDrafts();
}
function unlock() {
  if ($("#pass").value === ADMIN_PASSCODE) {
    sessionStorage.setItem("pmm3-admin", "1"); $("#pass").value = ""; $("#passErr").textContent = ""; showPanel();
  } else { $("#passErr").textContent = "Wrong passcode."; }
}
function lock() { sessionStorage.removeItem("pmm3-admin"); location.reload(); }

function renderRows() {
  if (!state.lots.length) {
    $("#rows").innerHTML = '<tr><td colspan="7" class="empty">No questions yet. Add your first question above.</td></tr>';
    return;
  }
  $("#rows").innerHTML = state.lots.map((l) => {
    const ph = phase(l), top = topBid(l.id);
    const end = ph === "bidding" ? l.endsAt : ph === "answering" ? answerBy(l) : 0;
    const q = l.q.length > 70 ? l.q.slice(0, 70) + "…" : l.q;
    return `<tr class="${ph === "bidding" || ph === "answering" ? "" : "ended"}">
      <td><b>Q${l.id}.</b> ${esc(l.topic)}<small>${esc(typeName(l))} · ${esc(q)}</small></td>
      <td>${PHASE_LABEL[ph]}</td>
      <td>${top ? pts(top.amount) + " pts" : "–"}</td>
      <td>${top ? esc(top.name) : "–"}</td>
      ${end ? `<td class="count" data-end="${end}">${fmtLeft(end - Date.now())}</td>` : "<td>–</td>"}
      <td>${correctHTML(l)}</td>
      <td class="acts">
        ${ph === "bidding" ? `<button class="ghost" data-end-now="${l.id}" type="button">End bidding</button>` : ""}
        <button class="ghost danger" data-del="${l.id}" type="button">Delete</button>
      </td></tr>`;
  }).join("");
}

/* ---------- registered teams: points, rename, remove ---------- */
function renderTeams() {
  const el = $("#teamRows"); if (!el) return;
  const rows = teams();
  $("#teamCount").textContent = "(" + rows.length + ")";
  if (!rows.length) {
    el.innerHTML = '<tr><td colspan="5" class="empty">No teams yet. Teams appear here when they enter their team name.</td></tr>';
    return;
  }
  /* podium effects start once points differ; tied teams share a rank */
  const podium = new Set(rows.map((t) => t.pts)).size > 1, rankOf = (t) => 1 + rows.filter((x) => x.pts > t.pts).length;
  el.innerHTML = rows.map((t) => {
    const k = nk(t.name), bids = state.bids.filter((b) => nk(b.name) === k).length, rk = rankOf(t);
    return `<tr data-team="${esc(k)}" class="${podium && rk <= 3 ? "r" + rk : ""}">
      <td><b>${esc(t.name)}</b><small>${entered(t.name) ? "Entered own points" : "Using starting points"}</small></td>
      <td><input class="ptsin" type="number" min="0" step="1" inputmode="numeric" value="${t.pts}" aria-label="Points for ${esc(t.name)}"></td>
      <td>${t.held ? pts(t.held) + " pts" : "–"}</td>
      <td>${bids}</td>
      <td class="acts">
        <button class="ghost" data-save-pts type="button">Save points</button>
        <button class="ghost" data-rename type="button">Rename</button>
        <button class="ghost danger" data-remove type="button">Remove</button>
      </td></tr>`;
  }).join("");
}
/* do not redraw while the quiz master is typing in the team table */
function renderTeamsSafe() {
  const a = document.activeElement;
  if (a && a.closest && a.closest("#teamRows")) return;
  renderTeams();
}
$("#teamRows").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-team]"); if (!tr) return;
  state = load();
  const k = tr.dataset.team, team = teams().find((t) => nk(t.name) === k);
  if (!team) { renderTeams(); return; }
  const name = team.name;

  if (e.target.closest("[data-save-pts]")) {
    const inp = tr.querySelector(".ptsin");
    if (inp.value.trim() === "") { toast("Type the points first"); return; }
    const v = Math.floor(Number(inp.value));
    if (!(v >= 0)) { toast("Enter 0 or more points"); return; }
    state.base = state.base || {};
    state.base[k] = v - settled(name); // team total now equals what the quiz master typed
    if (!save(state)) { toast("Could not save. Browser storage may be full."); return; }
    renderTeams(); toast(`${name} now has ${pts(v)} points`);
  }

  if (e.target.closest("[data-rename]")) {
    const nn = (prompt(`Rename team "${name}" to:`, name) || "").trim().slice(0, 24);
    if (!nn || nn === name) return;
    if (nk(nn) !== k && teams().some((t) => nk(t.name) === nk(nn))) { toast("Another team already uses that name"); return; }
    state.roster = state.roster || []; state.base = state.base || {};
    state.roster = state.roster.map((n) => (nk(n) === k ? nn : n));
    if (!state.roster.some((n) => nk(n) === nk(nn))) state.roster.push(nn); // team that only appeared through a bid
    if (nk(nn) !== k && state.base[k] !== undefined) { state.base[nk(nn)] = state.base[k]; delete state.base[k]; }
    state.bids.forEach((b) => { if (nk(b.name) === k) b.name = nn; });
    state.answers.forEach((a) => { if (nk(a.name) === k) a.name = nn; });
    state.renamed = (state.renamed || []).filter((r) => nk(r.from) !== nk(nn));
    state.renamed.push({ from: name, to: nn }); // team pages follow the new name
    if (!save(state)) { toast("Could not save. Browser storage may be full."); return; }
    renderTeams(); renderRows(); toast(`Renamed to ${nn}`);
  }

  if (e.target.closest("[data-remove]")) {
    const nb = state.bids.filter((b) => nk(b.name) === k).length, na = state.answers.filter((a) => nk(a.name) === k).length;
    if (!confirm(`Remove team "${name}"?\n\nThis also deletes its ${nb} bid(s), ${na} answer(s) and its entered points. This cannot be undone.`)) return;
    state.roster = (state.roster || []).filter((n) => nk(n) !== k);
    if (state.base) delete state.base[k];
    state.bids = state.bids.filter((b) => nk(b.name) !== k);
    state.answers = state.answers.filter((a) => nk(a.name) !== k);
    state.removed = state.removed || {}; state.removed[k] = Date.now(); // team page forgets this name
    if (!save(state)) { toast("Could not save. Browser storage may be full."); return; }
    renderTeams(); renderRows(); toast(`Removed ${name}`);
  }
});

/* ---------- question types in the form ---------- */
const REASON_OPTS = [
  "Both A and R are true, and R is the correct explanation of A",
  "Both A and R are true, but R is not the correct explanation of A",
  "A is true, but R is false",
  "A is false, but R is true",
];
const TYPE_CFG = {
  blank: { mode: "text", q: "Sentence with a blank (write ____ where the blank goes)", ph: "The rate of dissolution is described by the ____ equation.",
    help: "Teams see the sentence and type the missing word or words. Write ____ for the blank." },
  statement: { mode: "mcq", q: "Statements and question", ph: "Statement I: ...\nStatement II: ...\nWhich of the statements is correct?",
    help: "Write the statements and the question, then give four options. Teams pick one." },
  reasoning: { mode: "mcq", ar: true,
    help: "Assertion and Reason. The four standard options are filled in for you; you can edit them." },
  aptitude: { mode: "mcq", q: "Question", ph: "Type the aptitude question",
    help: "A normal question with four options. Teams pick one." },
  matching: { mode: "match", q: "Instruction (optional)", ph: "Match each drug with its dosage form",
    help: "Add pairs. Teams see the left items in order and the right items shuffled, and match each one." },
  qa: { mode: "text", q: "Question", ph: "Type the full question",
    help: "Teams type their answer. List every accepted answer, separated by |." },
  video: { modeChoice: true, media: "Video link (YouTube link or direct .mp4 / .webm link)", q: "Question about the video", ph: "What is shown in the video?",
    help: "Teams watch the video after they win the bid, then answer. Choose how they answer." },
  sound: { modeChoice: true, media: "Audio link (direct .mp3 / .wav link or YouTube link)", q: "Question about the sound", ph: "Which instrument or process makes this sound?",
    help: "Teams listen to the clip after they win the bid, then answer. Choose how they answer." },
};
let prevType = "";
function applyType() {
  const t = $("#qType").value, c = TYPE_CFG[t];
  const mode = c.modeChoice ? $("#qMode").value : c.mode;
  const show = { q: !c.ar, ar: !!c.ar, media: !!c.media, mcq: mode === "mcq", text: mode === "text", match: mode === "match" };
  Object.keys(show).forEach((k) => { $("#box-" + k).hidden = !show[k]; });
  $("#modeWrap").hidden = !c.modeChoice;
  $("#typeHelp").textContent = c.help;
  if (c.q) { $("#qTextLabel").textContent = c.q; $("#qText").placeholder = c.ph || ""; }
  if (c.media) $("#qMediaLabel").textContent = c.media;
  const ids = ["#qA", "#qB", "#qC", "#qD"];
  if (t === "reasoning" && ids.every((id) => !$(id).value.trim())) ids.forEach((id, i) => ($(id).value = REASON_OPTS[i]));
  if (prevType === "reasoning" && t !== "reasoning" && ids.every((id, i) => $(id).value === REASON_OPTS[i])) ids.forEach((id) => ($(id).value = ""));
  prevType = t;
}

/* reads and checks the question form; returns null if something is missing */
function readForm() {
  const type = $("#qType").value, cfg = TYPE_CFG[type], mode = cfg.modeChoice ? $("#qMode").value : cfg.mode;
  const topic = $("#qTopic").value.trim();
  const start = Math.floor(Number($("#qStart").value)), inc = Math.floor(Number($("#qInc").value));
  const mins = Number($("#qMins").value), secs = Math.floor(Number($("#qSecs").value));
  if (!topic) { toast("Fill in the topic shown to bidders"); return null; }
  if (!(start > 0) || !(inc > 0) || !(mins > 0) || !(secs >= 10)) { toast("Check the bid amounts and timers (answer time is at least 10 s)"); return null; }

  let q;
  if (cfg.ar) {
    const as = $("#qAssert").value.trim(), re = $("#qReason").value.trim();
    if (!as || !re) { toast("Fill in both the Assertion and the Reason"); return null; }
    q = `Assertion (A): ${as}\nReason (R): ${re}`;
  } else {
    q = $("#qText").value.trim();
    if (!q && type === "matching") q = "Match the following items correctly.";
    if (!q) { toast("Type the question"); return null; }
  }
  if (type === "blank" && !/_{2,}/.test(q)) { toast("Write ____ in the sentence where the blank goes"); return null; }

  const d = {
    type, mode, topic, subject: $("#qSubject").value.trim(), hint: $("#qHint").value.trim(),
    difficulty: $("#qDiff").value, q, opts: [], correct: 0,
    start, inc, mins, answerSecs: secs,
  };
  if (cfg.media) {
    d.media = $("#qMedia").value.trim();
    if (!d.media) { toast("Add the " + (type === "video" ? "video" : "audio") + " link"); return null; }
    if (!/^(https?:\/\/|[^:]+$)/i.test(d.media)) { toast("The link must start with https://"); return null; }
  }
  if (mode === "mcq") {
    d.opts = ["#qA", "#qB", "#qC", "#qD"].map((id) => $(id).value.trim());
    if (d.opts.some((o) => !o)) { toast("Fill in all four options"); return null; }
    d.correct = Number($("#qCorrect").value);
  } else if (mode === "text") {
    d.accept = $("#qAccept").value.split("|").map((x) => x.trim()).filter(Boolean);
    if (!d.accept.length) { toast("Type the correct answer"); return null; }
  } else {
    d.pairs = [];
    for (const row of document.querySelectorAll("#box-match .pairrow")) {
      const l = row.querySelector(".pl").value.trim(), r = row.querySelector(".pr").value.trim();
      if (!l && !r) continue;
      if (!l || !r) { toast("Each pair needs both a left and a right side"); return null; }
      d.pairs.push({ l, r });
    }
    if (d.pairs.length < 2) { toast("Add at least two pairs"); return null; }
    if (new Set(d.pairs.map((p) => nk(p.r))).size !== d.pairs.length) { toast("Right-hand items must all be different"); return null; }
  }
  return d;
}
function clearForm() {
  ["#qTopic", "#qSubject", "#qHint", "#qText", "#qAssert", "#qReason", "#qMedia", "#qAccept", "#qA", "#qB", "#qC", "#qD"].forEach((id) => ($(id).value = ""));
  document.querySelectorAll("#box-match input").forEach((i) => (i.value = ""));
  $("#qCorrect").value = "0";
  prevType = ""; applyType(); $("#qTopic").focus();
}
/* turns a prepared question into a live one; bidding runs from now */
function toLot(d) {
  const { mins, did, ...rest } = d;
  return Object.assign({ id: state.nextId++ }, rest, { endsAt: Date.now() + mins * 60000 });
}

function addQuestion() {
  const d = readForm(); if (!d) return;
  state = load();
  state.lots.push(toLot(d));
  if (!save(state)) { state.lots.pop(); state.nextId--; toast("Could not save. Browser storage may be full."); return; }
  clearForm(); renderRows(); toast("Question added. Bidding is open.");
}

/* ---------- prepared questions ---------- */
function renderDrafts() {
  const el = $("#draftRows"); if (!el) return;
  const list = state.drafts || [];
  $("#draftCount").textContent = "(" + list.length + ")";
  if (!list.length) {
    el.innerHTML = '<tr><td colspan="5" class="empty">No prepared questions. Fill the form above and press "Save to prepared questions".</td></tr>';
    return;
  }
  el.innerHTML = list.map((d, i) => {
    const q = d.q.length > 80 ? d.q.slice(0, 80) + "…" : d.q;
    return `<tr>
      <td><b>P${i + 1}.</b> ${esc(d.topic)}<small>${esc(typeName(d))} · ${esc(q)}</small></td>
      <td>${esc(d.difficulty)}</td>
      <td>${pts(d.start)} pts start · ${d.mins} min</td>
      <td>${correctHTML(d)}</td>
      <td class="acts">
        <button class="primary" data-release="${d.did}" type="button" style="height:36px;padding:0 18px">Release</button>
        <button class="ghost danger" data-del-draft="${d.did}" type="button">Delete</button>
      </td></tr>`;
  }).join("");
}
function saveDraft() {
  const d = readForm(); if (!d) return;
  state = load(); state.drafts = state.drafts || [];
  d.did = state.nextDraft++;
  state.drafts.push(d);
  if (!save(state)) { state.drafts.pop(); state.nextDraft--; toast("Could not save. Browser storage may be full."); return; }
  clearForm(); renderDrafts(); toast("Saved to prepared questions. Teams cannot see it yet.");
}
$("#draftRows").addEventListener("click", (e) => {
  const rel = e.target.closest("[data-release]"), del = e.target.closest("[data-del-draft]");
  if (!rel && !del) return;
  state = load(); state.drafts = state.drafts || [];
  const id = Number((rel || del).dataset.release || (rel || del).dataset.delDraft), d = state.drafts.find((x) => x.did === id);
  if (!d) { renderDrafts(); return; }
  if (rel) {
    if (!confirm(`Release "${d.topic}" now? Bidding opens immediately for ${d.mins} minute(s).`)) return;
    state.drafts = state.drafts.filter((x) => x.did !== id);
    state.lots.push(toLot(d));
    if (!save(state)) { toast("Could not save. Browser storage may be full."); state = load(); return; }
    renderDrafts(); renderRows(); toast("Released. Bidding is open.");
  } else if (confirm(`Delete the prepared question "${d.topic}"? This cannot be undone.`)) {
    state.drafts = state.drafts.filter((x) => x.did !== id);
    save(state); renderDrafts(); toast("Prepared question deleted");
  }
});

$("#qType").addEventListener("change", applyType);
$("#qMode").addEventListener("change", applyType);
applyType();
$("#unlockBtn").addEventListener("click", unlock);
$("#pass").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });
$("#lockBtn").addEventListener("click", lock);
$("#addQ").addEventListener("click", addQuestion);
$("#saveDraft").addEventListener("click", saveDraft);
$("#saveSettings").addEventListener("click", () => {
  const v = Math.floor(Number($("#sPts").value));
  if (!(v > 0)) { toast("Enter a number of points above 0"); return; }
  state = load(); state.startPts = v; save(state); toast("Settings saved");
});
$("#clearAll").addEventListener("click", () => {
  state = load();
  if (!state.lots.length && !state.bids.length) { toast("Nothing to clear"); return; }
  if (confirm(`Delete all ${state.lots.length} questions, ${state.bids.length} bids and ${state.answers.length} answers? This cannot be undone.`)) {
    const keep = { startPts: state.startPts, roster: state.roster, base: state.base, renamed: state.renamed, removed: state.removed, drafts: state.drafts, nextDraft: state.nextDraft }; state = Object.assign(blank(), keep);
    save(state); renderRows(); renderTeams(); toast("Everything cleared");
  }
});
/* Reset everything: questions, bids, answers, scoreboard, team names and entered points */
$("#resetAll").addEventListener("click", () => {
  if (!confirm("Reset everything?\n\nThis permanently clears:\n- all questions\n- all bids and answers\n- the scoreboard\n- all team names\n- all points the teams entered\n\nThe starting points setting is kept. This cannot be undone.")) return;
  const old = load(), keep = old.startPts;
  state = blank(); state.startPts = keep;
  state.drafts = old.drafts || []; state.nextDraft = old.nextDraft || 1; // prepared questions are kept
  state.epoch = Date.now(); // every team page sees this and forgets its team name
  if (!save(state)) { toast("Could not save. Browser storage may be full."); return; }
  localStorage.removeItem("pmm3-team"); // also forget the team name saved in this browser
  $("#sPts").value = state.startPts; renderRows(); renderTeams();
  toast("Everything cleared: questions, bids, scoreboard, team names and points.");
});
$("#rows").addEventListener("click", (e) => {
  const end = e.target.closest("[data-end-now]"), del = e.target.closest("[data-del]");
  state = load();
  if (end) {
    const lot = state.lots.find((l) => l.id === Number(end.dataset.endNow));
    if (lot && confirm(`End bidding on Q${lot.id} now? The current leader wins the question.`)) { lot.endsAt = Date.now() - 1; save(state); renderRows(); renderTeams(); toast("Bidding ended"); }
  }
  if (del) {
    const id = Number(del.dataset.del), lot = state.lots.find((l) => l.id === id);
    if (lot && confirm(`Delete Q${id} and its bids? This cannot be undone.`)) {
      state.lots = state.lots.filter((l) => l.id !== id);
      state.bids = state.bids.filter((b) => b.lotId !== id);
      state.answers = state.answers.filter((a) => a.lotId !== id);
      save(state); renderRows(); renderTeams(); toast("Question deleted");
    }
  }
});
window.addEventListener("storage", (e) => { if (e.key === KEY && !$("#panel").hidden) { state = load(); renderRows(); renderTeamsSafe(); renderDrafts(); } });
setInterval(() => {
  if ($("#panel").hidden) return;
  let ended = false;
  document.querySelectorAll(".count[data-end]").forEach((el) => {
    const left = Number(el.dataset.end) - Date.now();
    if (left <= 0 && el.textContent !== "Ended") ended = true;
    el.textContent = fmtLeft(left);
  });
  if (ended) { state = load(); renderRows(); renderTeamsSafe(); }
}, 1000);

if (sessionStorage.getItem("pmm3-admin") === "1") showPanel();