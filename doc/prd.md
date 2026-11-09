# Product Requirements Document (PRD): Pharmaceutics Mastery Matrix 3 (PMM 3)

## 1. Document Overview & Version Control

- **Product Name**: Pharmaceutics Mastery Matrix 3 (PMM 3) — Live Quiz Bidding & Evaluation Platform
- **Document Version**: 1.0.0
- **Document Status**: Final / Approved
- **Reference Documentation**:
  - Problem Statement: [`doc/problemstatement.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/problemstatement.md)
  - System Architecture: [`doc/architecture.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/architecture.md)
  - Implementation Plan: [`doc/implementation-plan.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/implementation-plan.md)
  - Edge Case Analysis: [`doc/edgecase.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/edgecase.md)

---

## 2. Product Vision & Executive Summary

### 2.1 Vision Statement

To transform traditional academic quiz competitions in pharmaceutical education from passive turn-taking into a dynamic, strategic point-auction arena. PMM 3 enables teams to evaluate metadata teasers, stake points through competitive bidding, and earn rewards or incur penalties based on deterministic real-time question evaluation.

### 2.2 Core Value Proposition

- **Zero-Setup Single-Host Topology**: Fully operational out of the box using static web technologies without requiring database setup, backend servers, or internet dependencies for single-laptop event projection.
- **Strict Economic Solvency**: Dynamic escrow engine that prevents teams from committing more points than their spendable balance across concurrent auction lots.
- **Progressive Pre-Briefing Secrecy**: Question topic, difficulty, format, and teaser hints are public during bidding; prompts, media, and answer choices unlock only for the winning bidder.
- **Automated Multi-Modal Evaluation**: Instant, deterministic grading across eight distinct pharmaceutical question formats mapped to three evaluation engines.

---

## 3. User Personas & Journey Maps

```text
+-----------------------+     +-----------------------+     +-----------------------+
|      Quiz Master      |     |    Competing Team     |     |   Audience / Hall     |
|      (admin.html)     |     |      (index.html)     |     |       (live.html)     |
+-----------------------+     +-----------------------+     +-----------------------+
| Authors drafts & sets |     | Registers identity &  |     | Observes big-screen   |
| starting points.      |     | locks initial points. |     | auto-following stage. |
|                       |     |                       |     |                       |
| Releases question to  | --> | Evaluates teaser hint | --> | Watches live ladder,  |
| live bidding window.  |     | and places stakes.    |     | bids, and countdowns. |
|                       |     |                       |     |                       |
| Manages roster points |     | Unlocks question if   |     | Views synchronized    |
| and ends/resets event.|     | won; submits answer.  |     | solution reveal.      |
+-----------------------+     +-----------------------+     +-----------------------+
```

### 3.1 Persona 1: Quiz Master (Administrator)

- **Profile**: Pharmaceutical faculty member or academic event coordinator.
- **Goal**: Maintain full authority over question sequencing, auction pacing, team score corrections, and event lifecycle.
- **Pain Points**: Manual score calculation errors, arguments over buzzer timings, delayed grading disputes.

### 3.2 Persona 2: Competing Team (Bidder)

- **Profile**: Student teams competing in pharmaceutical domain knowledge.
- **Goal**: Strategically allocate point reserves on high-confidence questions, outbid rivals without over-extending, and answer under countdown pressure.
- **Pain Points**: Lack of visibility into available point reserves, confusion over minimum increments, and bid sniping.

### 3.3 Persona 3: Audience & Projector Operator

- **Profile**: Event hall audience, faculty spectators, and non-participating students.
- **Goal**: Follow high-stakes bidding dynamics on a large screen with crystal-clear visibility into who holds the lead, what points are locked, and immediate answer reveals.
- **Pain Points**: Small unreadable fonts, static spreadsheets, and delayed announcements.

---

## 4. Product Scope & Functional Requirements

### 4.1 Epic 1: Economic Engine & Bid Escrow

- **FR-1.1 Starting Allocation**: The system shall initialize new teams with a configurable global starting point balance (default: `1,000` points).
- **FR-1.2 Custom Baseline Entry**: Teams shall be permitted a one-time self-declaration of their initial score (`base[team]`), which immediately locks to read-only upon confirmation.
- **FR-1.3 Solvency Invariant**: A team's available spendable points on a given lot shall be calculated as $\text{AvailablePoints} = \text{BasePoints} + \text{SettledOutcomes} - \text{CommittedPoints}(\text{OtherLots})$.
- **FR-1.4 Escrow Point Locking**: The system shall lock the top bidder's staked points across all open lots in `"bidding"` or `"answering"` phases, unfreezing points only if outbid or upon lot settlement.
- **FR-1.5 Self-Outbid Guard**: The system shall reject any bid from a team that currently holds the highest bid on that same lot.
- **FR-1.6 Outcome Settlement**:
  - Correct answer: Winning bidder gains $+{\text{BidAmount}}$.
  - Incorrect answer or timeout: Winning bidder loses $-{\text{BidAmount}}$.
  - Unsold lot (0 bids): Lot terminates with $0$ point balance changes.

### 4.2 Epic 2: Question Authoring & Staging

- **FR-2.1 Question Types**: The platform shall support eight distinct pharmaceutical assessment formats:
  1. Fill in the Blanks (`blank`)
  2. Statement Correct (`statement`)
  3. Reasoning / Assertion & Reason (`reasoning`)
  4. Multiple Choice Questions (`aptitude`)
  5. Shuffled Matching Pairs (`matching`)
  6. Question and Answer (`qa`)
  7. Watch Video and Answer (`video`)
  8. Guess the Answer by Sound (`sound`)
- **FR-2.2 Pre-Briefing Metadata**: Authors must configure Topic (max 60 chars), Subject line (max 60 chars), Difficulty (Easy/Medium/Hard), and optional Teaser Hint (max 300 chars) visible to all bidders prior to auction completion.
- **FR-2.3 Draft Staging**: Authors shall be able to save authored questions to a local staging queue (`drafts`) that remains hidden from teams and audience displays until explicitly released.
- **FR-2.4 Deterministic Matching Shuffle**: For matching questions, left-hand items shall appear in authored sequence, while right-hand items shall be shuffled deterministically across all client views using a seeded pseudo-random number generator (`matchOrder()`).
- **FR-2.5 Multi-Modal Media Support**: The authoring engine shall embed privacy-enhanced YouTube players (`youtube-nocookie.com`) or native HTML5 `<video>` / `<audio>` controls via external URL references.

### 4.3 Epic 3: Auctioning & Anti-Sniping

- **FR-3.1 Live Catalog & Filtering**: The team interface shall provide real-time search (by topic, subject, difficulty) and toggle filters (All questions vs. Open for bids).
- **FR-3.2 Bid Dialog & Quick Raises**: The bidding modal shall display current top bid, required minimum increment, and provide one-click buttons for $+1\times$, $+2\times$, $+4\times$ minimum raise, and Max Available.
- **FR-3.3 Anti-Sniping Protection**: If a valid bid is placed within the final 30 seconds of an auction (`lot.endsAt - Date.now() < 30000`), the bidding deadline shall be automatically extended by exactly 30 seconds (`endsAt += 30000`).
- **FR-3.4 Manual Early Closure**: The Quiz Master shall have the capability to manually terminate active bidding on any lot via an "End bidding" button.

### 4.4 Epic 4: Answering & Progressive Disclosure

- **FR-4.1 Prompt Secrecy**: Full question prompts, option texts, and media players shall remain strictly omitted from the client DOM during the `"bidding"` window.
- **FR-4.2 Exclusive Winner Unlocking**: When bidding closes with a leading bidder, the question prompt and interactive answer controls shall render exclusively for the winning team during the `"answering"` phase.
- **FR-4.3 Non-Winner Interface**: Non-winning teams shall view a non-interactive status indicating which team won the auction and is currently answering.
- **FR-4.4 Text Answer Normalization**: Text answers shall be graded case-insensitively, with leading/trailing whitespace removed, multiple spaces collapsed, and trailing full stops ignored.
- **FR-4.5 Answer Timeout**: If the winning team fails to lock in an answer before `lot.endsAt + (lot.answerSecs * 1000)`, the system shall automatically record a `"timeout"` penalty ($-{\text{BidAmount}}$) and reveal the correct solution.

### 4.5 Epic 5: Projector & Audience Scoreboard

- **FR-5.1 Auto-Following Stage**: The projector screen (`live.html`) shall automatically follow the earliest-ending lot in `"bidding"` phase, transition to active `"answering"`, and display recent results when idle.
- **FR-5.2 Visual Bid Ladder**: The interface shall render a stacked horizontal ladder of all placed bids per lot, highlighting the leader, escrowed points, and outbid competitors.
- **FR-5.3 Synchronized Countdown**: Digital countdown clocks shall reconcile against absolute timestamps (`endsAt - Date.now()`), avoiding background-tab throttling skew.
- **FR-5.4 Solution Reveal**: Upon settlement (`correct`, `wrong`, `timeout`), the projector shall reveal full question text, media, submitted answer, and correct answers.
- **FR-5.5 Full-Screen Presentation**: The display shall feature a toggleable full-screen mode (`F` key) with fluid typography scaling (`clamp()`).

### 4.6 Epic 6: Governance, Roster Management & Resets

- **FR-6.1 Passcode Gate**: Admin operations shall be protected behind a client-side passcode (`MrKrsna`) persisted in `sessionStorage`.
- **FR-6.2 Registered Teams Roster**: The admin panel shall display all active teams, allowing real-time point overrides, team renames, and team removals.
- **FR-6.3 Renaming & Removal Cascade**: Renaming a team shall automatically update historical bids and answers; removing a team shall purge its bids, answers, and recalibrate top bids on affected lots.
- **FR-6.4 Global Event Reset**: An admin "Reset everything" action shall wipe all lots, bids, answers, and team records while preserving starting points and drafts, broadcasting a timestamped `epoch` marker that flushes all connected client sessions.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance & Latency

- **NFR-1.1 Cross-Tab Sync Latency**: State updates committed via `save()` shall propagate across local browser tabs in $\le 50\text{ ms}$ via the Web Storage API `window.onstorage` event.
- **NFR-1.2 UI Responsiveness**: DOM updates and modal renders shall execute in $\le 16\text{ ms}$ (60 FPS rendering target).

### 5.2 Zero-Backend Portability & Setup

- **NFR-2.1 Runtime Environment**: The platform shall execute entirely within standard modern web browsers (Chrome, Edge, Safari, Firefox) without requiring Node.js, Python, or local web servers.
- **NFR-2.2 Offline Capability**: Core evaluation and bidding functions shall operate without active internet connectivity (with external media links being the sole exception).

### 5.3 Reliability & Fault Tolerance

- **NFR-3.1 Storage Quota Guarding**: Storage operations shall be enclosed in defensive `try...catch` blocks. If `localStorage` quota is exceeded, in-memory rollbacks shall occur and notify the user via toast alert.
- **NFR-3.2 Corrupted State Recovery**: In the event of malformed or corrupted JSON in storage, the system shall safely fall back to a freshly initialized `blank()` state without unhandled fatal crashes.
- **NFR-3.3 Active Typing Focus Shield**: Background storage updates shall not overwrite active input fields (`activeElement.matches("[data-text], [data-match]")`) while a user is typing.

### 5.4 Usability, Design & Accessibility

- **NFR-4.1 Visual Theme**: Dark-mode dashboard theme featuring high-contrast text (`#f5f4fa`), lavender/powder-blue accents, and color-coded status chips (Green for correct, Coral for wrong/penalties).
- **NFR-4.2 Accessibility Compliance**: Form controls must contain explicit `type` attributes, table headers must have discernible non-empty titles (`empty-table-header`), and color contrast must satisfy WCAG 2.1 Level AA standards.
- **NFR-4.3 Cross-Browser CSS Support**: CSS rules must include vendor prefixes in correct order (`-moz-appearance` before `appearance`, `-webkit-line-clamp` before `line-clamp`, and `-webkit-backdrop-filter` for iOS Safari).

### 5.5 Security & Data Sanitization

- **NFR-5.1 HTML Entity Encoding**: All dynamic user inputs (team names, text answers, topics) shall be sanitized through entity encoding (`esc()`) to prevent Stored Cross-Site Scripting (XSS).
- **NFR-5.2 Progressive DOM Isolation**: Unsold question texts, correct option indices, and accepted answers must not be injected into non-winning team DOM trees during active bidding.

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

```text
+-----------------------+----------------------------------+-----------------------+
| Metric                | Target                           | Measurement Method    |
+-----------------------+----------------------------------+-----------------------+
| Solvency Violations   | Exactly 0                        | State ledger audit    |
| Scoring Disputes      | 0 manual grading interventions   | Post-event survey     |
| Average Lot Duration  | 90 - 180 seconds per question    | Timestamp telemetry   |
| Stage Reactivity      | < 50 ms cross-tab sync           | Chrome DevTools trace |
| Setup Duration        | < 60 seconds (zero-install)      | Event host stopwatch  |
+-----------------------+----------------------------------+-----------------------+
```

---

## 7. Out of Scope & Future Evolution (v2.0 Roadmap)

The following capabilities are explicitly out of scope for the v1.0 release and planned for v2.0:

1. **Distributed Cloud Backend**: Multi-device networking across separate physical student phones/laptops (replacing `localStorage` with Firebase Firestore / WebSockets).
2. **Server-Side Authentication**: Secure JWT/OAuth authentication replacing client-side passcode gating.
3. **Local Media Hosting**: Direct file uploading of video and audio blobs via cloud object storage (S3 / GCS) rather than external URLs.
4. **Buzzer Mode Integration**: Real-time millisecond buzzer rounds alongside auction lots.
