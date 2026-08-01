# Component Architecture & Motion Design

Read this when: building out a component system, or deciding what should animate and how.

## Component Architecture

Objective: a system that scales — new sections/pages compose from existing primitives
instead of each screen inventing new one-off markup.

Rules:
- Layer components: primitives (Button, Input, Badge) → composed patterns (Card,
  FormField, NavItem) → page sections (Hero, PricingTable) → pages. Don't build page
  sections directly from raw HTML/CSS every time — extract the primitives first.
- Props/variants over duplication: a Button with `variant` and `size` props beats
  PrimaryButton.jsx, SecondaryButton.jsx, BigButton.jsx as separate components.
- Design tokens (spacing, color, radius, shadow, type scale) live in one place (CSS
  variables, Tailwind config, theme object) and components reference tokens, not raw
  values — this is what makes a later brand/theme change a config edit instead of a
  find-and-replace across every file.
- Co-locate a component's markup, styles, and (if applicable) logic; avoid scattering one
  visual component's definition across unrelated files.
- Every component should have a sensible default state, loading state, error state (if it
  fetches data), empty state (if it lists data), and disabled state where relevant —
  decide these at the component level once rather than per usage.

Anti-pattern: **card-for-everything**. Symptom: features, testimonials, pricing tiers,
team members, and blog posts all rendered as visually identical rounded-white-box-with-
shadow cards. Fix: let content type inform component shape — a testimonial might be a
large pull-quote, a team member might be a photo-forward tile, pricing might be a real
comparison table. Reserve the generic "card" for genuinely comparable, similar-weight
items.

## Motion Design

Objective: motion that communicates state and guides attention — never motion as ambient
decoration.

Every animation should answer: what is this telling the user? Valid answers:
- **Causality** — this happened because you did that (button press → visible feedback).
- **Continuity** — this new thing came from that old thing (a modal expanding from the
  button that opened it, not just fading in from nowhere).
- **Attention** — something changed that the user should notice now (a new
  notification, an error appearing).
- **Feedback on progress** — loading, saving, processing states.

Invalid answers (cut these): "it looks more premium," "everything should fade in on
scroll," "because I can."

Timing rules of thumb:
- Micro-interactions (button hover/press, toggle): 100–200ms.
- Element transitions (modal open, panel expand): 200–350ms.
- Page/section-level transitions: 300–500ms, and only if they serve continuity — most
  pages don't need page-transition animation at all.
- Easing: ease-out for things entering/appearing (fast start, gentle stop feels
  responsive), ease-in for things leaving, avoid default linear easing for anything
  user-facing — it reads as robotic.
- Respect `prefers-reduced-motion` — disable or drastically simplify non-essential motion
  for users who've requested it. This is an accessibility requirement, not optional
  polish.

Anti-pattern: **scroll-fade-everything**. Symptom: every section fades/slides in as it
enters viewport, with no variation and no purpose beyond "movement." Fix: reserve
scroll-triggered motion for moments where revealing sequence actually matters (e.g., steps
in a process, a before/after), and let most content simply be present — stillness is not
a bug.

Anti-pattern: **animation as loading-time tax**. Symptom: a 600ms+ intro animation that
delays interaction on every visit, or animated counters/particles that block perceived
performance. Fix: never let decorative motion delay the user's ability to act; a landing
page hero animation should never gate the CTA becoming clickable.

Self-review questions:
- For each animation in the build, can you state in one sentence what it communicates? If
  not, cut it.
- Does anything animate on every single page load in a way that becomes annoying on the
  user's 5th visit? If so, it's decoration, not communication — reconsider or gate it to
  first-visit only.
