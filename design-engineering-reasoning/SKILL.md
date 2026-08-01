---
name: design-engineering-reasoning
description: >
  Use this skill for ANY web design or frontend build task — new sites, landing pages,
  dashboards, SaaS products, e-commerce, portfolios, redesigns, or component work.
  Teaches senior-product-designer and senior-frontend-engineer reasoning: planning before
  code, avoiding generic "AI slop" output (cookie-cutter hero sections, glassmorphism-by-
  default, purple gradients, uniform card grids, decorative animation), building a real
  design system, and self-critiquing before shipping. Trigger this even when the user's
  request seems small ("make me a landing page", "build a pricing page", "add a dashboard
  card") — small requests are exactly where template defaults sneak in. Do NOT trigger for
  pure backend/API/CLI work with no UI surface.
version: 1.0.0
---

# Design & Engineering Reasoning

## Purpose

Most AI-generated websites are recognizable at a glance: dark hero with a gradient blob,
three feature cards with the same icon-title-paragraph shape, a pricing table, a testimonial
carousel, Inter font, purple-to-blue everything. The code often works. It rarely feels
*decided* — like a specific person made specific choices for a specific product and
audience. This skill exists to close that gap by giving you the reasoning process a senior
designer/engineer runs before, during, and after implementation — not a style to imitate,
but a way to arrive at your own style for each project.

**Core stance: you are not decorating a page, you are solving a specific problem for a
specific audience.** Every irreversible visual decision (palette, type pairing, layout
grid, motion language) should trace back to something true about *this* product — not to
"what looks modern."

## Scope

Applies to: marketing sites, landing pages, SaaS products, dashboards, e-commerce,
portfolios, blogs, internal tools, component libraries, and redesigns of any of the above.
Applies at any project size — a single pricing section deserves the same "why" as a full
site.

Does not replace: backend architecture decisions, infra/deploy choices, or non-UI code —
pull in other skills for those.

---

## The Workflow (five phases, in order)

Do not skip to code. Each phase produces an artifact (even a short one) that the next
phase depends on. For trivial single-component tweaks, compress phases 1–2 into two or
three sentences of stated reasoning — but state them; do not skip silently.

### Phase 1 — Discovery (before any visual decision)

Answer these explicitly, in writing, before touching layout or color:

1. **What is this, really?** — the product/page in one sentence, stated as a job-to-be-done
   ("lets a freelancer send a client an invoice they can pay in one click"), not a feature
   list.
2. **Who is it for, in this moment?** — not a demographic, a *situation*: are they
   comparison-shopping, already convinced and just need to check out, evaluating for a
   boss, in a hurry, on a phone in bad light? This drives density, tone, and trust signals
   far more than "millennials" or "enterprise buyers" would.
3. **What does the business need this page to do?** One primary action. Naming three
   equally-weighted CTAs means you haven't decided; decide.
4. **What would make someone NOT trust this?** — thin content, no specificity, generic
   stock imagery, no evidence. Name the trust gap for this specific product before
   designing around it.
5. **What existing references are relevant** — not to copy, but to know what "table
   stakes" looks like in this category so you can deliberately match or deliberately
   break convention, rather than accidentally landing on generic.

Output: a short brief (5–10 lines). If the user hasn't given you this info, make explicit,
reasonable assumptions and state them — don't silently invent a fictional brand, and don't
block progress waiting for answers to everything.

### Phase 2 — Structure (information architecture, before pixels)

1. Write the actual content outline as prose or a list — real headline candidates, real
   section purposes — before any layout. If you can't write a specific headline, you don't
   understand the product yet; go back to Phase 1.
2. Map the primary user journey for the primary persona as a sequence of screens/states/
   decisions, not just "landing page then signup." Include the state where nothing has
   happened yet (empty state) and the state where something goes wrong (error state) — see
   `references/ux-product-thinking.md`.
3. Decide information hierarchy per view: what is the ONE thing a visitor should notice
   first, second, third. If everything is emphasized, nothing is — see anti-pattern
   "competing focal points" in `references/anti-slop-patterns.md`.
4. Sketch the section/screen list as an outline (text is fine, no need for a visual wireframe
   tool) before writing markup.

### Phase 3 — Design Language (the decisions that make it feel specific)

Establish, and write down, BEFORE building components:

- **Typography** — a deliberate pairing with a stated rationale, not "Inter for
  everything." See `references/visual-design-system.md`.
- **Color system** — one dominant brand color used with intention plus a real neutral
  scale, not five accent gradients. State *why* this palette fits this product's emotional
  register.
- **Spacing scale** — pick one (4/8pt grid is a safe default) and use it everywhere; do not
  eyeball margins per component.
- **Grid/layout system** — how content aligns and breaks across breakpoints.
- **Motion principles** — what moves, why, and what NEVER moves (see
  `references/components-motion.md`). Silence is a valid motion decision.
- **Iconography** — one icon family, one stroke weight, used sparingly and only where it
  adds scanability, never as generic decoration next to every heading.

This is the step generic output skips — it goes straight from wireframe to Tailwind
defaults. The 10 minutes spent here is what separates "handcrafted" from "generated."

### Phase 4 — Build

Mobile-first, accessibility-first, semantic-HTML-first. Component-driven. See
`references/code-quality.md` for the concrete rules (semantic structure, a11y baseline,
performance budget, responsive strategy) and `references/components-motion.md` for
component architecture and interaction/animation rules.

While building, continuously re-check against Phase 1–3 decisions — if a component doesn't
serve the stated hierarchy or design language, it's drift; fix it now, not in polish.

### Phase 5 — Critique & Polish

Before calling anything done, run the Self-Review Loop below and the checklist in
`references/best-practices-checklist.md`. Fix or explicitly justify every flagged item.
Polish pass covers: copy specificity, empty/loading/error states, micro-interactions,
visual rhythm consistency, and a final anti-slop pass (`references/anti-slop-patterns.md`).

---

## Self-Review Loop (run this after every meaningful chunk of work, not just at the end)

Ask, honestly, in this order:

1. **Could I swap this product's name/logo for a competitor's and would anything look
   wrong?** If not, this is undifferentiated — go back to Phase 1–3.
2. **Is there a section, layout, or component here I've now built the same way three times
   across unrelated projects?** If yes, you're pattern-matching to a template, not
   reasoning from this brief. Name what's different about THIS product and let that change
   the execution.
3. **Does every animation/transition have a stated purpose** (guide attention, confirm an
   action, show causality) or is it decorative? Cut decorative motion.
4. **Is there a single, obvious "look here first" per screen**, or are three elements
   competing (bold headline + bright CTA + autoplaying video all at once)?
5. **Would this survive with the images/icons removed** — i.e., is the hierarchy carried by
   type and layout, not just visual noise?
6. **What's the weakest section?** Name it specifically and either fix it now or state why
   it's acceptable for this iteration (e.g., "testimonials are placeholder pending real
   client quotes — flagged, not hidden").
7. **Accessibility and performance**: did I check these as I built, or am I hoping to fix
   them later? (Later rarely happens — see `references/code-quality.md`.)

If you cannot answer #6, you have not actually critiqued the work — restart the loop.

---

## Decision Trees

**"What layout for this section?"**
Is the content a small number of distinct, comparable items (2–4)? → structured comparison
(cards/table) is fine, but vary the internal layout so items aren't visually identical
clones. Is it a single dominant message plus supporting evidence? → asymmetric layout,
one large element, don't force it into a 3-column grid out of habit. Is it a long list of
similar items (10+)? → table, dense list, or filterable grid — not stacked cards. Unsure?
→ default to whatever makes the ONE most important thing largest and first, not to
"3-column grid," which is the single most overused default in AI-generated layouts.

**"Does this need an animation?"**
Does it confirm a user action happened (button press, form submit, item added)? → yes,
brief (100–250ms). Does it guide attention to something that just became relevant (new
content, an error)? → yes, subtle. Is it just... on scroll, because everything fades in on
scroll? → no, cut it, or make it purposeful (e.g., reveals a causal sequence). Does it
delay the user from their goal? → no, remove regardless of how nice it looks in isolation.

**"Should this be a gradient / glassmorphic panel?"**
Does translucency communicate a real layering relationship (this panel floats above that
content and both matter simultaneously)? → maybe, use sparingly and with real backdrop
content behind it, not decoration on a solid background pretending to be depth. Otherwise
→ no. Full checklist in `references/anti-slop-patterns.md`.

**"What color palette?"**
Start from the *emotional register* the product needs (trustworthy/calm, energetic/bold,
premium/quiet, playful/friendly) — not from "what's trending." Pick ONE saturated brand
color used deliberately, build a real neutral scale (7+ steps) around it, and derive
semantic colors (success/warning/error) that are harmonious with, not random relative to,
the brand color. Full system in `references/visual-design-system.md`.

**"Component library or custom?"**
Prototyping/internal tool/time-constrained → use a solid headless/utility base
(shadcn/ui-style primitives, Tailwind) but restyle tokens (radius, spacing, type, color) so
it doesn't read as defaults. Customer-facing brand surface (marketing site, product
identity pages) → custom design language on top of accessible primitives; defaults are the
#1 tell of generated output here.

---

## Reference Files

Load these as needed — don't load all of them for a small task.

- `references/ux-product-thinking.md` — product thinking, information architecture, user
  journeys, content strategy, storytelling
- `references/visual-design-system.md` — typography, color systems, layout/grid systems
  with concrete rules and worked examples
- `references/components-motion.md` — component architecture, scalable systems, motion
  design principles and timing rules
- `references/code-quality.md` — code architecture, accessibility, performance, responsive
  design, SEO — the concrete, checkable engineering rules
- `references/anti-slop-patterns.md` — the full catalogue of generic-AI-website tells, why
  each happens, and how to avoid it
- `references/best-practices-checklist.md` — final pre-ship checklist, common failure
  patterns, and the continuous-improvement note for future runs

## Constraints

- Never ship a first draft as final. Phase 5 is mandatory, not optional-if-time-permits.
- Never use a gradient, glass panel, or particle/blob background as a default choice —
  only as a deliberate one, justified in one sentence.
- Never invent statistics, testimonials, or client logos to fill placeholder content;
  either use clearly-marked placeholder copy or ask the user for real content.
- Never sacrifice accessibility (contrast, focus states, semantic structure, keyboard
  nav) for visual effect — these are not in tension with good design, treat conflicts as a
  sign the visual idea needs revision, not the a11y requirement.
- State design rationale briefly in your response to the user for any non-obvious choice —
  a senior designer can always explain "why this," and so should you.
