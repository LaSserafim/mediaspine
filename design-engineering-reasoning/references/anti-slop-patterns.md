# Anti-AI-Slop Pattern Catalogue

Read this during Phase 5 critique, or any time output feels "off" but you can't name why.
For each pattern: what it looks like, why it happens, how to prevent it.

## 1. Hero-section template
**Looks like:** Centered headline, subheadline, two buttons (one filled, one outline),
gradient blob or abstract shape background, all above the fold, identical shape to a
thousand SaaS landing pages.
**Why it happens:** It's the statistically most common hero pattern in training data —
the "safe average" of every SaaS site.
**Prevention:** Vary at least one structural axis deliberately: asymmetric split instead
of centered, a real product screenshot/demo instead of abstract shapes, a single strong
CTA instead of two competing ones, copy that names the specific outcome instead of a
category label.

## 2. Gradient-and-glassmorphism-by-default
**Looks like:** Purple-to-blue (or pink-to-orange) gradients on buttons, backgrounds, and
text; frosted-glass translucent panels regardless of whether anything is actually layered
behind them.
**Why it happens:** Became a dominant aesthetic in template libraries ~2021–2023 and
persisted as a "default modern" signal in training data, decoupled from actual purpose
(glass effects originally communicated real depth/layering in OS UI).
**Prevention:** Use gradient/glass only when justified by an actual visual relationship
(a real floating panel over real content). Otherwise use flat color with a deliberate
palette (see visual-design-system.md). If in doubt, ship the flat version first and add
the effect only with a specific reason.

## 3. Uniform card grids for everything
**Looks like:** Features, team, testimonials, pricing, blog previews — all rendered as
identical white rounded-corner boxes with a shadow, icon, title, paragraph.
**Why it happens:** It's a maximally reusable pattern, so it gets reached for regardless
of content fit.
**Prevention:** See "card-for-everything" anti-pattern in components-motion.md — let
content type dictate component shape.

## 4. Competing focal points
**Looks like:** Bold headline, saturated CTA button, autoplaying background video, and an
animated badge all fighting for attention in the same viewport.
**Why it happens:** Each element was individually optimized to "stand out" without a
holistic hierarchy decision.
**Prevention:** Name the single primary focal point per screen in Phase 2; everything else
is explicitly secondary in weight, color saturation, or motion.

## 5. Generic/placeholder copy
**Looks like:** "Powerful features for modern teams," "Seamless experience, built for
you," "Take your business to the next level" — true of literally any product, therefore
meaningless for this one.
**Why it happens:** Generic copy is the safe average across all training examples;
specific copy requires actual product knowledge the model may not have been given.
**Prevention:** Refuse to ship a superlative-only claim without a specific fact backing
it. If real specifics aren't available, either ask for them or mark placeholder copy
explicitly as placeholder rather than presenting invented specificity as real.

## 6. Poor/flat visual hierarchy
**Looks like:** Everything is roughly the same size and weight; the eye has nowhere
obvious to land first.
**Why it happens:** Uniform component styling (see #3) applied without a hierarchy pass.
**Prevention:** Explicit Phase 2 hierarchy decision + a dedicated hierarchy check in
Phase 5 self-review (question 4).

## 7. Inconsistent spacing
**Looks like:** Padding/margins that are close-but-not-quite consistent (14px here, 18px
there) — reads as "almost professional" which paradoxically looks worse than clearly
unstyled.
**Why it happens:** Values generated per-component without a shared spacing scale.
**Prevention:** One spacing scale, tokenized, referenced everywhere (see
visual-design-system.md and code-quality.md).

## 8. Random/decorative animation
**Looks like:** Everything fades/slides in on scroll with no differentiation; floating
particles or blobs drifting in the background with no relationship to content.
**Why it happens:** Motion libraries make "add fade-in" trivial to apply blanket-wide;
it reads as effort/polish without requiring a design decision.
**Prevention:** Motion decision tree in SKILL.md — every animation must answer "what does
this communicate?"

## 9. Overused framework defaults
**Looks like:** Default Tailwind color palette (`blue-500`, `gray-100`...) untouched,
default shadcn/ui component styling unmodified, default browser form controls next to
custom-styled buttons.
**Why it happens:** Defaults are the path of least resistance and are extremely common in
scraped example code.
**Prevention:** Treat framework defaults as a *starting point for tokens*, not a
final palette — always restyle at minimum the primary color, radius scale, and shadow
system to something specific to this brand (see decision tree in SKILL.md: "Component
library or custom?").

## 10. No interaction design / static-feeling UI
**Looks like:** Buttons with no hover/active/focus distinction, no loading feedback on
async actions, forms that give no inline validation.
**Why it happens:** Interaction states are easy to omit and the static screenshot still
"looks done."
**Prevention:** Bake required states (default/hover/active/focus/disabled/loading) into
the component contract from the start (see components-motion.md).

## 11. Poor mobile experience treated as an afterthought
**Looks like:** Desktop layout that's technically responsive (things stack) but density,
touch targets, and navigation pattern weren't reconsidered for mobile use.
**Why it happens:** Design/build proceeds desktop-first, mobile is a reflow pass at the
end.
**Prevention:** Mobile-first workflow (code-quality.md) — the mobile layout is the
primary design, not a shrink of the desktop one.

## 12. Missing design rationale
**Looks like:** Choices that can't be explained beyond "it looked nice" — not wrong by
itself, but a strong correlate of every other pattern above, because reasoned choices
tend to also be differentiated choices.
**Why it happens:** Skipping Phase 1–3 and going straight to markup.
**Prevention:** The whole workflow in SKILL.md. If you can't state a one-sentence reason
for a non-obvious choice, that's the signal to go back and actually decide, not to
proceed on autopilot.
