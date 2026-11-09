# Edge Case Specification: Pharmaceutics Mastery Matrix 3 (PMM 3)

## 1. Overview & Purpose

This document provides a comprehensive analysis of boundary conditions, edge cases, failure modes, and recovery procedures across the **Pharmaceutics Mastery Matrix 3 (PMM 3)** quiz auction platform. It complements [`doc/problemstatement.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/problemstatement.md), [`doc/architecture.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/architecture.md), and [`doc/implementation-plan.md`](file:///c:/Users/Dell/OneDrive/Desktop/Bidding%20Interface/doc/implementation-plan.md).

The edge cases are categorized into six functional domains:

1. Economic Solvency & Escrow Boundaries
2. Auction Timing, Anti-Sniping & Concurrency
3. Multi-Modal Answering & Grading Normalization
4. Cross-Tab Reactivity & Active State Protection
5. Administrative Governance & Roster Cascades
6. Storage Limits, Corruption & Security Failsafes

---

## 2. Domain 1: Economic Solvency & Escrow Boundaries

```text
+-----------------------------------------------------------------------------------+
| Total Points = Base Points + Settled Outcomes                                     |
| Committed Points = SUM(Leading Bids on Active Lots)                               |
| Available Points = Total Points - Committed Points (excluding target lot)         |
+-----------------------------------------------------------------------------------+
```

### 1.1 Self-Outbidding Prevention

- **Scenario**: A team currently holds the highest bid on Lot 3 and attempts to place another bid on Lot 3.
- **Trigger**: User opens bid dialog or executes `placeBid()` while `topBid(lot.id).name === currentTeam`.
- **System Behavior**: Modal button triggers toast `"You are already leading this question"`, and `placeBid()` halts with error `"You are already leading this question."`.
- **Invariable Guarantee**: A team can never lock additional points against itself on the same lot.

### 1.2 Multi-Lot Escrow Over-Commitment

- **Scenario**: Team has 1,000 points. They bid 600 points on Lot 1 (active leader). On Lot 2 (starting at 500 points), they attempt to bid 500 points.
- **Trigger**: User clicks "Place bid" on Lot 2.
- **Calculation**: $\text{Committed}(\text{Team}, \text{exceptLot2}) = 600$, $\text{Available}(\text{Team}, \text{exceptLot2}) = 1,000 - 600 = 400$, while $\text{Required Minimum} = 500$.
- **System Behavior**: System blocks dialog launch or sets error: `"Not enough points. You have 400 free; the minimum bid is 500."`.
- **Invariable Guarantee**: Teams cannot commit more than 100% of their net point balance across concurrent lots.

### 1.3 Re-Bidding on a Lot Where the Team Was Previously Outbid

- **Scenario**: Team A bids 200 on Lot 1. Team B raises to 250 (Team A is now outbid). Team A wants to raise to 300.
- **Trigger**: Calculation of `available("Team A", 1)`.
- **Calculation**: Because Team A is no longer `topBid(1)`, their committed points on Lot 1 drop to 0. Their full 1,000 points are available to re-enter the auction.
- **System Behavior**: Bid placement succeeds; Team A locks 300 points upon submission.

### 1.4 Solvency During Negative Settled Balances (Bankruptcy)

- **Scenario**: Team starts with 1,000 points, bids 800 on Lot 1, and answers incorrectly ($-800$, net score: 200). On Lot 2, they bid 200 and answer incorrectly ($-200$, net score: 0). They now attempt to bid on Lot 3.
- **Trigger**: Attempting to bid when $\text{AvailablePoints} \le 0$.
- **System Behavior**: Minimum bid for any lot is at least $\ge 1$ point. The system prevents opening the bid modal with toast `"Not enough points. You have 0 free; the minimum bid is 50."`.
- **Invariable Guarantee**: Bankrupt teams with zero or negative points cannot place bids until their score increases.

### 1.5 Admin Adjustments to Global Starting Points Mid-Event

- **Scenario**: Quiz Master changes global starting points from 1,000 to 1,500 after 3 teams have registered and 2 have locked in custom scores.
- **Trigger**: Quiz Master modifies `#sPts` and clicks "Save".
- **System Behavior**: Teams with locked custom scores (`entered(name) === true`) remain unchanged ($\text{Base} = \text{base}[name]$). Unlocked teams dynamically shift their base to 1,500.
- **Admin Warning**: The interface explicitly displays: `"Change this before teams start bidding. Changing it later shifts the score of every team that has not entered its own points."`.

---

## 3. Domain 2: Auction Timing, Anti-Sniping & Concurrency

```text
       0:45                 0:30                 0:15                 0:00 (endsAt)
---------+--------------------+--------------------+--------------------+
                              | <--- Sniping Window: Bids here trigger ---> |
                              |      endsAt += 30,000 ms extension         |
```

### 2.1 Anti-Sniping Extension Cascade

- **Scenario**: A bidder waits until 5 seconds remain before bidding to prevent competitors from reacting.
- **Trigger**: A valid bid is registered when `lot.endsAt - Date.now() < 30000`.
- **System Behavior**: `lot.endsAt` is extended by 30 seconds (`lot.endsAt += 30000`). This is immediately synchronized across all tabs via `save(state)` and the `storage` event, resetting the countdown timer from 0:05 to 0:35.
- **Multiple Triggers**: If a competitor responds within the final 30 seconds of the newly extended window, another 30 seconds are appended, guaranteeing fair human reaction time.

### 2.2 Unsold Lots (Zero Bids at Expiration)

- **Scenario**: Bidding countdown reaches `00m 00s` with zero bids placed.
- **Trigger**: `phase(lot)` evaluates `!isLive(lot) && !topBid(lot.id)`.
- **System Behavior**: Phase resolves immediately to `"unsold"`. `outcome(lot)` returns `0` (no points deducted). Projector displays `"No bids were placed on this question. The question is closed."`. Hero card displays disabled CTA `"Question closed"`.

### 2.3 Sub-Second Race Condition on Bid Placement

- **Scenario**: Team A and Team B both click "Place bid" with identical amounts within 5 ms of each other.
- **Trigger**: Two `placeBid()` calls on concurrent browser tabs.
- **Resolution**: Tab 1 writes first to `localStorage`. Tab 2 executes `state = load()` at the start of `placeBid()`, observes Tab 1's bid, checks `amount >= minNext(lot)`, and rejects the stale bid with error `"Bid at least X points."`.
- **Invariable Guarantee**: Stale bids are rejected atomically upon execution.

### 2.4 Browser Inactive / Throttled Tab Clock Skew

- **Scenario**: A user minimizes the browser tab or switches mobile apps. Browsers throttle `setInterval` timers in background tabs.
- **Recovery Mechanism**: Timers calculate difference against absolute wall-clock timestamps ($\text{Remaining} = \text{lot.endsAt} - \text{Date.now()}$). When the tab regains focus, the next tick computes the exact current delta immediately, eliminating timer drift.

---

## 4. Domain 3: Multi-Modal Answering & Evaluation Normalization

### 3.1 Text Answer Normalization (Case, Space, Punctuation)

- **Scenario**: Admin sets accepted answers to `Disintegration | disintegration time`.
- **User Submissions**:
  - `"disintegration"` (Correct)
  - `"  DISINTEGRATION   "` (Correct)
  - `"Disintegration."` (Correct)
  - `"disintegration time"` (Correct)
  - `"disintegrate"` (Incorrect)
- **Normalization Algorithm**: All inputs are processed by `normAns()` which trims outer whitespace, converts to lowercase, collapses multiple whitespace runs to single spaces, and strips trailing periods and spaces (`/[.\s]+$/`).
- **Invariable Guarantee**: Extraneous whitespace, uppercase lettering, and trailing full stops never cause false-negative grading.

### 3.2 Matching Question Partial or Duplicate Entries

- **Scenario**: User submits matching pairs where one item is left blank or two left items map to the same right item.
- **Trigger**: Clicking "Lock in answer" on a matching question.
- **Validation**: System checks for missing selections (`c.some((v) => v === null)`) and rejects with toast `"Match every item first"`. System checks for duplicates (`new Set(c).size !== c.length`) and rejects with toast `"Each option can be used only once"`.
- **Invariable Guarantee**: Malformed or incomplete match submissions are blocked before state recording.

### 3.3 Answer Window Expiration (Timeout Penalty)

- **Scenario**: Winning team opens the question but fails to submit an answer before `answerBy(lot)` countdown finishes.
- **Trigger**: `Date.now() >= lot.endsAt + (lot.answerSecs * 1000)` with no answer in `state.answers`.
- **System Behavior**: `phase(lot)` transitions automatically to `"timeout"`. `outcome(lot)` evaluates to `-top.amount`. Points are deducted from the winning team's balance, and the question and solution are revealed publicly across all screens.

### 3.4 External Media Load Failure or Broken URL

- **Scenario**: YouTube video is deleted or external audio link returns 404.
- **Mitigation**: If URL is invalid, `mediaHTML(lot)` returns an empty string, preventing broken object render. Video embeds use lazy loading (`loading="lazy"`) and standard HTML5 video fallbacks. The question prompt text remains visible and legible even if media fails to load.

---

## 5. Domain 4: Cross-Tab Reactivity & Active State Protection

### 5.1 Preservation of In-Progress User Typing

- **Scenario**: Team A is actively typing an answer into `#hero [data-text]`. Meanwhile, Team B places a bid on another question, triggering a global `storage` event.
- **Conflict**: A full page re-render would wipe Team A's typed text.
- **Guard Mechanism**: In `renderHero()`, the system inspects `document.activeElement`. If the focused element matches `#hero [data-text]` or `#hero [data-match]`, the re-render function returns immediately without modifying the DOM.
- **System Behavior**: The hero rendering loop skips DOM replacement while the user holds focus in the answer field, preserving their input.

### 5.2 Preservation of In-Progress Admin Input

- **Scenario**: Quiz Master is typing an adjusted point value into the Registered Teams table when a team submits an answer.
- **Conflict**: Table re-render would overwrite the Quiz Master's unsaved input.
- **Guard Mechanism**: In `renderTeamsSafe()`, the system checks `document.activeElement.closest("#teamRows")`. If the Quiz Master is currently editing any input inside the team rows, redrawing is deferred until focus leaves the table.
- **System Behavior**: Table re-render is deferred until focus leaves `#teamRows`.

---

## 6. Domain 5: Administrative Governance & Roster Cascades

### 6.1 Team Renaming Cascade

- **Scenario**: Admin renames team `"Alpha"` to `"Apex Warriors"` mid-event.
- **Trigger**: Admin clicks "Rename" in the registered teams table.
- **Cascade Routine**:
  1. `state.roster` updates `"Alpha"` $\rightarrow$ `"Apex Warriors"`.
  2. `state.base` key is migrated: `state.base["apex warriors"] = state.base["alpha"]`.
  3. Historical bids updated: `bids.forEach(b => { if (b.name === "Alpha") b.name = "Apex Warriors"; })`.
  4. Historical answers updated: `answers.forEach(a => { if (a.name === "Alpha") a.name = "Apex Warriors"; })`.
  5. Audit entry added to `state.renamed`: `{ from: "Alpha", to: "Apex Warriors" }`.
  6. Competing team tab checks `syncEpoch()` and updates its local team session without requiring manual re-login.

### 6.2 Team Removal Cascade

- **Scenario**: A registered team enters an offensive name or disconnects; Admin removes the team.
- **Trigger**: Admin clicks "Remove" on team row.
- **Cascade Routine**:
  1. Team removed from `state.roster` and `state.base`.
  2. All historical bids and answers placed by this team are filtered out.
  3. `state.removed[teamKey] = Date.now()` is set.
  4. Team tab sees removal marker in `syncEpoch()` and flushes local storage key `pmm3-team`, resetting view to onboarding screen.
- **Impact on Active Lots**: Any question previously led by this team recalculates `topBid` to the next highest remaining bid, or transitions to `unsold` if no other bids exist.

### 6.3 Event Reset Cascade (`#resetAll`)

- **Scenario**: Admin resets event before finals.
- **Trigger**: Admin clicks "Reset everything".
- **Preserved**: Global starting points (`startPts`), prepared drafts (`drafts`, `nextDraft`).
- **Purged**: All live lots, bids, answers, roster entries, custom point bases.
- **Broadcast**: `state.epoch = Date.now()`.
- **Client Synchronization**: Every connected client compares its local `pmm3-epoch` with `state.epoch`. If different, client storage (`pmm3-team`) is wiped and the view returns to sign-in.

---

## 7. Domain 6: Storage Limits, Corruption & Security Failsafes

### 7.1 LocalStorage Quota Exceeded

- **Scenario**: Browser storage reaches quota limit (typically 5 MB).
- **Trigger**: Admin attempts to add a question or team attempts to bid.
- **Failsafe**: If `save(state)` throws an exception or fails, the pending mutation is reverted in memory (e.g. `state.lots.pop()`) and a toast notifies the user: `"Could not save. Browser storage may be full."`.
- **System Behavior**: Failed write triggers an in-memory rollback and informs the user via toast notification. State remains consistent.

### 7.2 Corrupted Storage JSON

- **Scenario**: Malformed JSON injected into localStorage key `pmm3-v1`.
- **Failsafe**: In `load()`, JSON parsing is wrapped in a `try...catch` block. If parsing throws an exception, the function catches it and returns a freshly initialized default state from `blank()`.
- **System Behavior**: Corrupted data triggers `catch` block and returns a clean default state from `blank()`, preventing crash loops.

### 7.3 Cross-Site Scripting (XSS) Sanitization

- **Scenario**: Malicious user registers team as `<script>alert('hack')</script>` or enters HTML payloads in question topics or text answers.
- **Failsafe**: All dynamic string interpolations pass through the `esc()` sanitizer, converting `&`, `<`, `>`, `"`, and `'` into their corresponding HTML character entities before being injected into innerHTML template literals.
- **System Behavior**: HTML characters are encoded as entities (`&lt;script&gt;`), rendering harmless text.

---

## 8. Summary Matrix of Edge Cases

| Domain | Edge Case | Guard / Recovery | User Impact |
| :--- | :--- | :--- | :--- |
| **Solvency** | Self-outbidding | Checked in UI and `placeBid()` | Blocks action; shows toast alert. |
| **Solvency** | Multi-lot escrow limit | `available(team, lot.id)` validation | Prevents over-committing points. |
| **Solvency** | Zero/Negative balance | Min bid $\ge 1$; checked against `free` | Blocks bidding dialog. |
| **Timing** | Late bid sniping | Extends `endsAt` by $+30$ seconds | Guarantees human reaction window. |
| **Timing** | Unsold lot expiration | `phase()` detects 0 bids; marks `unsold` | Closes lot with 0 point change. |
| **Timing** | Inactive tab sleep | Wall-clock delta calculation | Zero countdown timer drift. |
| **Evaluation** | Fuzzy text answers | `normAns()` trims case, space, dots | Eliminates false-negative grading. |
| **Evaluation** | Matching duplicates | Checked with `Set(choices).size` | Blocks submission until valid. |
| **Evaluation** | Answer timeout | Evaluated as `"timeout"` penalty | Deducts bid amount; reveals answer. |
| **Reactivity** | Input wiping on sync | `activeElement` focus check | Preserves user typing in inputs. |
| **Governance** | Admin rename team | Multi-table cascade update | Seamless name transition. |
| **Governance** | Global event reset | `epoch` timestamp broadcast | Clears all connected client sessions. |
| **Storage** | Quota full | `save()` boolean check + rollback | Notifies user; avoids corruption. |
| **Security** | XSS injection | Global `esc()` entity encoding | Renders safe plain text. |
