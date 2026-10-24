# Design System — Portfolio

Internal design system documentation for [ginahsu.co](https://www.ginahsu.co/) — a static site (plain HTML/CSS/JS, no build step, hosted on GitHub Pages). There's no component framework here, so this document *is* the system: the tokens, components, and patterns below are implemented once in `styles.css` / `case-study.css` and reused by copying markup, not importing code. Pairs with [README.md](README.md) (run/deploy) and the Governance section at the end (contribution workflow, content status).

---

## 1. Principles

- **Two surfaces, one language.** The landing page (`styles.css`) and every case study (`case-study.css`) are separate stylesheets but share the same type system, color logic, and motion feel — a case study should never feel like a different product from the grid it was clicked from.
- **Real content over placeholder polish.** Nothing gets a fabricated metric, quote, or research insight. A section without real content yet is marked `TODO` and left honest, not filled with invented specifics — this is a portfolio representing real client work.
- **Motion communicates state, not decoration.** Every transition in the system exists to answer "where did this go / what just changed" (a card reordering, a value swapping, a tab activating) — not to add flourish.
- **Static-site constraints are load-bearing.** There's no backend, no build step, no templating. Every pattern in this doc (including the password gate) is designed around that constraint rather than working around it.

---

## 2. Foundations

### 2.1 Color

| Token | Value | Used for |
|---|---|---|
| `--bg` | `rgb(249, 224, 214)` | Landing page background (peach) |
| `--ink` | `rgb(48, 30, 24)` | Primary text / dark surfaces |
| `--panel` | `rgb(46, 27, 21)` | Sticky bio panel + tab bar background |
| `--white` | `rgb(253, 251, 248)` | Off-white surfaces (tab pills, card buttons) |
| `--card` | `rgba(255, 255, 255, 0.1)` | Base translucent card fill (see §3.3 — every card uses this, regardless of its class name) |
| `--cs-bg` | `rgb(253, 251, 248)` | Case study page background |
| `--cs-ink` | `rgb(48, 30, 24)` | Case study primary text (same value as `--ink`) |
| `--cs-muted` | `rgba(48, 30, 24, 0.56)` | Secondary text — labels, captions, meta |
| `--cs-pink` | `rgb(249, 224, 214)` | Callouts, blocks, hero image tray (same value as `--bg`) |
| `--cs-line` | `rgba(48, 30, 24, 0.1)` | Hairline dividers |

`--ink`/`--cs-ink` and `--bg`/`--cs-pink` are intentionally the same colors defined twice — the two stylesheets don't share a token file, so if the palette ever changes, **update both `:root` blocks.**

**There is no color variation between card types.** `.card-purple`, `.card-orange`, `.card-teal`, `.card-sky` are legacy naming — every card renders the identical translucent glass fill above. See §3.3.

### 2.2 Typography

| Role | Font | Weights loaded | Notes |
|---|---|---|---|
| Headline | **Raleway** | 600, 700, 800 | Every heading-role element — see the full list in §2.2.1. Loaded as a variable font, so any weight 100–900 works even if not explicitly requested. |
| Body | **Roboto** | 400, 500, 600, 700 (case study also loads 800) | Base font for both stylesheets; everything not explicitly a headline inherits this. |
| Label / mono accent | **Roboto Mono** | 400, 500 | Small uppercase-ish labels only — `card-label`, `cs-block-label`, `cs-exp-label`. Never used for headline or body copy. |

Fonts load via the Google Fonts `css2` variable-font endpoint in both stylesheets' first line.

#### 2.2.1 Type scale

**Landing page (`styles.css`):**

| Element | Font | Weight | Size | Notes |
|---|---|---|---|---|
| `.panel-hello` | Raleway | 700 | 22px | Sticky panel greeting |
| `.panel-tagline` | Raleway | 800 | 28px (24px < 560px) | `line-height: 1.3`, `letter-spacing: -0.3px` |
| `.card-title` | Raleway | 600 | 18px | `line-height: 1.35` |
| `.card-eyebrow` | Raleway | 600 | 15px | "Highlights" label |
| `.mini-title` | Raleway | 600 | 15px | `line-height: 1.3` |
| `.card-label` | Roboto Mono | 400 | 10px | `letter-spacing: 0.02em`, 0.75 opacity |
| `.highlights-line` (active) | Roboto | 700 | 17px | `line-height: 1.4` |
| `.tab` | Roboto (inherited) | 500 | 14px (13px < 560px, 12px < 360px) | |

**Case study (`case-study.css`):**

| Element | Font | Weight | Size | Notes |
|---|---|---|---|---|
| `.cs-hero h1` | Raleway | 800 | 34px (26px < 640px) | `letter-spacing: -0.3px` |
| `.cs-section h3.cs-h1-style` | Raleway | 800 | 26px | Section sub-heading, `letter-spacing: -0.2px` |
| `.cs-section h4` | Raleway | 700 | 18px | Takeaways sub-headings |
| `.cs-block h3` | Raleway | 700 | 17px | Block title |
| `.cs-section h2` | Raleway | 600 | 13px | Section kicker — uppercase, `letter-spacing: 0.06em`, muted color |
| `.cs-subtitle` | Roboto (inherited) | 400 | 19px (17px < 640px) | `line-height: 1.5` |
| `.cs-section p` | Roboto (inherited) | 400 | 16px | `line-height: 1.65` |
| `.cs-stat-value` | Roboto (inherited) | 800 | 30px | `letter-spacing: -0.5px` — a data display, not a headline, so intentionally stays on the body font |
| `.cs-block-label` / `.cs-exp-label` | Roboto Mono | 400 | 11px / 10px | `letter-spacing: 0.04em`, muted |

**Gotcha:** watch selector specificity whenever a class-scoped rule and a color-scoped rule both touch the same element (e.g. `.card-bg-img`). `.card-teal .card-bg-img` and `.card-bg-img.phone-mockup` have *equal* specificity (two classes each) — the one later in the stylesheet wins, not the one that "feels" more specific. If a rule you just added isn't taking effect, check for a same-specificity rule further down the file.

### 2.3 Spacing & layout

| Token | Value | Used for |
|---|---|---|
| `--gap` | `28px` | Standard gap between cards, masonry columns, mini-row |
| `--radius` | `26px` | Base card radius (actual rendered radius is `calc(var(--radius) + 6px)` = 32px) |
| `--panel-width` | `clamp(280px, 26vw, 420px)` | Sticky bio panel width |
| Masonry max-width | `1400px` | `.masonry`, 2-column grid, `1fr 1.1fr`, centered via `margin: 0 auto` |
| Case study content width | `700px` | `.cs-main` |
| Case study horizontal padding | `24px` | `.cs-main` |

Breakpoints: landing page collapses to a single column and stacks the sticky panel at **960px**; tabs go horizontally scrollable and the tagline shrinks at **560px**; tab padding tightens further at **360px**. Case study images/grids stack to a single column at **640px**.

### 2.4 Elevation — the "liquid glass" effect

Every `.card` is built from four layers, in order:

1. **Gradient + translucent fill** — `linear-gradient(160deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.04) 45%, rgba(255,255,255,.1) 100%)` over `var(--card)`.
2. **Backdrop blur** — `blur(10px) saturate(200%)` as the baseline; where `@supports (backdrop-filter: url(#glass-distortion) blur(1px)))` passes, this upgrades to `url(#glass-distortion) blur(3px) saturate(200%)` — the SVG filter (defined inline in `index.html`) now carries most of the "glass" read, so the blur component itself is deliberately light. Browsers that can't render SVG filters inside `backdrop-filter` (older Safari/Firefox) silently keep the plain 10px blur — no breakage, just less bend.
3. **`::before` highlight layer** — a radial gradient top-left (`8% -8%`, 0.8 opacity) plus a `-45deg` linear sheen, modeled on an Apple-style "Liquid Glass" light setting (angle -45°, intensity 80%).
4. **Box-shadow stack** — inset highlights (top edge, top-left glow) + inset shadows (bottom edge, inner depth — deliberately shallow, a low "Depth" setting) + two drop shadows (soft ambient + tight contact). Hover state (`a.card:hover`) intensifies all of these and lifts the card `translateY(-5px) scale(1.012)`.

If you add a new card-like surface, copy the full `.card` rule rather than approximating it with a plain `box-shadow` — the layering is what reads as "glass," any one piece alone looks flat.

**The SVG filter (`#glass-distortion`, defined inline in `index.html`) does two things, not one:**

- **Refraction** — a `feTurbulence` + `feGaussianBlur` noise field feeds three `feDisplacementMap` passes at different scales (16 / 14 / 12), one per RGB channel (isolated via `feColorMatrix`, recombined with `feBlend mode="screen"`). Displacing each color channel by a slightly different amount is what produces subtle chromatic fringing at high-contrast edges instead of a flat, colorless warp — real optical dispersion, not just a bent image.
- **Splay control** — `numOctaves="1"` on the turbulence plus a wide `feGaussianBlur` (`stdDeviation="7"`) smooths the noise field so the bend reads as clean optical refraction rather than mottled scatter.

**Tuning history worth knowing:** the displacement scale started at 38 (a value already tuned once before, "clean not mottled"), got pushed to 72–77 chasing a literal reading of an Apple "Liquid Glass" reference panel, and came back down twice after that read as too strong — first to ~34/38, then to the current 16/14/12. If it ever needs retuning again, start from 16/14/12 and nudge gently rather than re-deriving from a design-tool reference panel's literal slider values, which read far stronger in a browser than in the panel.

### 2.5 Motion

| Interaction | Duration / easing | Where |
|---|---|---|
| Card hover lift | `0.35s cubic-bezier(0.2, 0.8, 0.2, 1)` | `transform`, `box-shadow` on `.card` |
| Disable / enable fade | `0.45s cubic-bezier(0.22, 1, 0.36, 1)` | `opacity`, `filter` on `.card`, `.mini-row` when `.is-disabled` toggles |
| Filter reorder (FLIP) | `0.5s cubic-bezier(0.22, 1, 0.36, 1)` | Inline `transform`, set by `script.js` per-card, removed after `transitionend` |
| Highlights crossfade | `0.5s cubic-bezier(0.16, 1, 0.3, 1)` | `opacity`, `transform` on `.highlights-line` |
| Tab active state | `0.2s ease` | `background-color`, `opacity` on `.tab` |
| Highlights dot state | `0.3s ease` | `background-color`, `transform` on `.highlights-dot` |

Two easing families do all the work here: `cubic-bezier(0.2, 0.8, 0.2, 1)` for physical, weighted movement (hover, lift) and `cubic-bezier(0.22, 1, 0.36, 1)` / `cubic-bezier(0.16, 1, 0.3, 1)` for soft settle-in fades. Reach for one of these three curves before inventing a new one.

### 2.6 Background grid (`.bg-grid`)

The pink ruled-grid pattern behind the landing page cards is a real element (`<div class="bg-grid">`, first child of `.page`), not a plain CSS background on `.content` — it has to be a real element because `script.js` needs to measure its rendered width.

- **It scrolls with the cards, not fixed to the viewport.** `.bg-grid` is `position: absolute` against `.page` (which is `position: relative` for exactly this reason), not `position: fixed`. It was fixed originally, on the theory that cards "floating over" a stationary background looked more premium — in practice that read as the cards and background drifting apart, so it was changed to scroll as one piece. If this ever gets revisited, know that both were deliberately tried.
- **It's inset 40px from the top/left/right of the content area** (left offset is `panel-width + 40px`, so it starts past the sticky panel, not from the viewport edge) — that's what leaves a plain-color margin on those three sides instead of the pattern running edge-to-edge.
- **`script.js` sizes it on load and resize** so a whole number of tiles always fits exactly across its width, keeping a full grid line at the right edge instead of a partial tile getting clipped. It targets a tile size close to 1040px (`TARGET_TILE` in `script.js`) and picks the nearest whole-tile count, rather than forcing exactly one tile or exactly some fixed count — this is what makes it responsive without ever showing a cut-off column.
- **`background-position: center top`** — combined with the JS sizing above, this keeps the pattern centered on the content column rather than left-aligned, so it lines up with `.masonry` (which is itself centered via `margin: 0 auto` once the viewport is wider than the masonry's own max-width).
- **Gotcha:** `.bg-grid` needs an explicit `z-index` (currently `1`, with `.masonry` at `2`) — without one, `.content` (which comes later in the DOM at the same effective stacking level) silently paints over it and the grid disappears entirely. This isn't a specificity issue, it's a DOM-order stacking tie; if the grid ever goes invisible again, check z-index first before touching anything else.

---

## 3. Components

### 3.1 Sticky panel (`.sticky-panel`)

Fixed-width bio/nav column, sticky on desktop, stacks to a normal-flow block above content under 960px. Contains greeting (`.panel-hello`), tagline (`.panel-tagline`, the only real `<h1>` on the landing page), the linked intro (`.panel-intro`, see §4.7), and contact links (`.panel-links`). On desktop screens under 860px tall it tightens, and if it still doesn't fit, `.panel-inner` scrolls on its own rather than clipping. The scalloped edge is a repeating radial-gradient mask (`.sticky-panel::after`), not an image.

### 3.2 Tab filter (`.tabs` / `.tab`)

Pill-group nav: `All`, `About`, `Projects`, `Exploration` (internally still `data-filter="for-fun"` — see §6.1). Active state is a solid white pill; clicking a tab calls `applyFilter()` in `script.js`, which reorders and dims cards rather than hiding them — see §4.2.

### 3.3 Card (`.card`)

The base surface for every tile on the grid. Anatomy: `.card-top` (label + title, z-index 2) stacked over a bottom-anchored `.card-bg-img` (z-index 1), with an optional `.card-badge` pinned top-right and a `.card-btn` pinned bottom-left.

**Color-hook classes carry no color.** `.card-purple`, `.card-orange`, `.card-teal`, `.card-sky` exist purely to key `min-height` and image-sizing rules per card — every card renders the same glass fill (§2.4). Pick any name for a new card; it's a sizing hook, not a swatch.

**Two image treatments — pick the one that matches your asset's aspect ratio, then size the card to match:**

| Treatment | Trigger | Image sizing | Pair with |
|---|---|---|---|
| Wide / landscape | default (no extra class) | `width: 86%; max-width: 480px; bottom: -6px;` rounded top corners + drop shadow | Shorter card — `min-height: 380px` (Space Centre, Turn Tool use `.card-orange`/`.card-sky`) |
| Phone mockup | add class `phone-mockup` to the `<img>` | `width: 44%; max-width: 220px; bottom: -20px;` | Taller card — `min-height: 480–500px` (UltraBasic `.card-teal` at 480px, Seat Selection `.card-purple` at 500px) |

Mismatching these is the most common layout bug in this system — a wide image in a tall card leaves dead space above it; a phone image in a short card gets clipped at the top, or crowds the title text above it (UltraBasic's card needed its `min-height` bumped from 440px to 480px for exactly this reason — the title and phone image had only ~3px of clearance at some viewport widths, which read as touching).

**States:**
- `:hover` (anchor cards only) — lift + intensified shadow (§2.4).
- `.is-disabled` — set by the tab filter, not authored by hand. Frosted over by the card's `::after` veil (glass tint at full strength, so the card stays solid glass rather than see-through), `pointer-events: none`, and removes the card's link(s) from tab order. See §4.2.

### 3.4 Card badge (`.card-badge`)

Small pill, top-right, `🔒 Password protected` — flags a WIP/confidential case study on its tile. Reuse verbatim for any future project that isn't ready to be fully public (see Seat Selection's tile).

### 3.5 Card button (`.card-btn`)

Bottom-left pill CTA, white on glass, with a 12×12 arrow icon (inline SVG, always the same path — copy it exactly rather than re-drawing). `.small` variant (used inside mini cards) drops the absolute positioning to sit in normal flow at the bottom of its flex column.

### 3.6 Highlights card (`.card-highlights`)

A special card (not a link) that auto-advances through a list of bio facts. Anatomy:
- `.card-eyebrow` — "Highlights" label.
- `.highlights-viewport` → `.highlights-line.is-active` — the single visible line; text is swapped via JS, not multiple DOM nodes.
- `.highlights-dots` → generated `.highlights-dot` buttons (24px hit area around a 6px dot), one per item in `.highlights-data li` — **do not hand-author dots in HTML**, `script.js` builds them from the data list length so they always stay in sync.
- `.highlights-data` — the actual content, a hidden `<ul>`. **This list is the single source of truth** for both the rotating text and the dot count.

Behavior: advances every 3.4s and crossfades with a 6px vertical drift. It pauses on hover and on keyboard focus, the dots step to an item (and only then is the change announced to screen readers), and with reduced motion on it never auto-advances — moving content must be stoppable (WCAG 2.2.2). To add/remove a bio fact, edit only the `<li>` items — everything else (dot count, cycling) follows automatically.

### 3.7 Mini card / mini row (`.mini-row`, `.card-mini`)

Two half-width cards side by side (`grid-template-columns: 1fr 1fr`, stacks under 560px), always rendered and filtered as **one unit** — see §4.2 for why. `.card-mini-tan` / `.card-mini-cream` are, like the project card colors, naming only (both currently render identical `rgba(255,255,255,0.25)` fills).

### 3.8 Photo card (`.card-photo`)

Full-bleed image card (`object-fit: cover`), no `.card-top` — used once, for the About tile.

### 3.9 Case study components (`case-study.css`)

Every case study is built from this fixed vocabulary. **Reuse these classes rather than one-off styling** — visual consistency across case studies matters more than any single page's uniqueness.

| Class | What it's for |
|---|---|
| `cs-hero` (`h1`, `.cs-subtitle`, `.cs-meta`, `.cs-meta-row`, `.cs-stats`/`.cs-stat`) | Title, one-line summary, quick facts (Role/Timeline/Platforms/Areas), optional headline metrics |
| `cs-hero-images` | Wide shot + narrower supporting shot, side by side |
| `cs-section` (`h2` kicker, `h3.cs-h1-style` sub-heading, `p`, `h4`) | Standard content section — Background, Challenge, Discovery, etc. |
| `cs-callout` | Single-line pull-quote framing the core problem or outcome |
| `cs-block` (+ `cs-block-label`) | Labeled highlight box — Challenge #1, Goal, Pain point, Design Decision, Feature, etc. (see §5.2 for the labeling convention) |
| `cs-figure` (+ `cs-panel-row`, `cs-panel-pair`, `cs-exp-label`) | Image or image-group with a caption |
| `cs-touchpoints` | Horizontal row of labeled screens — built specifically for a multi-surface story (e.g. booking / self-serve / check-in). Reach for this whenever a project spans more than one product surface. |
| `cs-triplet` / `cs-pair` | Grid of 3 / 2 unlabeled images |
| `cs-triplet.has-mobile` | Same, but for a triplet mixing desktop + mobile screenshots — desktop images get wider columns (`1.3fr`), the one marked `is-mobile` is capped at 220px and centered, so a phone screenshot doesn't stretch to the same visual size as a full desktop layout. Mark the mobile `<img>` with class `is-mobile`. |
| `cs-collage` | Single full-width image |
| `cs-footer` | Sign-off line |
| `cs-toc` (page-level, not authored by hand) | Sticky right-rail table of contents, scroll-spy highlighted — see §4.4. Generated by `toc.js` from the page's own `h2` headings, not part of the copy-paste template. |

**`cs-meta` quick facts are tiered by value length, not just listed flat:**
- Short values (a word or two — Role, Timeline, Platforms) sit directly in `.cs-meta` as plain `.cs-meta-item`s, which wrap freely.
- A value that runs a full sentence or list (a team roster, a long "Areas" list) loses that wrapping fight — it gets bumped onto its own line but stays left-aligned in the row above, leaving an orphaned gap next to it that reads as a layout bug. Put any such item inside a `.cs-meta-row` (a dedicated 2-column row) instead — one long item alone in it is fine, just leave the second column empty. UltraBasic's Team + Areas pairing is the reference example.
- Headline metrics go in their own `.cs-stats` wrapper (holding one or more `.cs-stat`s), never loose inside `.cs-meta` directly — keeps the quick-facts and the numbers reading as two distinct groups instead of one undifferentiated row.

**`cs-panel-pair` top-aligns its labels on purpose** (`align-items: flex-start`, not `flex-end`) — the two screenshots being compared are almost never the same height, and bottom-aligning them instead stacks "Experience A"/"Experience B" at different heights, which reads as broken rather than compared. If you ever need to touch this rule, keep the labels on one line; let the images be the ragged edge, not the text.

New case study → copy [case-study-template.html](case-study-template.html), replace every `[BRACKETED]` placeholder, delete unused sections, swap asset paths, add `<script src="toc.js"></script>` before `</body>` (§4.4), then add a tile linking to it from `index.html` (§3.3).

---

## 4. Patterns

### 4.1 WIP / confidential project

For a project still in development or under NDA-adjacent constraints (Seat Selection is the reference example):

1. Add `.card-badge` (`🔒 Password protected`) to its tile.
2. Keep company names and unlaunched specifics out of the case study body copy, even if named elsewhere on the site (e.g. the sticky panel's Highlights list already says "WestJet" — the case study itself doesn't).
3. Frame any metrics narrowly and honestly — e.g. "$50K+ from early A/B tests" is scoped as a signal from isolated content tests, not a claimed result of the (unlaunched) full redesign.
4. Gate the page itself — see §4.3.

### 4.2 Filter without hiding

`script.js`'s tab filter reorders instead of hiding:

- Non-matching cards get `.is-disabled` (§3.3) instead of `display: none` — the grid never collapses awkwardly, it just visibly deprioritizes what doesn't match.
- Every filter click reorders each column's children (matches first, non-matches after, both groups keeping their relative order) and animates the move with a **FLIP transition**: record position → reorder the DOM → invert with a `transform` → play the transition to identity, cleaning up the inline `transition` on `transitionend`.
- Reordering always starts from a **canonical order captured once at page load** (`originalOrder`, a `Map` from column → its original children array) — never from the current DOM order. Otherwise clicking "All" after another filter would just freeze whatever order that filter left behind instead of restoring the real layout.
- `categoryOf(item)` reads `data-category` off the item itself, or its first descendant that has one — this is what lets `.mini-row` (which has no `data-category` itself) get treated as a single reorderable unit matching its children's shared category. **Side quests and Showcase must never be split across columns** — they always share a category by construction, so this holds automatically, but don't add a mini-card with a different category than its row-mate without rethinking this.
- Adding a new top-level card needs zero JS changes as long as it has `data-category` set correctly.

### 4.3 Password-protecting a WIP case study

No backend exists, so there's no real server-side auth — the pattern used on `seatselection.html` is a **client-side AES-256-GCM encryption gate**:

- The case study's `<main>` content is encrypted with a key derived from a password via PBKDF2-SHA256 (250,000 iterations) using the Web Crypto API. Only `{salt, iv, iterations, ciphertext}` ships in the page source — no readable content exists until the correct password is entered.
- The password form derives the same key in-browser and attempts decryption; on success it injects the decrypted HTML and caches it in `sessionStorage` so the rest of the tab session doesn't re-prompt.

**What this does and doesn't do:** stops search engines, casual link-sharing, and view-source snooping. Does **not** stop someone determined to brute-force the password offline — there's no server to rate-limit attempts. Treat it as a soft gate, not access control.

To set this up for a future project: encrypt the content using `crypto.subtle` (run the encrypt script in any browser console — see the git history on `seatselection.html` for the exact script), embed the resulting object, reuse the existing gate markup/JS pattern. **Never write the actual password into this repo or the vault** — both are effectively public (GitHub Pages requires a public repo on the free tier), which would defeat the gate entirely.

### 4.4 Table of contents (`toc.js`)

Every case study gets a sticky, scroll-spy "Contents" nav for free — `toc.js` scans `.cs-main .cs-section > h2` on the page, generates slugged anchors, and highlights the current section via `IntersectionObserver` as you scroll. There's nothing to hand-write per page; it just reads whatever `h2` headings already exist.

- Include it with `<script src="toc.js"></script>` before `</body>` on any case study page. It runs automatically on `DOMContentLoaded`.
- If a page has fewer than 2 section headings, it silently does nothing (no TOC for a page too short to need one).
- **Pages that inject content dynamically after load must call it again manually.** `seatselection.html`'s password gate is the example: its headings don't exist in the DOM until the correct password decrypts and injects the content, so its `reveal()` function calls `window.buildCaseStudyTOC()` right after `main.innerHTML = html`. Any future page with a similar reveal-after-load pattern needs the same explicit call — `toc.js`'s own `DOMContentLoaded` listener will have already run and found nothing.
- The nav is positioned relative to `.cs-main`'s own edge (`left: calc(50% + 390px)`), not a fixed viewport offset, so it stays a consistent gap from the content column at any width — and it's hidden below 1300px, where there isn't reliably enough room beside the 700px content column for it to sit without crowding.

### 4.5 Site nav (`site-nav.js` / `site-nav.css`)

A "← Prev · Page ▾ · Next →" pill on every page, borrowed from karyll.com. The page order lives in one `PAGES` array at the top of `site-nav.js` — prev/next, the dropdown and the number shortcuts all derive from it, so adding or reordering a case study means editing that array and nothing else. Pages not in the array (e.g. `case-study-template.html`) get no nav.

- Placement is CSS-only, keyed off `data-context`: centred in the top bar on case studies and the Showcase, and floating at the bottom of the screen at 960px and below. On the homepage there's no separate pill: the filter tabs (`.tabs`) become the nav — `site-nav.js` appends a divider and a menu button to them, and they float to the bottom on phones like the pill does elsewhere.
- Below 1300px on case studies the steps drop to arrows only, so the pill never collides with the Contents dropdown.
- Keys: ←/→ prev/next, `1`–`5` case studies, `H` home, `A` about, `/` menu. Arrow keys are ignored while anything with `.is-open` is showing (lightboxes, Showcase panel, Contents dropdown), since those use the arrows themselves.

### 4.6 Show the thinking (`thinking.js`)

Press `T` (or flip the switch in the panel) to overlay the reasoning behind the homepage: numbered avatar pins that open a note on a product decision, plus a live accessibility check. Framed through a product lens (who it serves, what it's for, who it includes), not layout specs. Authored as HTML attributes, nothing page-specific in the script:

- `data-note="…"` — a pin on that element's top-right corner, numbered in DOM order. First person, one or two sentences, about *why*. Every claim in a note must be true of the live site (e.g. the reduced-motion and keyboard claims are backed by §3.6 and §4.7).
- `data-measure` — a dashed outline labelled with that text's WCAG contrast ratio against the first solid background behind it, computed from live styles (AA/AAA thresholds adjust for large text).

Homepage only, by choice: `thinking.js` is loaded on `index.html` alone. The on/off state is stored in `localStorage`.

### 4.7 Linked intro + card hover (`script.js`)

Borrowed from karyll.com, reframed for a product-designer lens. Each project sentence in `.panel-intro` carries `data-work="<page>"` matching a card's `href` (`data-work="ultrabasic"` ↔ `href="./ultrabasic.html"`), so there's no second list to keep in sync. On desktop pointers only:

- **Hover or keyboard-focus a card:** a coral selection box with corner handles labelled with the card's `data-outcome` (the journey it covered and what it moved, e.g. "Booking to check-in · 3 flows into 1 · $50K/yr from A/B tests"), the rest of the grid is frosted over (the same `::after` veil, lighter), and the title turns coral. Cards don't light up the intro — the link is one-way, by choice. Focus works on every device; the image drift is mouse-only and off under reduced motion.
- **Hover a sentence:** the same selection on its card, and that sentence is spotlighted while the rest of the intro dims. A sentence can name several pages, space-separated.

Cards the filter has dimmed (`.is-disabled`) are never selected. The selection box is its own fixed element (`.card-selection`) so it isn't clipped by the card's `overflow: hidden`. This replaced the old 3D hover tilt — a selection box around a tilted card never lines up.

---

## 5. Content & voice

### 5.1 Voice

Calibrated against the real, already-published Roots Collective case study on ginahsu.co — a genuine prior project, the source of truth for tone rather than something invented for this system:

- **First-person, modest, concrete.** "I created the design system and website from the ground up," not "A comprehensive design system was developed."
- **Short, gerund-style block titles**, not full descriptive sentences — "Gathering a vision that wasn't written down anywhere," not "The team lacked a documented long-term vision for the brand."
- **A Goal beat** between Challenge and Discovery, framing what success would concretely look like.
- **Section names follow the real narrative**, not a rigid fixed template — Turn Tool uses "The Discovery / The Journey / The Product" because that's how the project actually unfolded; Space Centre uses "The Discovery / The Vision." Don't force identical section names across case studies.
- **Takeaways are genuinely reflective**, including what was hard or what you'd do differently — "It seemed overwhelming but..." not a tidy lessons-learned bullet list.
- **Never invent specifics.** No fabricated challenges, metrics, or research insights — ask, or leave a placeholder, for anything not actually described.

### 5.2 `cs-block-label` vocabulary

The small mono label above a block's title names what kind of beat it is — keep these consistent so the pattern stays legible across case studies:

`Challenge #1/#2` · `Goal` · `Research insight` · `Pain point #1/#2` · `Opportunity #1/#2` · `Design Decision` · `Feature` · `Phase 1/2/3` · `Core team` / `Extended mentorship`

Reuse an existing label where the content genuinely matches; invent a new one only when none of these fit.

---

## 6. Governance

### 6.1 Naming debt (known, intentional)

- Card color classes (`card-purple/orange/teal/sky`, `card-mini-tan/cream`) name colors that don't exist (§3.3, §3.7) — they're sizing hooks now. Don't "fix" this by adding real color variation without discussing it; the flat palette is deliberate.
- The "Exploration" tab still uses `data-filter="for-fun"` internally — cosmetic label change only, not worth a rename of the underlying data attribute and its two `data-category="for-fun"` references.

### 6.2 File structure

```
index.html              Landing page — hero panel, tab filter, masonry card grid, .bg-grid
styles.css                Landing-page styling
case-study.css             Case-study-page styling, shared by every case study
case-study-template.html  Starting scaffold for a new case study (not linked from the site)
script.js                  Card hover selection + linked intro, highlights carousel, tab filter + reorder, bg-grid sizing
toc.js                      Shared scroll-spy table of contents, included on every case study page
site-nav.js / site-nav.css  Prev/page/next pill (every page) + "Show the thinking" styles
Edit site.command           Double-click to start the local browser editor (§6.6)
tools/                      edit-server.py + editor.js - the local editor, never loaded by the live site
thinking.js                 "Show the thinking" overlay (grid, redlines, note pins), homepage only

spacecentre.html           Case study — H.R. MacMillan Space Centre (real content + real assets)
seatselection.html         Case study — seat selection redesign (public, NDA-safe version; WIP project)
designingwithai.html       Case study — building this portfolio with Claude Code (token panel, glass, motion)
turntool.html               Case study — Turn Tool multi-flight dashboard
ultrabasic.html             Case study — UltraBasic & Extended Comfort (complete reference example)
showcase.html               Standalone infinite pannable image grid, linked from the "Showcase" mini-card

assets/                    Images used directly on index.html
assets/<project>/           Per-case-study images, e.g. assets/spacecentre/, assets/turntool/, assets/showcase/
```

`showcase.html` is intentionally self-contained (its own inline `<style>`/`<script>`, not `case-study.css`/`toc.js`) since it's a full-viewport drag-to-pan experience, not a scrolling document — see the comments at the top of its script for how the infinite-recycling grid works if it ever needs extending.

### 6.3 Content status

| Case study | Content | Assets |
|---|---|---|
| UltraBasic | Complete, real | Real (`assets/ultrabasic/`) |
| Space Centre | Complete, real | Real (`assets/spacecentre/`) — hero, brand colour/typography pair, a "brand in action" collage, and a desktop+mobile page triplet. See §3.9's `has-mobile` modifier for how the triplet is sized. |
| Seat Selection | Complete, real, now public (kept generic — no company name in body copy; project still in development) | Real. Desktop shots use `public-*.png` crops with the branded header removed |
| Designing with AI | Drafted Oct 2026 from repo history; lines marked `CONFIRM` need Gina's sign-off | Real screenshots of this site (`assets/ai/`), incl. an early-build capture from commit `7582091` |
| Turn Tool | Complete, ported from the live ginahsu.co case study | Hero image real (`assets/turntool/hero-main.png`); remaining figures placeholder — see `TODO` comments |
| Showcase | — (no body copy, just a title pill + drag hint) | Placeholder colored tiles in `showcase.html`'s `TILES` array — see the `TODO` at the top of its script for how to swap in real Roots Collective / Turn Tool graphics |

When in doubt about a project's real content, check **https://www.ginahsu.co/** first — several case studies (Roots Collective, Turn Tool) already exist there in full and should be ported/adapted, not rewritten from scratch. For a project with a real, live production site (e.g. Space Centre at spacecentre.ca), full-page screenshots need cropping before use — see §6.5.

### 6.4 Local testing

- Test through a local server (`python3 -m http.server`), not `file://` — some tooling renders `file://` pages as static snapshots with no JS/CSS execution.
- Plain static servers send no cache headers, so browsers cache CSS/JS aggressively. If an edit doesn't show up on reload, hard-bust it (cache-busting query string, or a genuinely uncached reload) before assuming something's broken.
- **Bump the `?v=` query on CSS/JS links whenever you change a stylesheet or script** (every page references them as e.g. `styles.css?v=20261024`). GitHub Pages lets browsers cache assets for ~10 minutes, so new HTML can load against old CSS — in Oct 2026 that pushed the homepage panel sideways for visitors with a cached `styles.css` (new `.bg-gradient` div, no rule positioning it yet). Find/replace the date across all `*.html` files. (The browser editor, §6.6, does this for you whenever it saves a token.)
- Start the server from the project root every time. `cd`-ing into a subfolder (e.g. to rename files in `assets/spacecentre/`) and starting the server from there without `cd`-ing back is a real, repeatable way to get a confusing 404 on every page.

### 6.5 Handling full-page screenshots

Real screenshots supplied for a case study (a client's live site, or exported design files) are very often full page-scroll captures — thousands of pixels tall, not a single viewport. Dropped straight into a hero or triplet slot, these render as an almost-blank box: the CSS only constrains width, so the image scales to a proportionally enormous height and you only ever see whatever sliver of it lands in frame.

Crop to a single reasonable viewport height before using one of these — Python's PIL (`Image.open(...).crop((0, 0, width, height)).save(...)`) works fine for a top-anchored crop; macOS's `sips` centre-crops by default, which isn't what you want here. As a rule of thumb, crop desktop shots to roughly 1000–1200px tall and mobile shots to roughly 2400px tall (matching a real phone viewport at 3x device pixel ratio) — enough to show the hero/nav/headline without dragging in the rest of the scroll.

### 6.6 Editing text and spacing in the browser

Double-click **`Edit site.command`** in the repo root. It starts `tools/edit-server.py` on `127.0.0.1:8130` (this Mac only) and opens the homepage. A dock in the bottom-right corner of every page has:

- **Edit** (`E`) — every text block becomes typeable, outlined in coral. Enter finishes a block, Shift+Enter adds a line break, Escape undoes that block. Text kept in `hidden` markup (the Highlights list) is shown while editing so it can be edited too. Links don't navigate while editing.
- **Spacing & color** — the `:root` tokens of every stylesheet on the page: px values get a slider, role tokens (`var(--space-lg)`) a scale-step picker, hex colors a color picker. Changes preview live.
- **Save** (`⌘S`) — writes straight into the source files, then reloads. Text edits replace exactly that element's inner HTML; token edits rewrite that one declaration and bump the stylesheet's `?v=` in every page automatically.
- **Publish…** — commits only the files saved from the editor and pushes the current branch. On `main` that's live in about a minute; on any other branch it waits for a merge.

What isn't editable: text generated by scripts (nav, Contents, the highlights carousel line - edit the revealed list instead), labels that share an element with an icon (`.card-btn`), and buttons. Edit those in the HTML directly.

Safety: the live site never loads `tools/editor.js` — the server injects it into pages it serves. Every editor request needs a random per-run token embedded in the served page, requests addressed to any host other than `127.0.0.1`/`localhost` are refused, and a save is refused if the file changed on disk since the page loaded.
