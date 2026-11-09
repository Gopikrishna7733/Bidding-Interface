# Implementation Plan: Pharmaceutics Mastery Matrix 3 (PMM 3)

## 1. Plan Overview & Objectives

This implementation plan outlines the engineering roadmap to build, verify, and maintain the **Pharmaceutics Mastery Matrix 3 (PMM 3)** live quiz bidding and evaluation platform, based on [`doc/problemstatement.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/problemstatement.md) and [`doc/architecture.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/architecture.md).

The primary goal is delivering a low-latency, zero-backend, multi-view quiz auction engine running seamlessly across three synchronized interfaces on a single host browser:

- **Quiz Master Portal** (`admin.html` / `admin.js`)
- **Competing Teams Terminal** (`index.html` / `bidder.js`)
- **Projector Scoreboard** (`live.html` / `live.js`)

---

## 2. Phased Implementation Roadmap

```text
+-----------------------------------------------------------------------------------+
|                        Phase 1: Foundation & Shared State                         |
|   - Storage schema ('pmm3-v1') & load/save serialization                          |
|   - Economic scoring engine (Base, Settled, Committed, Available)                 |
|   - Anti-sniping logic, phase resolver, & XSS sanitization (esc)                  |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Phase 2: Question Engine & Multi-Modal Authoring              |
|   - Admin form for 8 question types mapped to 3 grading modes                     |
|   - Deterministic PRNG shuffle for matching questions                             |
|   - YouTube / HTML5 video & audio media embeds                                    |
|   - Staging workflow for prepared drafts                                          |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Phase 3: Bidding & Team Client Portal                         |
|   - Team registration, avatar generation, & wallet baseline lock-in              |
|   - Real-time catalog filtering, search, & question hero view                     |
|   - Modal bid placement with dynamic increments & quick-select amounts            |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Phase 4: Progressive Disclosure & Answering                   |
|   - Pre-briefing prompt secrecy during bidding window                             |
|   - Exclusive winner answering view upon auction closure                          |
|   - Deterministic answer validation & immediate point settlement                  |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Phase 5: Audience & Projector Orchestration                   |
|   - Auto-following stage algorithm (bidding -> answering -> recent result)        |
|   - Visual bid ladder showing relative stakes & locked points                     |
|   - State change banners & full solution reveal                                   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Phase 6: Event Governance & Admin Controls                    |
|   - Passcode-gated administration                                                 |
|   - Live team roster management (edit points, rename cascade, removal purge)     |
|   - Event reset with epoch synchronization                                        |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Phase 7: Hardening, Verification & Accessibility              |
|   - Cross-tab concurrency & timer drift testing                                   |
|   - Linter compliance (html-validate, axe-linter, markdownlint, webhint)          |
+-----------------------------------------------------------------------------------+
```

---

## 3. Work Breakdown Structure (WBS)

### Phase 1: Foundation & Shared State Engine (`store.js`)

- **Task 1.1: State Schema Definition**:
  - Implement `blank()` state factory with default keys (`nextId: 1`, `startPts: 1000`, `lots: []`, `bids: []`, `answers: []`, `base: {}`, `epoch: 0`, `roster: []`, `renamed: []`, `removed: {}`, `drafts: []`, `nextDraft: 1`).
  - Implement defensive `load()` and `save()` wrappers around `localStorage` with `try...catch` blocks to protect against quota exhaustion.

- **Task 1.2: Economic Balance Calculation Suite**:
  - Implement `entered(name)` to detect custom base overrides.
  - Implement `points(name)` calculating $\text{BasePoints} + \text{Settled}$.
  - Implement `committed(name, exceptId)` calculating escrowed stakes in active `bidding` and `answering` lots.
  - Implement `available(name, exceptId)` calculating spendable balance.
  - Implement `teams()` returning descending rank-sorted team balances and committed stakes.

- **Task 1.3: Deterministic Phase Resolver**:
  - Implement `phase(lot)` evaluating:
    - `"bidding"` when `lot.endsAt > Date.now()`
    - `"unsold"` when timer expired with 0 bids
    - `"answering"` when timer expired with leading bid and answer timer active
    - `"correct"` / `"wrong"` when answer submitted
    - `"timeout"` when answer timer expired without submission

- **Task 1.4: Sanitization & Format Utilities**:
  - Implement `esc(s)` converting `&`, `<`, `>`, `"`, `'` to safe HTML entities.
  - Implement `pts(n)` with Indian numbering format (`1,00,000`).
  - Implement `fmtHMS(ms)` and `fmtLeft(ms)` for countdown displays.

---

### Phase 2: Question Engine & Admin Authoring (`admin.html` / `admin.js`)

- **Task 2.1: Multi-Format Authoring Form**:
  - Support 8 user-facing formats: Fill in the Blanks, Statement Correct, Reasoning, Multiple Choice, Matching, Q&A, Video, Sound.
  - Build dynamic subform visibility switching based on selected question type.
  - Implement auto-population of standard Assertion-Reasoning options.

- **Task 2.2: Deterministic Matching Pairs PRNG**:
  - Implement Xorshift linear congruential generator seeded by `lot.id * 2654435761`.
  - Ensure left-hand column stays in authored order while right-hand column is shuffled identically on every client.

- **Task 2.3: Media Embedding Subsystem**:
  - Implement YouTube URL parser extracting 11-character video IDs.
  - Render privacy-enhanced embed (`youtube-nocookie.com`) or HTML5 `<video>` / `<audio>` controls based on media MIME/URL pattern.

- **Task 2.4: Staging & Draft Management**:
  - Implement "Save to prepared questions" storing unreleased lots in `state.drafts`.
  - Implement "Release" action converting drafts to live lots with countdown timestamps initiated upon release.

---

### Phase 3: Bidding & Competing Team Client (`index.html` / `bidder.js`)

- **Task 3.1: Team Identity & Baseline Lock-in**:
  - Team name registration input with automatic avatar initial.
  - Optional one-time point entry allowing teams to set their initial balance, then locking the input to read-only.
  - Leaderboard rank badge reflecting live standing among registered teams.

- **Task 3.2: Catalog Navigation & Search**:
  - Search bar filtering by topic, subject line, difficulty, or question number.
  - Filter toggle buttons (All questions vs. Open for bids).
  - Responsive Hero card displaying public metadata (Topic, Subject, Difficulty, Type, Hint teaser).

- **Task 3.3: Bidding Modal & Anti-Sniping**:
  - Bid modal displaying current top bid, required minimum increment, and available balance.
  - Quick-bid buttons calculating step raises ($+1\times$, $+2\times$, $+4\times$ minimum raise, and Max Available).
  - Atomic validation checking solvency against current state on submission.
  - Anti-sniping rule: extend `lot.endsAt` by $+30$ seconds if bid placed within final 30 seconds.

---

### Phase 4: Progressive Disclosure & Answering Workflow

- **Task 4.1: Prompt Secrecy & Progressive Unlocking**:
  - Enforce client-side secrecy: during `bidding`, render placeholder graphic (`Q<id>`); withhold prompt text, options, and media.
  - When phase transitions to `answering`, unlock prompt and interactive input exclusively if `topBid.name === currentTeam`.
  - Display non-interactive waiting indicator for non-winning teams.

- **Task 4.2: Interactive Answer Submission**:
  - Text input for `blank` and `qa` formats.
  - Dropdown selection list for `matching` format.
  - 4-button option grid for `mcq`, `statement`, and `reasoning` formats.
  - Lock-in button submitting answer record to `state.answers`.

- **Task 4.3: Automated Grading & Settlement**:
  - Exact match grading with case folding, space trimming, and punctuation normalization.
  - Instant reward ($+\text{Bid}$) or penalty ($-\text{Bid}$) application.
  - Instant solution reveal across team and projector screens upon settlement.

---

### Phase 5: Audience & Projector Scoreboard (`live.html` / `live.js`)

- **Task 5.1: Stage Auto-Following Logic**:
  - Automatically feature the lot currently open for bids (earliest ending first).
  - If no lots are in bidding, feature the lot currently being answered.
  - If all active lots are concluded, feature the most recently settled lot.
  - Allow manual override via navigation arrows and auto-follow toggle (`A` key).

- **Task 5.2: Live Visual Bid Ladder**:
  - Render stacked horizontal bar visualization of all placed bids per lot.
  - Display leader badge, escrowed point chips, and outbid badges.
  - Highlight newly placed bids with entry animation (`.fresh`).

- **Task 5.3: Visual Alerts & Fullscreen Mode**:
  - Flash notification banner for state transitions (new high bid, answer submitted, correct/wrong outcome).
  - Fullscreen toggle button (`F` key) with responsive layout scaling (`clamp()`).

---

### Phase 6: Administration & Governance Controls (`admin.html` / `admin.js`)

- **Task 6.1: Passcode Gate**:
  - Gate administrative panel behind passcode (`MrKrsna`) with `sessionStorage` persistence (`pmm3-admin = "1"`).

- **Task 6.2: Team Roster Operations**:
  - Table displaying registered teams, entered points, locked points, and bids placed.
  - Inline points adjustment: recalculate base score so total equals admin input.
  - Team rename operation: rename team in roster, base overrides, and cascades across all past bid and answer records.
  - Team removal operation: purge team from roster, remove associated bids and answers, and record in `state.removed`.

- **Task 6.3: Global Event Reset & Epoch Broadcast**:
  - "Reset everything" button clearing all lots, bids, answers, and team rosters while preserving starting points and drafts.
  - Update `state.epoch` timestamp to signal all open client tabs to flush local team sessions.

---

### Phase 7: Verification, Hardening & Compliance

- **Task 7.1: Concurrency & Storage Reliability**:
  - Verify zero-latency reactivity via `window.onstorage` events across concurrent browser windows.
  - Prevent Hero view redraw while a user is actively typing or selecting matching pairs.
  - Test browser storage quota limits and graceful toast error notifications on full storage.

- **Task 7.2: Standards Compliance**:
  - **HTML Validation**: Enforce uppercase `<!DOCTYPE html>`, explicit input types, and absence of inline styles (`html-validate`).
  - **Accessibility**: Ensure table headers contain discernible text (`empty-table-header` in axe-linter), form labels have associated controls, and color contrast meets WCAG AA standards.
  - **CSS Vendor Prefixes**: Ensure correct prefix ordering (`-moz-appearance` before `appearance`, `-webkit-line-clamp` before `line-clamp`, and `-webkit-backdrop-filter` for Safari compatibility).
  - **Markdown Standards**: Enforce MD022, MD032, and MD040 across all project documentation.

---

## 4. Test Matrix & Acceptance Criteria

| ID | Test Scenario | Execution Steps | Expected Outcome | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Solvency Enforcement | Team with 1,000 pts bids 600 pts on Q1; attempts to bid 500 pts on Q2. | System blocks bid on Q2; informs user only 400 pts are available. | Cannot over-commit balance across concurrent open lots. |
| **TC-02** | Anti-Sniping Trigger | Bid placed with 15 seconds remaining on bidding countdown. | Timer automatically increases from 0:15 to 0:45. | `endsAt` extended by exactly 30,000 ms. |
| **TC-03** | Progressive Disclosure | Question in `bidding` phase. | Only topic, difficulty, type, and hint teaser visible; question prompt text and media remain unrendered in DOM. | Inspecting DOM reveals no question text or solution. |
| **TC-04** | Winner-Only Answering | Q1 bidding closes; Team A wins bid. Team B views Q1. | Team A sees unlocked prompt, input control, and answer timer. Team B sees "Waiting for Team A" disabled CTA. | Non-winning teams cannot view or submit answers. |
| **TC-05** | Text Answer Normalization | Accepted answer is `Disintegration`. User submits `disintegration .`. | Whitespace trimmed, lowercase converted, trailing punctuation stripped; answer marked correct. | Winner awarded $+\text{Bid}$ points immediately. |
| **TC-06** | Shuffled Matching Pairs | Admin creates matching question with 4 pairs. | Right-hand column items appear in identical randomized order on both Team and Projector screens. | Right-hand index order deterministic per `lot.id`. |
| **TC-07** | Admin Team Rename | Admin renames "Alpha" to "Apex". | Team page updates to "Apex"; all historical bids, answers, and leaderboard ranks maintain continuity. | No orphaned bid or answer records under old name. |
| **TC-08** | Epoch Reset Cascade | Admin clicks "Reset everything". | Competing team tabs automatically flush `pmm3-team` and return to the registration prompt without manual page reload. | `syncEpoch()` handles state transition seamlessly. |

---

## 5. Risk Assessment & Mitigation Matrix

| Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Storage Quota Exceeded** | High | Low | Large media files (videos/audio) are referenced via external `https://` URLs rather than local base64 blobs; `save()` is guarded by `try...catch` with user toast alerts. |
| **Concurrent Edit Collisions** | Medium | Medium | Single-tab admin control model; `activeElement` checks prevent DOM overwrites while users are actively typing. |
| **Timer Skew Across Tabs** | Low | Low | All countdown timers calculate delta relative to synchronized wall-clock timestamps (`endsAt - Date.now()`) rather than relying on decoupled countdown decrements. |
| **Participant Screen Peek** | High | Medium | Full question prompt and media remain completely absent from the client DOM until the lot transitions to `answering` and winner identity matches. |

---

## 6. Migration Blueprint to Distributed Cloud Backend

To scale beyond a single-machine multi-window display to distributed participants across personal smartphones or laptops:

```text
+-----------------------------------------------------------------------------------+
|                            Current (Local Storage)                                |
|   Client Tabs <---> store.js (localStorage) <---> Web Storage Event               |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Migration Steps
                                          v
+-----------------------------------------------------------------------------------+
|                          Future (Cloud-Native Server)                             |
|   1. Data Layer: Replace load() / save() with Firestore onSnapshot / WebSockets   |
|   2. Concurrency: Implement Firestore RunTransaction for atomic bid commits       |
|   3. Auth: Replace client passcode with Firebase Auth (Admin custom claims)       |
|   4. Media: Upload files directly to Cloud Storage (GCS / S3) with signed URLs    |
+-----------------------------------------------------------------------------------+
```
