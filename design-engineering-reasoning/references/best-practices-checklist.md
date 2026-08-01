# Pre-Ship Checklist & Continuous Improvement

Run this checklist at the end of Phase 5, before presenting work as finished. Treat an
unchecked item as either fixed now or explicitly called out to the user as a known gap —
never silently shipped.

## Discovery & Structure
- [ ] Product value stated in one sentence; features prioritized by relevance to it
- [ ] Primary persona and their situational context named
- [ ] Single primary action/goal identified per page (not 3 competing CTAs)
- [ ] Content outline/copy written before or during layout, not after
- [ ] Primary user journey mapped including empty, loading, and error states

## Visual Design
- [ ] Typography pairing has a stated rationale; not default stack at default weights
- [ ] One real spacing scale used consistently
- [ ] Color palette: one deliberate brand color + real neutral scale + harmonious
      semantic colors — not unmodified framework defaults
- [ ] At least one deliberate asymmetric or rhythm-breaking layout moment
- [ ] Section-to-section layout rhythm varies; not the same module shape repeated
- [ ] Gradient/glass effects (if used) are justified by an actual layering/light
      relationship, used sparingly

## Components & Motion
- [ ] Components layered (primitives → patterns → sections), not one-off per screen
- [ ] Content type dictates component shape — not everything forced into "card"
- [ ] Every animation has a one-sentence stated purpose; decorative motion removed
- [ ] `prefers-reduced-motion` respected
- [ ] Required interaction states present: hover/active/focus/disabled/loading

## Code & Accessibility
- [ ] Semantic HTML, correct heading hierarchy (one H1, no skipped levels)
- [ ] Color contrast meets WCAG AA (4.5:1 body / 3:1 large text & UI)
- [ ] Full keyboard operability with visible focus states
- [ ] Forms: real labels, associated error messages, not color-only state
- [ ] Images have meaningful alt text
- [ ] Touch targets ≥44px

## Performance
- [ ] Images sized/optimized, lazy-loaded below fold, no layout shift from missing
      dimensions
- [ ] Fonts limited, `font-display: swap` set
- [ ] No unnecessary JS/CSS shipped for the route
- [ ] Animations use transform/opacity, not layout-triggering properties

## Responsive
- [ ] Built mobile-first; mobile is a reconsidered design, not a shrunk desktop layout
- [ ] Reasoned through ~375px / ~768px / ~1280px+ at minimum

## Final Critique
- [ ] Self-Review Loop (SKILL.md) run and every question answered honestly
- [ ] Weakest section named and either fixed or explicitly flagged to the user
- [ ] Design rationale for non-obvious choices can be stated in one sentence each
- [ ] Anti-slop pattern catalogue reviewed; no unjustified instance present

---

## Common Failure Patterns (beyond the visual anti-slop list)

- **Scope creep without re-planning**: adding sections/features mid-build without
  revisiting the Phase 2 hierarchy — results in a page that's grown but no longer has a
  clear single focus. Fix: any added section triggers a quick re-check of "what's still
  the ONE primary focal point."
- **Consistency drift across a long build**: spacing/color/type choices made early get
  forgotten and re-invented slightly differently later in the same build. Fix: keep the
  Phase 3 design tokens visible/referenced throughout, don't rely on memory.
- **Critique skipped under time pressure**: Phase 5 gets cut when a deadline looms, and
  it's the phase that catches the most generic-feeling output. Fix: budget for it
  explicitly rather than treating it as optional buffer time.
- **Accessibility as a retrofit**: treating a11y as a pass to run at the end rather than
  a constraint from Phase 3 (palette) and Phase 4 (semantic markup) onward — retrofits
  are usually incomplete because some decisions (e.g., a palette that can't hit contrast
  ratios) are expensive to reverse. Fix: check contrast and semantics as you go.

## Continuous Improvement

When a project reveals a new failure pattern not covered above, or a new deliberate
technique that worked well, add it to the relevant reference file rather than treating it
as one-off learning — that's what keeps this skill from going stale as conventions shift
(e.g., "dark-mode-by-default" itself becoming a generic tell is a recent example worth
re-checking every few months against current design trends). When in doubt about whether
something has become a new cliché, treat "everyone's current AI output looks like this"
as the same category of anti-pattern as the ones catalogued here, even if it's not yet
written down.
