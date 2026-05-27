---
name: Enote
description: Sistema de notas de remisión para Xiera — panadería artesanal, Ocotlán, Jalisco.
colors:
  primary: "#7A3045"
  primary-deep: "#5C2233"
  bg-dusty-rose: "#C4A09A"
  surface-warm: "#F5EDEB"
  warm-white: "#FFFAF9"
  text-deep-brown: "#2C1810"
  text-muted-taupe: "#8B6E6A"
  border-petal: "#E8D5D0"
  status-nueva-bg: "#F9EEF1"
  status-nueva-text: "#7A3045"
  status-nueva-border: "#D4A0B0"
  status-proceso-bg: "#FFF8E7"
  status-proceso-text: "#7A5C00"
  status-proceso-border: "#E8D080"
  status-completada-bg: "#EAF5EE"
  status-completada-text: "#1A5C32"
  status-completada-border: "#8ECFA8"
  status-cancelada-bg: "#F0EFEF"
  status-cancelada-text: "#5A5250"
  status-cancelada-border: "#C0BAB8"
  danger: "#C0392B"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  title:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.4rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0em"
  body:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  xl: "24px"
  pill: "99px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
  8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted-taupe}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.text-deep-brown}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  badge-nueva:
    backgroundColor: "{colors.status-nueva-bg}"
    textColor: "{colors.status-nueva-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  badge-en-proceso:
    backgroundColor: "{colors.status-proceso-bg}"
    textColor: "{colors.status-proceso-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  badge-completada:
    backgroundColor: "{colors.status-completada-bg}"
    textColor: "{colors.status-completada-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  badge-cancelada:
    backgroundColor: "{colors.status-cancelada-bg}"
    textColor: "{colors.status-cancelada-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: Enote

## 1. Overview

**Creative North Star: "El Recibo Artesanal"**

Enote is a physical document made digital. The visual system starts from a single reference: the hand-written remission note that Xiera's baker hands the driver before loading the truck. That object is warm, worn, authoritative. It has no decoration beyond function: a number, a list of products, a destination, a stamp. The interface must feel like that document elevated, not like software that replaced it.

The surface itself is dusty rose, not a background tint but a material. Cards emerge from it in near-white warmth. Burgundy wine is the only accent, used exclusively for brand identity, primary actions, and note numbers (the most critical data on any screen). Cormorant Garamond heads the note number and modal titles; DM Sans carries everything workers need to read quickly. Shadows are warm-tinted (sepia base, never pure black) and stay low-profile except on modals.

This system explicitly rejects: the blank-canvas SaaS aesthetic of Notion and Linear, with cold white backgrounds and arbitrary accent colors; the grey-grid density of enterprise ERP like SAP; and the dopamine-reward palette of consumer delivery apps like Rappi or Uber Eats. Enote must feel like it was designed by someone who knew the bakery, not by someone who knew Figma.

**Key Characteristics:**
- Committed color strategy: dusty rose surface is the canvas, not a background tint.
- Serif for identity, sans for operation. The pairing is strict and non-negotiable.
- Status is unmissable: four semantic color states are the most visible system in the UI.
- Shadows are warm-tinted and restrained. No pure-black rgba anywhere.
- Touch targets sized for bakery conditions: busy hands, wet surfaces, quick glances.

## 2. Colors: The Panadería Palette

Warm, dusty, and intimate. Every neutral is tinted toward the brand hue. No cold greys exist in this system.

### Primary
- **Vino de la Tierra** (`#7A3045`, oklch 38% 0.12 6°): the burgundy wine anchoring the brand. Used on primary buttons, note numbers, the brand mark, modal titles, and focus rings. This is Xiera's identity on screen.
- **Vino Oscuro** (`#5C2233`, oklch 30% 0.10 6°): the deep wine used only on hover and active states of the primary button. Never used as a standalone fill.

### Neutral
- **Rosa de la Miga** (`#C4A09A`, oklch 72% 0.06 20°): the main app background. A dusty rose evoking terracotta, warm paper, and the flour-dusted countertop. Not a subtle tint but the dominant surface. Approximately 60-70% of any screen is this color.
- **Crema de Pan** (`#F5EDEB`, oklch 95% 0.015 20°): the secondary surface. Used in form field backgrounds, toolbar containers, modal footers, and the status confirmation bar.
- **Papel Nuevo** (`#FFFAF9`, oklch 99% 0.005 10°): card and modal background. As close to white as possible without losing the warm tint.
- **Cacao Profundo** (`#2C1810`, oklch 18% 0.04 33°): primary text. Rich, warm, never harsh.
- **Arcilla Muted** (`#8B6E6A`, oklch 54% 0.03 20°): secondary text, metadata, labels, and helper copy.
- **Pétalo Seco** (`#E8D5D0`, oklch 89% 0.02 20°): borders, dividers, and card bottom rules.

### Status Semantic
Four states carry the note workflow. Each is a tinted chip: soft background, matching border, legible dark text. All four must appear consistently: in card footers, detail view headers, and filter selects.

- **Nueva**: rose chip (`#F9EEF1` bg / `#7A3045` text / `#D4A0B0` border)
- **En Proceso**: amber chip (`#FFF8E7` bg / `#7A5C00` text / `#E8D080` border)
- **Completada**: green chip (`#EAF5EE` bg / `#1A5C32` text / `#8ECFA8` border)
- **Cancelada**: grey chip (`#F0EFEF` bg / `#5A5250` text / `#C0BAB8` border)

**The One Accent Rule.** `#7A3045` (Vino de la Tierra) is prohibited on decorative elements, secondary text, supplemental icons, and hover underlines. Its role is action and identity only. Its authority comes from rarity.

**The Warm Neutrals Rule.** No pure-black shadows, no cold grey borders, no `#fff` backgrounds. Every neutral references the brand hue even at near-zero chroma. `rgba(44, 24, 16, α)` is the shadow primitive for all elevation.

## 3. Typography

**Display Font:** Cormorant Garamond (with Georgia, serif fallback)
**Body Font:** DM Sans (with system-ui, -apple-system, sans-serif fallback)

**Character:** An editorial-artisanal pairing. Cormorant Garamond carries the weight of a hand-press document: refined, slightly formal, with high-contrast strokes that evoke printed receipts. DM Sans balances it with clean geometric humanist clarity optimized for screen reading at small sizes. The pairing works because they share no aesthetic territory: one is ceremony, the other is task.

### Hierarchy
- **Display** (Cormorant, 400 weight, 3rem, line-height 1, letter-spacing 0.08em): the brand mark on the login screen (`login-brand-name`). Reserved for the single wordmark instance per view.
- **Headline** (Cormorant, 600 weight, 1.5rem, line-height 1.2, letter-spacing 0.04em): modal titles and major section headings. Weight 600 sits firm without feeling heavy.
- **Title** (Cormorant, 400 weight, 1.4rem, line-height 1.2): note numbers on cards (`#0001`, `#0042`). The most prominent content data on the dashboard. Reads like a printed numeral.
- **Body** (DM Sans, 400 weight, 0.95rem, line-height 1.5): form inputs, card content, table data, detail views. Prose content max 65-75ch.
- **Label** (DM Sans, 500 weight, 0.75rem, line-height 1.2, letter-spacing 0.1em, uppercase): field labels, table headers, role chips, badge text. The uppercase treatment creates visual separation from body text without competing with Cormorant.

**The Cormorant Boundary Rule.** Cormorant Garamond is prohibited in: button labels, form field text, data table cells, error messages, badge text, and any context below 1rem. It lives exclusively in the brand mark and note numbers. Breaking this rule turns artisanal character into noise.

## 4. Elevation

Enote uses a warm-ambient shadow system, not flat tonal layering. Depth is earned: surfaces are flat at rest; shadows appear in response to interactivity or structural role. All shadows use `rgba(44, 24, 16, α)` — the Cacao Profundo base, never pure black.

### Shadow Vocabulary
- **Card resting** (`0 2px 12px rgba(44, 24, 16, 0.08)`): default state for note cards. Low diffusion, barely perceptible. Creates gentle lift from the dusty rose surface.
- **Card hover** (`0 6px 20px rgba(44, 24, 16, 0.12)`): paired with `translateY(-2px)`. Shadow deepens as the card rises.
- **Button** (`0 1px 4px rgba(44, 24, 16, 0.12)`): tight, close shadow. Gives tactile physical weight to primary buttons.
- **Header** (`0 1px 6px rgba(44, 24, 16, 0.06)`): minimal separation of the sticky header from content.
- **Modal** (`0 8px 40px rgba(44, 24, 16, 0.22)`): the heaviest shadow. Reserved for modal cards and overlays only.

**The Warm Shadow Rule.** Never use `rgba(0, 0, 0, α)` for shadows. The sepia-tinted shadow base unifies depth with the overall palette. A pure-black shadow on a terracotta surface is immediately wrong.

**The Flat-By-Default Rule.** Surfaces are flat at rest. A card that doesn't respond to hover gets no shadow. The button shadow is a tactile affordance, not a decoration.

## 5. Components

### Buttons
Gently rounded (8px), medium weight, with physical press feel. The hierarchy is unambiguous: primary is Vino de la Tierra, secondary is its outline, ghost is text-only.

- **Shape:** 8px radius (`--radius-md`). Consistent across all sizes. Not pill-shaped; not sharp.
- **Primary:** `#7A3045` fill / `#FFFAF9` text / 1.5px border / `0 1px 4px rgba(44, 24, 16, 0.12)` shadow / 12px 16px padding. Hover: `#5C2233`. Active: `translateY(1px)`. Focus: `0 0 0 3px rgba(122, 48, 69, 0.12)` ring.
- **Secondary:** transparent fill / `#7A3045` border (1.5px) and text. Hover: `#F5EDEB` fill.
- **Ghost:** no border / `#8B6E6A` text. Hover: `#F5EDEB` fill / `#2C1810` text.
- **Danger:** `#C0392B` fill / white text. Destructive actions only.
- **Small (.btn-sm):** 0.78rem / 8px 12px padding. Secondary actions in tight containers.
- **Icon (.btn-icon):** 32×32px / 4px radius. Inline toolbar actions.

**Mobile gap (known issue):** `.btn-sm` and `.btn-icon` fall below the 44px minimum touch target. Any new interactive element added to the mobile flow must meet 44×44px minimum.

### Status Badges
The workflow engine's visual output. Pill-shaped (99px radius), uppercase DM Sans label, 0.7rem at 0.08em tracking, 3px 10px padding, 1px full border. All four states must coexist in the filter select and be immediately distinguishable at a glance.

### Note Cards
The primary content unit on the dashboard. White background (`#FFFAF9`), warm border (`#E8D5D0`), 16px radius, card resting shadow. Layout: note number (Cormorant, 1.4rem, wine primary) top-left; status badge top-right; product list in italic body text; footer with border-top separator.

Hover: `translateY(-2px)` lift + deepened shadow. No opacity change; no color shift.

### Form Inputs / Selects / Textareas
Stroke-style fields. `#F5EDEB` (Crema de Pan) background, `#E8D5D0` border at 1.5px, 8px radius. The warm surface background distinguishes fields from the card background without using a harsh white.

Focus: border shifts to `#7A3045` + `0 0 0 3px rgba(122, 48, 69, 0.12)` ring. Custom select arrow: inline SVG triangle in Arcilla Muted, right-aligned, no OS appearance.

### Navigation (App Header)
Sticky Papel Nuevo bar, 1px Pétalo Seco bottom border, low header shadow. Brand mark in Cormorant 1.6rem primary wine, letter-spacing 0.06em. Right side: role chip, offline pending badge, logout ghost button.

Role chips are pill-shaped, uppercase DM Sans at 0.68rem. Three contextual fills: admin (wine `#7A3045`), sucursal (forest `#1A5C32`), repartidor (cobalt `#2563EB`).

### Diff Alert (signature component)
Shown when a note was modified between views. Amber background (`#FFF8E7`), amber text (`#7A5C00`), full warm border (`#E8D080`), 8px radius, inner padding 16px 24px. Corrected away from side-stripe border pattern.

## 6. Do's and Don'ts

### Do:
- **Do** use `rgba(44, 24, 16, α)` as the shadow base for all elevation without exception.
- **Do** reserve Cormorant Garamond for the brand mark, modal titles, and note numbers only. DM Sans handles all labels, buttons, form fields, and data.
- **Do** show all four status states with their full color triad (bg + text + border). Status must never be communicated with color alone; always pair color with a text label.
- **Do** keep all touch targets at minimum 44×44px. The app runs in a bakery: hands may be busy, wet, or powdered.
- **Do** test the dashboard and form on a phone at arm's length in poor light. If you squint, the target or contrast failed.
- **Do** use `#F5EDEB` (Crema de Pan) as the secondary surface for toolbars, form sections, and modal footers to establish depth without shadows.
- **Do** size the `#7A3045` wine accent to convey authority: primary buttons, brand mark, note numbers. Rarity is the point.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent on cards, alerts, or list items. This is prohibited. Use a full border, a tinted background, or a leading icon instead.
- **Don't** use Cormorant Garamond in button labels, form inputs, table cells, badge text, or any text below 1rem. It is identity, not chrome.
- **Don't** use pure-black shadows or cold grey borders. Every neutral carries a warm sepia tint toward `#2C1810`.
- **Don't** make Enote look like a SaaS product (Notion, Linear, Jira): no blank white backgrounds, no cold blue accents, no identical icon-plus-heading card grids.
- **Don't** make it look like enterprise ERP (SAP, Excel-like): no dense grey-on-grey tables, no deep hierarchical navigation menus, no modals stacked inside modals.
- **Don't** make it look like a consumer delivery app (Rappi, Uber Eats): no fully-saturated or neon colors, no gamification patterns, no celebratory illustrations.
- **Don't** use `#000` or `#fff` anywhere in the interface. Not in text, not in backgrounds, not in borders.
- **Don't** use the wine accent `#7A3045` for decorative purposes: hover underlines, supplemental icon fills, or dividers. Misuse destroys its authority.
- **Don't** show a spinner in the center of content during loading. Use skeleton states or inline loading indicators instead.
