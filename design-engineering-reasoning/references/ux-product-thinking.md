# Product Thinking, Information Architecture & User Journeys

Read this when: starting a new page/product, restructuring navigation or content, or when
a build feels like "features on a page" rather than a coherent product.

## Product Thinking

**Objective:** ground every design decision in a real job-to-be-done, not a feature list.

Rules:
- State the product's single sentence of value BEFORE listing features. If you can't write
  it in one sentence, the product scope is still fuzzy — resolve that first, in text, with
  the user if needed.
- Rank features/sections by how directly they serve the primary user journey, not by how
  impressive they are to build. A working demo, a real screenshot, or a specific number
  beats three more feature cards.
- Business goals and user goals are usually not identical — name both explicitly
  (business: "increase trial signups"; user: "understand if this solves my specific
  problem in under 30 seconds") and design for the overlap, not just the business one.

Anti-pattern: **feature-list-as-page**. Symptom: a hero, then N identical cards each with
an icon + 3-word title + 1-sentence description, repeated for every feature with no
prioritization. Fix: pick the 1–3 features that actually differentiate or convert, give
them real space (screenshots, specifics, a mini-demo), and either compress the rest into a
dense list or cut them.

Self-review question: if you removed this section, would the user's decision change? If
not, it's filler — cut it or replace with something that moves the decision.

## Information Architecture

**Objective:** a structure a stranger can navigate without thinking about the structure.

Rules:
- Every page/section answers ONE primary question for the visitor. Name that question
  before building the section.
- Navigation reflects the user's mental model of the product, not the org chart or the
  codebase's file structure.
- Depth over sprawl: 3–5 well-named top-level items beat 8 vague ones. If you need a mega
  menu for a landing page, the IA is probably wrong for the audience's actual need.
- Content hierarchy on a page = visual hierarchy on a page. Decide the reading order in
  text (H1 → supporting claim → evidence → action) before deciding font sizes.

Decision criteria for "does this need its own page/section vs. inline":
- Will more than ~30% of visitors need this to make their decision? → own section,
  visible without extra clicks.
- Is it needed only by a minority pursuing a specific sub-goal (docs, pricing FAQ
  detail, legal)? → own page, linked, not crammed into the main flow.

## User Journeys

**Objective:** design the sequence of states a real user moves through, not a single
static screen.

For each primary persona, map:
1. **Entry state** — how they arrived (ad, search, referral, direct) — this changes what
   context they already have and what the page must NOT re-explain.
2. **Evaluation state** — what they're comparing this against, what would make them leave.
3. **Decision state** — the specific action and what's making it easy or hard right now.
4. **Empty state** — first use with zero data. This is one of the most-skipped screens in
   AI-generated products; a dashboard with no empty-state design is a red flag. Empty
   states should explain what will appear here and offer a clear first action, not just
   show blank space or a generic "No data" string.
5. **Error/edge state** — what happens when the network fails, input is invalid, or
   permissions are wrong. Design the tone here too — an error is a trust moment, not an
   afterthought.
6. **Return/repeat state** — for products used more than once, what changes for a
   returning user (skip onboarding, show recent activity, etc.)?

Anti-pattern: **happy-path-only design**. Symptom: beautiful landing page and signup flow,
but the actual product's empty/loading/error states are unstyled defaults. Fix: budget
explicit design time for these states in Phase 2, not as an afterthought in Phase 4.

## Content Strategy & Storytelling

Rules:
- Write real copy before or during layout, not lorem ipsum then "fill in later" — layout
  decisions (line length, hierarchy, spacing) depend on real copy length and rhythm.
- Headlines state a specific benefit or outcome, not a category label. "Ship features
  faster with automated review" beats "Powerful Development Tools."
- Vary sentence and section rhythm — a page where every section is
  headline+paragraph+3-cards reads as templated even if each section's content is good.
  Break the pattern deliberately: a full-bleed stat, a single quote, a before/after,
  a short list.
- Specificity beats superlatives. A real number, screenshot, or named detail
  ("processes 40k rows in under 2s") is worth more than "blazing fast," "world-class," or
  "seamless" — these words are a signal of unspecific thinking, not just weak copy.

Self-review questions:
- Could this exact copy sit on a competitor's site unchanged? If yes, it's not saying
  anything specific to this product — rewrite.
- Does the content structure vary section to section, or is it the same shape repeated?
