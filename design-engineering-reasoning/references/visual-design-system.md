# Visual Design: Typography, Color, Layout

Read this when: establishing Phase 3 design language, or when output "looks AI-generated"
despite good structure — this is usually where the tell lives.

## Typography

Rules:
- Choose a pairing with a stated rationale tied to the product's register (e.g., a
  humanist sans for approachable SaaS, a slab or serif display for editorial/premium
  confidence, a mono accent for technical/developer products). "Inter + system-ui for
  everything" is the single most common generic tell — it's a fine workhorse body font,
  but pair it with a distinctive display face for headlines, or vary weight/size
  dramatically enough that the typographic voice feels chosen.
- Set a real type scale (e.g., a modular scale like 1.25 or 1.333 ratio) and use it
  consistently — not ad hoc px values per component.
- Line length: 45–75 characters for body text. Long-form content that ignores this reads
  as unconsidered regardless of font choice.
- Line height inversely scales with font size: tight for large display text (1.0–1.2),
  generous for small body text (1.5–1.7).
- Font weight does real hierarchy work — don't rely on size alone; a heavier weight at a
  moderate size can outperform a huge thin headline for actual scannability.

Anti-pattern: **default-stack typography**. Symptom: system-ui or Inter at default weights
throughout, headline is just body text scaled up. Fix: pick one deliberate display
treatment for H1/hero (custom weight, tighter tracking, maybe a second typeface) that
signals "someone designed this."

## Color Systems

Rules:
- Start from ONE primary brand color chosen for emotional register (see decision tree in
  SKILL.md), not from a trending gradient pair.
- Build a real neutral scale: 7–10 steps from near-white to near-black, ideally with a
  slight tint toward the brand hue rather than pure gray — this alone makes a palette feel
  designed rather than default.
- Derive semantic colors (success/warning/error/info) so they're harmonious in saturation
  and value with the brand palette — not saturated defaults dropped in unchanged (default
  Tailwind red-500/green-500/blue-500 sitting next to a custom brand color is a visible
  seam).
- Limit accent colors to 1, maybe 2. Multiple simultaneous gradient accents (purple →
  pink, blue → cyan, both on the same page) is a strong generic-AI tell — pick one
  gradient direction/pairing if you use gradients at all, and use it sparingly, not on
  every card and button.
- Respect contrast requirements (WCAG AA: 4.5:1 body text, 3:1 large text/UI components)
  as a design constraint from the start, not a fix-up pass — see
  `references/code-quality.md`.

Decision criteria — light vs. dark vs. both:
- Dark-mode-only marketing sites are themselves becoming a generic signal in some
  categories (dev tools especially) — a light, warm, or unusual palette can now
  differentiate more than a dark one. Choose based on the product's register and
  audience context (e.g., a dashboard used for hours benefits functionally from dark mode
  as an *option*; a marketing page's dark theme should be a deliberate brand choice, not
  the assumed default).

Anti-pattern: **gradient-and-glass-by-default**. See `references/anti-slop-patterns.md`
for the full breakdown; the summary rule is: translucency and gradient are effects, not a
style — use them only when they communicate something (real depth, real light) about this
specific interface.

## Layout & Grid Systems

Rules:
- Pick one spacing unit (4px or 8px base is standard) and derive ALL spacing from it
  (4/8/12/16/24/32/48/64...). Eyeballed, inconsistent gaps between elements are one of the
  fastest ways a layout reads as unpolished, even when colors and type are good.
- Establish a real grid (commonly 12-column) with defined gutters and margins per
  breakpoint; align elements to it deliberately, including intentional grid-breaks for
  emphasis (an element that deliberately spans past the grid draws attention BECAUSE
  everything else respects it).
- Whitespace is a hierarchy tool, not empty space to fill. Generous whitespace around a
  single important element signals importance more effectively than making that element
  larger.
- Vary layout rhythm across sections (see content strategy) — alternate symmetric/
  asymmetric, full-width/contained, image-left/image-right — so scrolling the page doesn't
  feel like the same module repeated with different text.
- Avoid the reflexive "3-equal-column grid" for every group of items — it is the layout
  equivalent of the Inter-everywhere tell. Ask what the content actually needs (see the
  layout decision tree in SKILL.md).

Self-review questions:
- If you screenshot three random sections of the page side by side, do they look like
  they're from the same considered system, or like unrelated components stitched
  together?
- Is there at least one deliberate asymmetric or grid-breaking moment, or is everything
  centered and evenly spaced (a common flatness signal)?
