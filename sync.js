/* Cloud sync for PMM 3 (Firebase Firestore). Load after store.js and before the page script.

   How it works
   - The whole event (teams, points, bids, answers, questions) is one Firestore document: events/pmm3.
   - The pages still read from localStorage through load(). This file keeps that copy up to date from
     the cloud and tells the page to redraw, so admin.js, bidder.js and live.js need no changes.
   - save() still writes locally first, then sends only what CHANGED to the cloud inside a transaction.
     Two teams bidding at the same moment therefore both keep their bids.
   - Date.now() is corrected to the Firebase server clock, so every device ends bidding at the same moment. */
(function () {
  const ARR = ["lots", "bids", "answers", "roster", "renamed", "drafts"];
  const OBJ = ["base", "removed"];
  const SCA = ["nextId", "startPts", "epoch", "nextDraft"];

  /* identity of a list item: its content with keys sorted */
  const ck = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => ((o[key] = x[key]), o), {}) : x));
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const norm = (s) => Object.assign(blank(), s || {});

  /* what changed between two states */
  function makePatch(from, to) {
    const p = {};
    ARR.forEach((k) => {
      const a = new Set((from[k] || []).map(ck)), b = new Map((to[k] || []).map((x) => [ck(x), x]));
      const add = [...b].filter(([c]) => !a.has(c)).map(([, x]) => x);
      const del = [...a].filter((c) => !b.has(c));
      if (add.length || del.length) p[k] = { add, del };
    });
    OBJ.forEach((k) => {
      const f = from[k] || {}, t = to[k] || {}, set = {}, del = [];
      Object.keys(t).forEach((x) => { if (ck(t[x]) !== ck(f[x])) set[x] = t[x]; });
      Object.keys(f).forEach((x) => { if (!(x in t)) del.push(x); });
      if (Object.keys(set).length || del.length) p[k] = { set, del };
    });
    SCA.forEach((k) => { if (ck(from[k]) !== ck(to[k])) p[k] = { v: to[k] }; });
    return p;
  }

  /* apply a change on top of the latest cloud state */
  function applyPatch(remote, p) {
    const r = norm(clone(remote));
    ARR.forEach((k) => {
      if (!p[k]) return;
      const gone = new Set(p[k].del), seen = new Set();
      r[k] = (r[k] || []).filter((x) => !gone.has(ck(x)));
      r[k].forEach((x) => seen.add(ck(x)));
      p[k].add.forEach((x) => { const c = ck(x); if (!seen.has(c)) { r[k].push(clone(x)); seen.add(c); } });
    });
    OBJ.forEach((k) => {
      if (!p[k]) return;
      r[k] = r[k] || {};
      Object.keys(p[k].set).forEach((x) => { r[k][x] = clone(p[k].set[x]); });
      p[k].del.forEach((x) => { delete r[k][x]; });
    });
    SCA.forEach((k) => { if (p[k]) r[k] = p[k].v; });
    r.lots.sort((a, b) => a.id - b.id);
    r.drafts.sort((a, b) => a.did - b.did);
    r.bids.sort((a, b) => a.at - b.at);
    r.answers.sort((a, b) => a.at - b.at);
    const ids = new Set(r.lots.map((l) => l.id)); // no bids or answers for questions that were deleted
    r.bids = r.bids.filter((b) => ids.has(b.lotId));
    r.answers = r.answers.filter((a) => ids.has(a.lotId));
    return r;
  }
  window.PMM_MERGE = { makePatch, applyPatch, ck };

  /* ---------- small status badge ---------- */
  const COL = { ok: "#6ee7a8", wait: "#ffb38a", bad: "#ff8d9b" };
  let badge = null, dot = null, label = null;
  function setBadge(kind, text) {
    if (!badge) {
      badge = document.createElement("div");
      badge.setAttribute("role", "status");
      badge.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:50;display:flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;font:600 12px/1 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.18);pointer-events:none;max-width:calc(100vw - 24px)";
      dot = document.createElement("i"); dot.style.cssText = "flex:none;width:8px;height:8px;border-radius:50%";
      label = document.createElement("span");
      badge.append(dot, label); document.body.appendChild(badge);
    }
    dot.style.background = COL[kind]; label.textContent = text;
  }
  const friendly = (e) => {
    const c = (e && (e.code || e.message)) || "unknown";
    if (/permission/i.test(c)) return "Sync blocked: check the Firestore rules";
    if (/api.?key|invalid-argument|unauthenticated/i.test(c)) return "Sync error: API key not valid. Check firebase-config.js";
    if (/unavailable|network/i.test(c)) return "Offline. Retrying…";
    return "Sync error: " + c;
  };

  if (!window.firebase || !window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
    if (document.body) setBadge("bad", "Not synced: Firebase did not load");
    return;
  }

  /* ---------- connect ---------- */
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const db = firebase.firestore();
  try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) {} // helps on strict college Wi-Fi
  const ref = db.collection("events").doc("pmm3");
  setBadge("wait", "Connecting…");

  /* ---------- server clock ---------- */
  const realNow = Date.now.bind(Date);
  let skew = 0;
  Date.now = () => realNow() + skew;
  async function syncClock() {
    try {
      const r = db.collection("clock").doc("c" + Math.random().toString(36).slice(2));
      const t0 = realNow();
      await r.set({ t: firebase.firestore.FieldValue.serverTimestamp() });
      const t1 = realNow();
      const snap = await r.get({ source: "server" });
      skew = snap.data().t.toMillis() - (t0 + t1) / 2;
      r.delete().catch(() => {});
    } catch (e) { /* keep the device clock */ }
  }
  syncClock(); setInterval(syncClock, 10 * 60 * 1000);

  /* ---------- cloud copy <-> local copy ---------- */
  let synced = norm(clone(load()));   // the last state we know the cloud had, plus our own saved edits
  let remoteLatest = null;            // newest cloud state we have seen
  const outbox = [];                  // changes not yet in the cloud
  let flushing = false, retryT = 0;

  function applyRemote() {
    if (outbox.length || flushing || !remoteLatest) return; // never overwrite edits that are still being sent
    synced = norm(clone(remoteLatest));
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (cur && ck(norm(cur)) === ck(synced)) return;
    try { localStorage.setItem(KEY, JSON.stringify(synced)); } catch (e) { return; }
    window.dispatchEvent(new StorageEvent("storage", { key: KEY })); // the pages already redraw on this event
  }

  async function flush() {
    if (flushing) return;
    flushing = true; clearTimeout(retryT);
    while (outbox.length) {
      const p = outbox[0];
      try {
        const merged = await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const remote = snap.exists ? JSON.parse(snap.data().json) : blank();
          const out = p.replace ? norm(clone(p.replace)) : applyPatch(remote, p);
          tx.set(ref, { json: JSON.stringify(out), updated: firebase.firestore.FieldValue.serverTimestamp() });
          return out;
        });
        outbox.shift(); remoteLatest = merged; setBadge("ok", "Live sync on");
      } catch (e) {
        console.error("PMM sync:", e);
        setBadge("bad", friendly(e));
        flushing = false; retryT = setTimeout(flush, 3000);
        return;
      }
    }
    flushing = false;
    applyRemote();
  }

  /* replaces save() from store.js: write locally at once, then send the change to the cloud */
  window.save = function (s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { return false; }
    outbox.push(s.epoch !== synced.epoch ? { replace: clone(s) } : makePatch(synced, s)); // a full reset replaces everything
    synced = norm(clone(s));
    flush();
    return true;
  };

  /* live updates from every other device */
  ref.onSnapshot({ includeMetadataChanges: true }, (snap) => {
    if (snap.metadata.fromCache) { setBadge("wait", "Connecting…"); return; }
    try { remoteLatest = snap.exists ? norm(JSON.parse(snap.data().json)) : blank(); } catch (e) { return; }
    setBadge("ok", "Live sync on");
    applyRemote();
  }, (e) => { console.error("PMM sync:", e); setBadge("bad", friendly(e)); });
})();
