# Code Architecture, Accessibility, Performance, Responsive, SEO

Read this when: writing or reviewing implementation code (Phase 4), or during the
accessibility/performance parts of Phase 5 critique.

## Code Architecture

Rules:
- Semantic HTML first: `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>`,
  `<button>` vs `<div onClick>`, real `<h1>`–`<h6>` hierarchy (one H1 per page, no skipped
  levels). This is both an accessibility requirement and a maintainability one — semantic
  structure is self-documenting.
- File/folder structure should reflect the component layering from
  `references/components-motion.md` (primitives → patterns → sections → pages), not be
  organized purely by file type once the project grows past a handful of components.
  Small prototypes can stay flat; don't over-engineer structure for a 3-file demo.
- Keep components focused — if a single component file handles layout, data-fetching, and
  three unrelated pieces of UI state, split it.
- Avoid prop-drilling more than 2–3 levels; reach for context/composition instead.
- Name things for what they mean in the product domain, not their visual appearance
  (`PricingTier` not `WhiteCard3`).

## Accessibility (non-negotiable baseline, not a stretch goal)

- Color contrast: minimum 4.5:1 for body text, 3:1 for large text (18px+/14px+bold) and
  meaningful UI components/icons. Check this DURING palette selection (Phase 3), not after
  the build.
- Every interactive element is keyboard-operable and has a visible focus state — never
  `outline: none` without a deliberate, equally visible replacement.
- All images have meaningful `alt` text (or `alt=""` for genuinely decorative images);
  icons used as the only label for an action need an accessible name (aria-label or
  visually-hidden text).
- Forms: every input has a real associated `<label>`, error messages are programmatically
  associated with their field (aria-describedby) and not conveyed by color alone.
- Respect `prefers-reduced-motion` (see motion reference) and `prefers-color-scheme` where
  relevant.
- Touch targets ≥ 44×44px on interactive elements for mobile.
- Don't rely on color alone to convey state (error/success/required) — pair with icon or
  text.

## Performance

- Images: correctly sized, modern formats (WebP/AVIF with fallback), lazy-loaded below the
  fold, explicit width/height (or aspect-ratio) to prevent layout shift.
- Fonts: subset when possible, `font-display: swap`, limit to 2 families / a handful of
  weights — every additional weight is a render-blocking or layout-shift risk if not
  handled carefully.
- Ship only the CSS/JS actually used per route — avoid loading a full component library's
  JS for a static marketing page.
- Defer/lazy-load non-critical JS (analytics, chat widgets, below-fold interactive
  widgets).
- Animate `transform`/`opacity` (GPU-accelerated), not `width`/`top`/`left`/`box-shadow`
  properties that trigger layout/paint on every frame.
- Budget mentally against Core Web Vitals even without running Lighthouse: is there a
  large, unsized hero image or web-font swap that will cause visible layout shift (CLS)?
  Is there a large JS bundle blocking first interaction (poor INP)?

## Responsive Design

- Design mobile-first: start from the smallest viewport's content priority, then add for
  larger screens — this forces real hierarchy decisions rather than shrinking a desktop
  layout until it barely fits.
- Don't just reflow columns to stack — reconsider information density and navigation
  pattern per breakpoint (e.g., a data table may need a card-based mobile layout, not a
  horizontally-scrolling shrunk table).
- Test (or explicitly reason through) at minimum: ~375px (small phone), ~768px (tablet),
  ~1280px+ (desktop), and note any layout that only "sort of" works in between.
- Interactive elements keep their 44px touch target at every breakpoint, not just mobile.

## SEO (where applicable — marketing/content sites, not internal tools)

- One clear, descriptive `<title>` and `<meta description>` per page, written for a human,
  not stuffed with keywords.
- Real semantic heading hierarchy (also an accessibility requirement — they reinforce each
  other).
- Server-rendered or statically-generated critical content where the framework allows it,
  so content is present without requiring JS execution for indexing.
- Descriptive, real `alt` text doubles as SEO signal.
- Open Graph / Twitter meta tags for shareable pages.
- Semantic URLs over query-string-only routing where feasible.

Self-review questions:
- Could a keyboard-only user complete the primary journey end to end?
- If you throttled to a slow connection, what's the largest layout shift or blocking
  resource, and is it justified?
- Does the heading structure alone (ignoring all styling) represent the actual content
  hierarchy?
