---
name: Atlas
description: Professional monochrome interface for the local knowledge catalogue.
colors:
  accent: "#171717"
  canvas: "#f6f6f6"
  sidebar: "#f0f0f0"
  paper: "#ffffff"
  muted: "#626262"
  line: "#dfdfdf"
  accent-soft: "#ededed"
typography:
  headline:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 450
  control:
    fontFamily: "IBM Plex Sans, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 550
rounded:
  tag: "4px"
  field: "6px"
  button: "7px"
  panel: "12px"
spacing:
  related: "12px"
  panel: "20px"
  grid: "22px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
  input:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "10px 11px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "25px"
---

# Design System: Atlas

## Overview

**Creative North Star: "Professional monochrome"**

The user requested grey, black and white, stronger self-hosted typography, and black custom arrow, hand and text cursors without outlines or shadows. Atlas retains its name, navigation, tasks, factual content and application behaviour.

**Key Characteristics:**
- Neutral tonal hierarchy and charcoal actions.
- Stronger self-hosted typography.
- Existing responsive shell and divided summary ledger.
- Native custom cursors without a tracking overlay or animation.

## Colors

### Primary
- **Charcoal** (`accent`): main ink, primary actions, focus outlines and checkbox accent.

### Neutral
- **Canvas** (`canvas`), **Sidebar grey** (`sidebar`) and **Paper** (`paper`): page, navigation and panel surfaces.
- **Supporting grey** (`muted`): descriptions and secondary text.
- **Divider grey** (`line`): boundaries; **Soft grey** (`accent-soft`): selected tabs and secondary hover fill.

**The Monochrome Rule.** Keep the interface grey, black and white. Reserve green for success, red for errors and amber for warnings, alongside explicit labels.

## Typography

The frontmatter records the main type hierarchy. IBM Plex Sans is a self-hosted variable font with Arial and sans-serif fallbacks, preloaded with `font-display: swap`. Its SIL Open Font License is in `static/fonts/OFL.txt`.

Headings use weight 600; controls generally use 500–550. Supporting paragraphs use 14px and dense rows and fields 13px, with smaller metadata. At the mobile breakpoint the headline becomes 29px and section titles 20px. Summary figures use 32px desktop / 29px mobile, weight 550 and tabular numerals; dates and tab counts also use tabular numerals. Subtitles cap at 66ch and card prose at 70ch.

## Layout

Preserve the inherited responsive shell: a fixed sidebar (238px), main width capped at 1600px and desktop horizontal padding (45px). At 1150px and below the sidebar narrows to 205px, padding becomes 25px and paired work panels stack. At 760px and below navigation flows across the top and content padding becomes 18px. Tables retain scrolling and responsive column visibility.

The summary is one ruled ledger band, with four desktop columns and two mobile columns. Cards have 25px desktop / 20px mobile padding. The theme gives the desktop main area 42px top padding, reduced to 28px on mobile. These are observed measurements, not a new universal grid.

## Elevation & Depth

Resting panels use tonal layering and fine borders. Primary buttons have no resting shadow; hover adds diffuse elevation. Dialogs and toasts use stronger shadows, documented in the sidecar. The dialog backdrop is dark translucent with no blur.

Fine pointers with hover use a smooth black arrowhead without a stem on ordinary surfaces, a smaller solid black smooth hand on interactive controls (including the file selector button), and a slightly shorter thick black I-beam over all text fields, including the AI textarea. All three SVGs use solid black without an outline or shadow. The I-beam has straight horizontal caps and a straight stem with rounded ends. No page overlay or cursor-tracking JavaScript is used. Touch devices keep their native behaviour.

**The Cursor Rule.** Keep cursors solid black without outlines or shadows, with accurate hotspots and native fallbacks. Never restore a large radial glow.

## Shapes

Use the recorded panel, button, field and tag radii for their corresponding components. Summary ledger cells remain square and transparent. Dialogs retain their larger inherited radius (15px); avatars remain circular.

## Components

- **Buttons:** charcoal primary, white secondary and transparent quiet variants; control typography, minimum height (42px), fine borders and compact padding. Primary hover lightens the dark fill and adds shadow; active darkens it. Disabled controls reduce opacity.
- **Inputs / Fields:** white, neutrally bordered, dark text and caret, visible grey placeholders; body weight at 13px. Preserve task-specific textarea sizing and resize behaviour.
- **Navigation:** neutral default and hover states, inverse charcoal selection; 13px desktop / 12px mobile labels, minimum targets (44px), selected weight 550.
- **Cards / Containers:** white bordered panels without resting shadows; catalogue clipping follows the panel radius. The summary ledger is a separate flat band.
- **Tags / Status:** fine-bordered compact tags and neutral type badges; error pills use red, success pills green and warning pills amber, with explicit labels.
- **Focus:** interactive elements share a charcoal outline (2px), offset by 3px. Text selection and scrollbars are neutral. Custom cursors do not replace focus or status signals.

## Do's and Don'ts

### Do:
- **Do** preserve the Atlas name, tasks and responsive navigation.
- **Do** retain the self-hosted type hierarchy and visible keyboard focus.
- **Do** keep custom cursors limited to hover-capable fine pointers.

### Don't:
- **Don't** restore green or cream as the interface theme.
- **Don't** add a cursor-tracking overlay or large glow.
- **Don't** promote inherited uppercase micro-labels, eyebrow treatments or tiny footer text into new design prescriptions; this refinement did not redesign those patterns.

## Input controls and recovery

Use the shared button for CSV selection and a separate selected-file label. Required-field feedback appears under the control, with a red-tinted field and `aria-describedby`; browser validation bubbles are disabled only in favour of these checks, while backend validation remains active. Browser/OS permission and file-picker dialogs retain their native UI. The 404 page uses the same font, neutral surfaces and return actions.

The AI field guide keeps grey chips: required Name and Type come first, then Owner, Description and Reviewed; the three-dot button reveals URL, Tags and Connections. Do not replace them with black/white chips. Dictation sits next to Ask Atlas with a visible Stop state, language control and speech-service notice. It updates the text only, follows incoming interim words and retains the visible transcript on pause.

The AI request has quiet Clear and Undo controls below its lower-left edge. Keyboard undo/redo applies only to this editor, including Clear, examples and grouped dictation sessions. A compact five-bar wave replaces the microphone while listening; speech events activate its bounded CSS motion. It rests in silence and has a static reduced-motion variant. It does not display a measured volume level.
