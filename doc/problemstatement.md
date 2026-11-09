# Problem Statement: Pharmaceutics Mastery Matrix 3 (PMM 3) — Live Quiz Bidding & Evaluation Platform

## 1. Background and Context

Academic quiz competitions in pharmaceutical education traditionally rely on static, sequential turn-taking, physical buzzers, or manual scoreboards managed on spreadsheets. In competitive events such as **Pharmaceutics Mastery Matrix 3 (PMM 3)**, organizers face operational bottlenecks when running strategic auction-style rounds where teams stake points to win the right to answer domain-specific pharmaceutics questions.

Managing real-time point balances, escrowed (locked) bids across concurrent active questions, dynamic countdown timers, anti-sniping extensions, and multi-modal question formats (text, multiple-choice, assertion-reasoning, matching pairs, audio, and video) manually introduces human error, delays, and a lack of transparency for participating teams and the audience.

## 2. Core Problem Statement

Organizers and participants of live academic quiz auctions lack a unified, low-latency, zero-setup interface that simultaneously supports:

1. **Controlled Question Lifecycle & Pre-Briefing Secrecy**: Allowing teams to evaluate question metadata (topic, subject unit, question format, difficulty level, and optional teaser hint) during the bidding window while keeping the actual question prompt, media, and answer choices strictly hidden until bidding concludes and a winning bidder is determined.
2. **Real-Time Point Escrow & Solvency Enforcement**: Preventing teams from over-committing points across multiple concurrent open lots by dynamically tracking initial allocations, custom starting point overrides, settled gains/losses, and points currently locked in active leading bids.
3. **Multi-Format Question Delivery & Automated Grading**: Supporting diverse pharmaceutics assessment formats—including Fill in the Blanks, Statement Verification, Assertion–Reasoning, Multiple Choice, Shuffled Pair Matching, Open Text Q&A, Video Analysis, and Audio Identification—with instant, deterministic answer verification and point settlement.
4. **Synchronized Multi-View Role Separation**: Providing tailored, real-time synchronized views for three distinct roles—the **Quiz Master** (`admin.html`), **Participating Teams** (`index.html`), and the **Audience / Projector Scoreboard** (`live.html`)—without requiring complex server infrastructure for single-machine/multi-window event setups.

## 3. Target Users & Personas

| Role | Interface | Primary Responsibilities & Needs |
| :--- | :--- | :--- |
| **Quiz Master (Administrator)** | `admin.html` (`admin.js`) | Passcode-protected event control (`MrKrsna`), configuring default starting points, managing registered teams (editing point balances, renaming, removing), authoring live or prepared draft questions across 8 formats, releasing prepared questions, manually ending active bidding, or resetting the event. |
| **Competing Teams (Bidders)** | `index.html` (`bidder.js`) | Registering team identity, optionally locking in initial point balances once, filtering/searching available question lots, placing incremental or quick-select bids within available point limits, and submitting answers within the countdown window upon winning a bid. |
| **Audience & Event Hall** | `live.html` (`live.js`) | Viewing a high-contrast, full-screen projector display that automatically follows active bidding, highlights bid ladders and locked points, announces state transitions via banners, tracks live leaderboard standings, and reveals full questions and solutions once settled. |

## 4. Key Functional Requirements

### 4.1 Point Economy & Bid Escrow Mechanics

- **Starting Allocation**: Every team begins with a configurable default point balance (default: `1,000` points) or a one-time self-declared/admin-adjusted base score.
- **Available Balance Calculation**: A team's spendable balance on a given lot is calculated as:
  $$\text{Available Points} = \text{Base Points} + \text{Settled Outcomes} - \text{Committed Points in Other Active Lots}$$
- **Bid Validation & Anti-Sniping**: Bids must meet or exceed the starting bid (or current high bid plus minimum raise increment). Any valid bid placed within the final 30 seconds of a lot's bidding timer automatically extends the bidding deadline by 30 seconds.
- **Outcome Settlement**:
  - **Correct Answer**: Winning bidder gains their bid amount ($+\text{Bid}$).
  - **Incorrect Answer or Timeout**: Winning bidder loses their bid amount ($-\text{Bid}$).
  - **Unsold Lot**: Lots closed with zero bids settle with no point changes.

### 4.2 Question Formats & Evaluation Rules

The platform must support eight distinct question types mapped to three evaluation modes:

| Question Type | Internal Key | Evaluation Mode | Validation Logic |
| :--- | :--- | :--- | :--- |
| **Fill in the Blanks** | `blank` | `text` | Sentence containing `____`; case-insensitive, whitespace-normalized match against pipe-separated (`\|`) accepted answers. |
| **Statement Correct** | `statement` | `mcq` | Multi-statement prompt evaluated via 4-option single-select choice (`A`–`D`). |
| **Reasoning (Assertion / Reason)** | `reasoning` | `mcq` | Dual prompt (`Assertion (A)` and `Reason (R)`) with pre-populated standard 4-option causal relationships. |
| **Multiple Choice Questions** | `aptitude` | `mcq` | Standard stem with 4 options (`A`–`D`) and a single correct index (`0`–`3`). |
| **Matching** | `matching` | `match` | 2 to 6 left-right pairs; right-hand items are deterministically shuffled per lot ID, requiring exact 1-to-1 index alignment. |
| **Question and Answer** | `qa` | `text` | Open-ended question checked against pipe-separated (`\|`) accepted answer strings. |
| **Watch Video and Answer** | `video` | `mcq` or `text` | Embeds YouTube (`youtube-nocookie.com`) or direct `.mp4`/`.webm` media revealed upon winning the bid. |
| **Guess the Answer by Sound** | `sound` | `mcq` or `text` | Embeds audio player (`.mp3`/`.wav`) or compact YouTube audio frame revealed upon winning the bid. |

### 4.3 State Machine & Lifecycle per Question Lot

Each released question transitions deterministically through the following states based on timestamps and user actions:

1. **Prepared (`drafts`)**: Saved by the Quiz Master; invisible to teams and projector until explicitly released.
2. **Bidding Open (`bidding`)**: Visible metadata (`topic`, `subject`, `difficulty`, `type`, `hint`); countdown timer active (`endsAt > Date.now()`).
3. **Awaiting Answer (`answering`)**: Bidding timer expired with a leading bid; question prompt and media unlocked exclusively for the winning team; answer countdown timer active (`endsAt + answerSecs * 1000`).
4. **Terminal States (`correct` | `wrong` | `timeout` | `unsold`)**: Triggered upon answer submission, answer timer expiration, or zero-bid closure; reveals the full question and correct answer across team and projector views and settles points immediately.

## 5. Current Architectural Constraints & Future Scalability Scope

- **Single-Browser Storage Limitation**: State persistence currently relies on browser `localStorage` under the key `pmm3-v1` and cross-tab `storage` events (`store.js`). While effective for multi-window projection on a single host machine, multi-device participation across separate team laptops/phones requires replacing `load()` and `save()` with a real-time cloud backend (such as Firebase Firestore or WebSockets).
- **Client-Side Access Control**: The Quiz Master passcode (`MrKrsna` in `admin.js`) gates casual UI access via `sessionStorage` (`pmm3-admin`), which is sufficient for local operation but requires server-side authentication for untrusted network environments.
- **External Media Hosting**: Due to browser `localStorage` quota limits (~5 MB), video and audio questions must reference external `https://` URLs rather than storing binary media blobs locally.
