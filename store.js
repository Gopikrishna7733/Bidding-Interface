/* PMM 3 – Pharmaceutics Mastery Matrix 3 (quiz auction)
   Shared by the team page (index.html) and the quiz master page (admin.html).

   RULES
   - Every team starts with the same points.
   - Each question is a lot. Teams bid points for the right to answer it.
   - Highest bid when the timer ends wins the question and sees it.
   - Correct answer: team gains its bid. Wrong or no answer in time: team loses its bid.

   Data lives in localStorage, so it is only shared between tabs on ONE browser.
   To run the event across many devices, replace load() and save() with a backend
   (for example Firebase Firestore). */

const KEY = "pmm3-v1";
const blank = () => ({ nextId: 1, startPts: 1000, lots: [], bids: [], answers: [], base: {}, epoch: 0, roster: [], renamed: [], removed: {}, drafts: [], nextDraft: 1 });

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) {}
  return blank();
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }

let state = load();

const $ = (s) => document.querySelector(s);
const pts = (n) => Number(n).toLocaleString("en-IN");
const nk = (s) => String(s).trim().toLowerCase();
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTERS = ["A", "B", "C", "D"];

/* ---------- questions, bids, answers ---------- */
const bidsFor = (id) => state.bids.filter((b) => b.lotId === id);
const topBid = (id) => bidsFor(id).reduce((a, b) => (!a || b.amount > a.amount ? b : a), null);
const current = (lot) => (topBid(lot.id) ? topBid(lot.id).amount : lot.start);
const minNext = (lot) => (topBid(lot.id) ? topBid(lot.id).amount + lot.inc : lot.start);
const isLive = (lot) => lot.endsAt > Date.now();
const answerOf = (lot) => state.answers.find((a) => a.lotId === lot.id) || null;
const answerBy = (lot) => lot.endsAt + lot.answerSecs * 1000;

/* bidding -> answering -> correct | wrong | timeout, or unsold when nobody bid */
function phase(lot) {
  if (isLive(lot)) return "bidding";
  const top = topBid(lot.id);
  if (!top) return "unsold";
  const a = answerOf(lot);
  if (a) return isRight(lot, a) ? "correct" : "wrong";
  return Date.now() >= answerBy(lot) ? "timeout" : "answering";
}
const PHASE_LABEL = { bidding: "Bidding open", answering: "Awaiting answer", correct: "Answered correctly", wrong: "Answered wrong", timeout: "Timed out", unsold: "No bids" };
const PHASE_SHORT = { bidding: "Open", answering: "Answering", correct: "Correct", wrong: "Wrong", timeout: "Timed out", unsold: "No bids" };

/* ---------- points ---------- */
function outcome(lot) {
  const p = phase(lot), top = topBid(lot.id);
  if (p === "correct") return top.amount;
  if (p === "wrong" || p === "timeout") return -top.amount;
  return 0;
}
function settled(name) {
  return state.lots.reduce((sum, l) => { const t = topBid(l.id); return t && nk(t.name) === nk(name) ? sum + outcome(l) : sum; }, 0);
}
/* points a team has tied up in questions it is currently leading or answering */
function committed(name, exceptId) {
  return state.lots.reduce((sum, l) => {
    const t = topBid(l.id), p = phase(l);
    return l.id !== exceptId && t && nk(t.name) === nk(name) && (p === "bidding" || p === "answering") ? sum + t.amount : sum;
  }, 0);
}
/* base = the points a team entered for itself (once). Without it a team starts from startPts. */
const entered = (name) => !!(state.base && state.base[nk(name)] !== undefined);
const points = (name) => (entered(name) ? state.base[nk(name)] : state.startPts) + settled(name);
const available = (name, exceptId) => points(name) - committed(name, exceptId);

/* every team that has entered its name (roster) plus anyone who has bid */
function teams() {
  const first = new Map();
  (state.roster || []).forEach((n) => { if (!first.has(nk(n))) first.set(nk(n), String(n).trim()); });
  state.bids.forEach((b) => { if (!first.has(nk(b.name))) first.set(nk(b.name), b.name.trim()); });
  return [...first.values()]
    .map((name) => ({ name, pts: points(name), held: committed(name, -1) }))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
}

/* ---------- question types ----------
   mode "mcq"   : team picks one option           (answer = option number)
   mode "text"  : team types the answer           (answer = text, checked against lot.accept)
   mode "match" : team matches every left item    (answer = list of right-item numbers)
   Older questions have no type and stay plain multiple choice. */
const QTYPES = {
  blank: "Fill in the Blanks", statement: "Statement correct", reasoning: "Reasoning", aptitude: "Aptitude",
  matching: "Matching", qa: "Question and Answer", video: "Watch Video and Answer", sound: "Guess the Answer by Sound",
};
const qmode = (l) => l.mode || "mcq";
const typeName = (l) => QTYPES[l.type] || "Multiple choice";
const normAns = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
function isRight(lot, a) {
  const m = qmode(lot);
  if (m === "text") { const g = normAns(a.choice); return g !== "" && (lot.accept || []).some((x) => normAns(x) === g); }
  if (m === "match") return Array.isArray(a.choice) && (lot.pairs || []).every((_, i) => a.choice[i] === i);
  return a.choice === lot.correct;
}
/* the right-hand items of a matching question, shuffled the same way for everyone */
function matchOrder(lot) {
  const idx = lot.pairs.map((_, i) => i); let x = ((lot.id * 2654435761) >>> 0) || 1;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}
const ytId = (u) => { const m = String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/); return m ? m[1] : null; };
/* video or audio player for video and sound questions */
function mediaHTML(lot) {
  if (!lot.media || !/^(https?:\/\/|[^:]+$)/i.test(lot.media)) return "";
  const u = esc(lot.media), id = ytId(lot.media);
  if (id) return `<div class="media ${lot.type === "sound" ? "snd" : ""}"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Question media" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  if (lot.type === "sound") return `<div class="media snd"><audio controls preload="metadata" src="${u}"></audio></div>`;
  return `<div class="media"><video controls playsinline preload="metadata" src="${u}"></video></div>`;
}
/* the correct answer, as table-cell HTML for the quiz master */
function correctHTML(l) {
  const m = qmode(l), cut = (t) => (t.length > 80 ? t.slice(0, 80) + "…" : t);
  if (m === "text") { const a = l.accept || []; return `<b>${esc(a[0] || "")}</b>${a.length > 1 ? `<small>also: ${esc(cut(a.slice(1).join(" | ")))}</small>` : ""}`; }
  if (m === "match") return `<b>${l.pairs.length} pairs</b><small>${esc(cut(l.pairs.map((p) => p.l + " → " + p.r).join("; ")))}</small>`;
  return `<b>${LETTERS[l.correct]}</b><small>${esc(l.opts[l.correct])}</small>`;
}

/* ---------- formatting ---------- */
function fmtLeft(ms) {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + "h " : "") + String(m).padStart(h ? 2 : 1, "0") + "m " + String(x).padStart(2, "0") + "s";
}
function fmtHMS(ms) {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000), p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}h : ${p(Math.floor((s % 3600) / 60))}m : ${p(s % 60)}s`;
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 2800);
}