# Architecture Specification: Pharmaceutics Mastery Matrix 3 (PMM 3)

## 1. Executive Summary & Architectural Goals

The **Pharmaceutics Mastery Matrix 3 (PMM 3)** platform is a specialized, zero-backend, multi-view real-time quiz auction engine. It directly addresses the operational bottlenecks identified in [`doc/problemstatement.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/problemstatement.md) by automating:

1. **Strategic Bidding & Point Escrow**: Strict solvency enforcement, multi-lot point locking, and automatic anti-sniping bid extensions.
2. **Pre-Briefing Secrecy & Progressive Disclosure**: Multi-format question metadata display during bidding while withholding prompts and media until an auction winner is established.
3. **Automated Multi-Modal Evaluation**: Instant grading across eight distinct question formats mapped to three evaluation engines (Single Choice, Text Normalization, and Deterministic Pair Matching).
4. **Cross-Tab Multi-Screen Orchestration**: Zero-latency synchronization across three specialized client interfaces on a single browser instance using the Web Storage API and DOM event listeners.

```text
+-----------------------------------------------------------------------------------+
|                                 Shared State                                      |
|            Browser localStorage [Key: 'pmm3-v1']  <-->  Window Storage Events      |
+-----------------------------------------------------------------------------------+
          ^                                  ^                                  ^
          | (Read / Write)                   | (Read / Write)                   | (Read-Only)
          v                                  v                                  v
+-----------------------+          +-----------------------+          +-----------------------+
|      Quiz Master      |          |    Competing Teams    |          |   Projector / Hall    |
|      admin.html       |          |      index.html       |          |       live.html       |
|      (admin.js)       |          |      (bidder.js)      |          |       (live.js)       |
+-----------------------+          +-----------------------+          +-----------------------+
| - Passcode gate       |          | - Team registration   |          | - Auto-following main |
| - Starting pts config |          | - Wallet lock-in      |          | - Live bid ladder     |
| - Team roster mgmt    |          | - Search & filtering  |          | - Locked points chip  |
| - Question authoring  |          | - Bid dialog modal    |          | - Leaderboard rank    |
| - Draft release / end |          | - Answering interface |          | - Solution reveal     |
+-----------------------+          +-----------------------+          +-----------------------+
```

---

## 2. System Topology & View Separation

The system divides responsibilities among three distinct user interfaces served by a static file delivery structure and bound by shared core utilities:

### 2.1 Quiz Master Interface (`admin.html` / `admin.js`)

- **Role**: Event administrator and adjudicator.
- **Access Gate**: Client-side passcode protection (`MrKrsna` stored in `sessionStorage`).
- **Core Capabilities**:
  - Configure global starting balance (`startPts`, default: `1,000` points).
  - Manage registered teams: override total point balances, rename teams across the ledger, or remove teams (purging associated bids and answers).
  - Author and configure live or prepared draft question lots across 8 distinct formats.
  - Release prepared drafts into live auction mode on demand.
  - Manually terminate active bidding timers or reset the entire event ledger.

### 2.2 Competing Team Interface (`index.html` / `bidder.js`)

- **Role**: Participant bidding terminal and answering portal.
- **Core Capabilities**:
  - Register team identity into the shared roster.
  - Optional one-time declaration/lock-in of custom baseline scores (`base[team]`).
  - Search and filter questions by status (all vs. open for bids), topic, and difficulty.
  - Real-time spendable wallet tracking, showing total score, committed/locked points, and leaderboard rank.
  - Modal bid placement with dynamic step increments and quick-bid calculators.
  - Interactive answer entry (exclusive to the winning bidder during the answering window).

### 2.3 Projector / Audience Interface (`live.html` / `live.js`)

- **Role**: High-visibility hall display for audience and participants.
- **Core Capabilities**:
  - Automatic focus tracking that transitions between active bidding, active answering, and recent settled lots.
  - Visual bid ladder showing relative stake sizes, leader highlighting, and escrowed points.
  - Live synchronized countdown timers with milliseconds-level accuracy.
  - Full-screen mode toggle and flash notification banners for bid state changes.
  - Full solution reveal (correct choices, accepted answers, matching pairs, and media playback) upon lot resolution.

### 2.4 Shared Core Module (`store.js`)

- Contains all pure state transition functions, economic balance calculations, phase resolution logic, string normalization, and data serialization helpers.

---

## 3. Data Architecture & Schema Definition

State is structured as a unified JSON object persisted under the localStorage key `pmm3-v1`.

### 3.1 Root State Object

```typescript
interface AppState {
  nextId: number;              // Auto-incrementing identifier for live lots
  startPts: number;            // Global default points for newly registered teams
  lots: QuestionLot[];         // All active, answering, or settled question lots
  bids: BidRecord[];           // Append-only ledger of all placed bids
  answers: AnswerRecord[];     // Ledger of submitted answers
  base: Record<string, number>;// Custom baseline overrides keyed by normalized team name
  epoch: number;               // Timestamp marker used to trigger client-side cache resets
  roster: string[];            // Registered team names
  renamed: TeamRenameEntry[];  // History of admin rename mappings: { from, to }
  removed: Record<string, number>; // Timestamps of admin-removed teams
  drafts: DraftQuestion[];     // Prepared questions held in staging
  nextDraft: number;           // Auto-incrementing identifier for draft lots
}
```

### 3.2 Question Lot Schema (`QuestionLot`)

```typescript
interface QuestionLot {
  id: number;                  // Unique lot identifier (e.g., 1, 2, 3)
  type: QuestionType;          // "blank" | "statement" | "reasoning" | "aptitude" |
                               // "matching" | "qa" | "video" | "sound"
  mode: EvaluationMode;        // "mcq" | "text" | "match"
  topic: string;               // Public topic (max 60 chars)
  subject: string;             // Public subject line (max 60 chars)
  hint?: string;               // Optional public teaser (max 300 chars)
  difficulty: "Easy" | "Medium" | "Hard";
  q: string;                   // Hidden prompt text revealed after bidding
  opts?: string[];             // 4 options for MCQ mode
  correct?: number;            // Index of correct option (0-3) for MCQ mode
  accept?: string[];           // Array of acceptable strings for text mode
  pairs?: MatchingPair[];      // Array of { l: string, r: string } for match mode (2 to 6)
  media?: string;              // External URL for video/audio questions
  start: number;               // Starting bid in points (min: 1)
  inc: number;                 // Minimum raise increment in points (min: 1)
  mins: number;                // Bidding duration in minutes
  answerSecs: number;          // Time window allowed for answer in seconds
  endsAt: number;              // Timestamp (epoch ms) when bidding closes
}
```

### 3.3 Transaction Records

```typescript
interface BidRecord {
  lotId: number;               // Target question lot ID
  name: string;                // Raw team name
  amount: number;              // Bid amount staked
  at: number;                  // Timestamp (epoch ms) of placement
}

interface AnswerRecord {
  lotId: number;               // Associated lot ID
  name: string;                // Answering team name
  choice: number | string | number[]; // Index (MCQ), text (String), or index array (Match)
  at: number;                  // Timestamp (epoch ms) of submission
}
```

---

## 4. Finite State Machine & Question Lifecycle

Every question lot progresses through a strictly deterministic set of states computed via `phase(lot)`:

```text
                  +------------------------+
                  |  Prepared Lot (Draft)  |
                  +------------------------+
                               |
                               | Admin releases draft
                               v
                  +------------------------+
                  |      Bidding Open      | <----+ (Anti-sniping:
                  +------------------------+      |  Bid within final 30s
                               |                  |  adds +30s to endsAt)
             +-----------------+-----------------+
             | (endsAt reached)                  | (endsAt reached)
             | Leading bid exists                | No bids placed
             v                                   v
+------------------------+          +------------------------+
|    Awaiting Answer     |          |      Unsold Lot        |
+------------------------+          |   (Terminal State)     |
             |                      +------------------------+
             | Answer submitted OR
             | answerBy timer reached
             v
+------------------------------------------------------------+
|                      Terminal States                       |
|   +-------------------+  +-------------------+  +----------+
|   | Answer Correct    |  | Answer Incorrect  |  | Time Out |
|   | (+Bid Pts gained) |  | (-Bid Pts lost)   |  | (-Bid)   |
|   +-------------------+  +-------------------+  +----------+
+------------------------------------------------------------+
```

### 4.1 State Definitions & Transition Criteria

1. **`drafts`**: Question resides in `state.drafts`. Not visible to teams (`index.html`) or audience (`live.html`).
2. **`bidding`**: Active when `lot.endsAt > Date.now()`.
   - Teams place bids that stake and lock their points.
   - Question prompt, options, and media remain strictly hidden.
3. **`answering`**: Entered when `lot.endsAt <= Date.now()` and at least one bid was placed, provided `Date.now() < lot.endsAt + (lot.answerSecs * 1000)` and no answer has been submitted yet.
   - Only the highest bidder sees the unlocked prompt, options, or media input.
   - All other teams and the projector see an "Answering in progress" banner.
4. **`correct`**: Entered when winning team submits an answer matching the validation logic. Bid amount is rewarded.
5. **`wrong`**: Entered when winning team submits an answer failing validation. Bid amount is deducted.
6. **`timeout`**: Entered when `Date.now() >= lot.endsAt + (lot.answerSecs * 1000)` without an answer submission. Bid amount is deducted.
7. **`unsold`**: Entered when `lot.endsAt <= Date.now()` and `state.bids` contains zero bids for this lot. No score changes occur.

---

## 5. Economic Engine: Balance, Escrow & Anti-Sniping

### 5.1 Point Calculation Formulae

A team's economic state is governed by three primary values:

#### Base Allocation

```text
BasePoints(Team) = base[nk(Team)] != null ? base[nk(Team)] : startPts
```

*(where `nk(s) = String(s).trim().toLowerCase()`)*

#### Settled Net Score

```text
Settled(Team) = SUM( Outcome(Lot) )
```

$$\text{Outcome}(\text{Lot}) = \begin{cases} +\text{BidAmount}, & \text{if phase} = \text{"correct"} \\ -\text{BidAmount}, & \text{if phase} \in \{\text{"wrong"}, \text{"timeout"}\} \\ 0, & \text{otherwise} \end{cases}$$

#### Total Current Score

$$\text{TotalPoints}(\text{Team}) = \text{BasePoints}(\text{Team}) + \text{Settled}(\text{Team})$$

#### Committed (Escrowed) Points

A team's points are locked if they hold the leading bid on any lot currently in `bidding` or `answering` phase:

$$\text{Committed}(\text{Team}, \text{exceptId}) = \sum_{\substack{\text{Lot} \neq \text{exceptId} \\ \text{Leader}(\text{Lot}) = \text{Team} \\ \text{Phase}(\text{Lot}) \in \{\text{"bidding"}, \text{"answering"}\}}} \text{TopBid}(\text{Lot})$$

#### Available (Spendable) Points

$$\text{Available}(\text{Team}, \text{targetLotId}) = \text{TotalPoints}(\text{Team}) - \text{Committed}(\text{Team}, \text{targetLotId})$$

### 5.2 Bid Validation Invariants

A bid of size $B$ on `lot` by `team` is valid if and only if:

1. $\text{Phase}(\text{lot}) = \text{"bidding"}$
2. $\text{TopBid}(\text{lot}).\text{name} \neq \text{team}$ (a team cannot outbid itself)
3. $B \ge \text{MinNext}(\text{lot})$: where $\text{MinNext}(\text{lot}) = \text{TopBid}(\text{lot}).\text{amount} + \text{lot.inc}$ (or $\text{lot.start}$ if there are no existing bids)
4. $B \le \text{Available}(\text{team}, \text{lot.id})$

### 5.3 Anti-Sniping Extension Rule

To prevent automated or last-millisecond bid sniping:

```javascript
if (lot.endsAt - Date.now() < 30000) {
  lot.endsAt += 30000; // Extend deadline by exactly 30 seconds
}
```

---

## 6. Question Evaluation Engines

The platform maps 8 user-facing question types into 3 core programmatic validation engines:

| Question Type | Category | Engine | Verification Algorithm |
| :--- | :--- | :--- | :--- |
| **Fill in the Blanks** (`blank`) | Textual | `text` | Normalizes answer string (lowercase, trim whitespace, strip trailing periods). Matches against any pipe-separated value in `accept`. |
| **Statement Correct** (`statement`) | Multiple Choice | `mcq` | Strict equality: `choice === lot.correct` (index `0`–`3`). |
| **Reasoning** (`reasoning`) | Multiple Choice | `mcq` | Pre-populates 4 standard assertion-reasoning options; verifies selected index `0`–`3`. |
| **Multiple Choice** (`aptitude`) | Multiple Choice | `mcq` | Standard 4-choice index match: `choice === lot.correct`. |
| **Matching** (`matching`) | Relational | `match` | Uses deterministic PRNG shuffle for right-hand column; verifies that submitted indices array satisfies `choice[i] === i` for all pairs. |
| **Question and Answer** (`qa`) | Textual | `text` | Normalized substring match against `lot.accept` array. |
| **Video Analysis** (`video`) | Multi-Modal | `mcq` / `text` | Unlocks YouTube iframe or native HTML5 `<video>`; evaluates via chosen mode. |
| **Audio Identification** (`sound`) | Multi-Modal | `mcq` / `text` | Unlocks native HTML5 `<audio>` or compact player; evaluates via chosen mode. |

### 6.1 Deterministic Shuffling for Matching Questions

Matching items are shuffled identically across all clients using a linear congruential / xorshift PRNG seeded by the unique `lot.id`:

```javascript
function matchOrder(lot) {
  const idx = lot.pairs.map((_, i) => i);
  let x = ((lot.id * 2654435761) >>> 0) || 1;
  const rnd = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
```

---

## 7. Synchronization & Concurrency Model

### 7.1 Cross-Tab Reactivity Mechanism

1. **Storage Event Bus**: Every modification executes `save(state)`, updating localStorage key `pmm3-v1`. Browsers fire the `window.onstorage` event in all other open tabs within 0–2 ms.
2. **Re-render Throttling & Input Safety**:
   - Competing team tabs do not overwrite the hero view if a student is actively typing into an answer input (`activeElement.matches("[data-text], [data-match]")`).
   - Quiz Master view does not redraw the team points input while focused.
3. **Timer Reconciliation**: A recurring 1,000 ms interval runs across all views to decrement active timers and trigger status transitions as `Date.now()` passes `endsAt` or `answerBy`.

### 7.2 Administrative Event Reset Propagation

When an administrator triggers "Reset everything" (`#resetAll`):

1. `state.epoch` is set to `Date.now()`.
2. Competing team windows listen to `syncEpoch()` on storage change.
3. If `localStorage.getItem("pmm3-epoch") !== state.epoch`, client instances flush their local team session (`localStorage.removeItem("pmm3-team")`) and return to registration mode.

---

## 8. Security, Integrity & Sanitization Architecture

- **HTML Injection & XSS Prevention**: All user inputs (team names, custom points, topics, text answers) pass through the `esc()` sanitization helper before interpolation into template strings.
- **Passcode Protection**: Admin actions are gated by `ADMIN_PASSCODE` in `sessionStorage` (`pmm3-admin = "1"`).
- **Answer Privacy**: Unsolved prompts, media links, and options are never injected into the DOM of unprivileged views (`index.html` non-winners or `live.html` during bidding).

The global sanitization routine applied to all dynamic content:

```javascript
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
```

---

## 9. Future Scalability & Cloud Migration Pathway

As identified in Section 5 of [`doc/problemstatement.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/problemstatement.md), transitioning from a single-machine local setup to multi-device network deployment requires replacing the localStorage persistence layer:

```text
[Current Architecture: Zero-Setup Single-Host]
DOM UI Layer <---> store.js (load / save) <---> Browser localStorage

                                    |
                                    | (Future Migration)
                                    v

[Cloud-Native Distributed Architecture]
Client Interfaces (Web / Mobile)
       |
       | HTTPS / WSS
       v
API Gateway & Authentication Service (JWT / Firebase Auth)
       |
       +---> Real-time Database (Firestore / PostgreSQL + Redis PubSub)
       |
       +---> Cloud Object Storage (S3 / GCS for Video and Audio Blobs)
```

1. **State Store Abstraction**: Replace `load()` and `save()` in `store.js` with WebSocket messages or Firestore snapshot listeners (`onSnapshot`).
2. **Atomic Bid Execution**: Implement server-side transactions to eliminate concurrency race conditions when two teams bid on the exact same millisecond.
3. **Role-Based Authentication**: Replace client-side passcode gating with verified session tokens.
