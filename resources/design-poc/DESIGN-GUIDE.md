# Nesse design guide

This guide sets the shared UI rules for new Nesse pages and components. It is a
design and implementation reference, not a description of product features.
Use it alongside the [design prototype](./index.html), which is the current
visual reference. Where a screen has a genuine need to differ, keep the
underlying tokens, interaction behavior, and accessibility standards consistent.

## Design principles

- **Start with the small screen.** Make the essential task clear and usable on a
  phone before adding columns, persistent sidebars, or denser layouts.
- **Prioritize clarity and calm.** Use clear hierarchy, readable copy, and
  purposeful whitespace rather than decoration or dense information.
- **Be predictable.** Reuse established navigation, component patterns, states,
  and terminology. A control should look and behave the same wherever it appears.
- **Keep people in control.** Make the result of an action clear, provide
  feedback, and make important or destructive actions deliberate.
- **Design for everyone.** Keyboard, screen reader, touch, zoom, and larger text
  must all remain usable.

## Visual foundation

Use the prototype's Tailwind theme and shared component classes as the source
of truth. Prefer named tokens over one-off values.

### Colour

| Role | Token | Value |
| --- | --- | --- |
| Primary brand and headings | `evergreen` | `#173F35` |
| Secondary brand tone | `evergreen-700` | `#215246` |
| Soft brand surface | `evergreen-50` | `#EBF2EE` |
| Page background | `paper` | `#F7F8F4` |
| Main text | `ink` | `#26312F` |
| Secondary text | `muted` | `#55625F` |
| Borders and dividers | `line` | `#D6DAD0` |
| Accent | `coral` | `#D9674E` |
| Strong accent / accent text | `coral-deep` | `#B0412A` |
| Quiet supporting surface | `pale` | `#DCECEF` |
| Success | `ok` | `#1D6A3B` |
| Warning | `warn` | `#7A4A00` |
| Error / destructive | `bad` | `#A12A2A` |

- Use brand colours to create hierarchy, not as decoration on every element.
- Use semantic success, warning, and error tokens only for those meanings. Pair
  status colour with a text label and, where useful, an icon or pattern; never
  make colour the only way to understand a state.
- Check the actual foreground/background pair in every theme and state. Meet
  WCAG AA contrast: at least 4.5:1 for normal text and 3:1 for large text and
  meaningful graphical controls.
- Do not introduce raw colour values in a component when an existing token fits.
  If a new semantic colour is needed, define and document it centrally.

### Type

- Use **Fraunces** for display headings and prominent figures, with the existing
  Georgia/Cambria serif fallback. Use **Source Sans 3** for interface and body
  text, with the system sans-serif fallbacks.
- Use a consistent hierarchy: page title, section heading, subsection heading,
  body, supporting text. Keep heading levels semantic (`h1` followed by `h2`,
  and so on), not selected only for appearance.
- Keep body text at least 16 CSS px on mobile; the prototype's 17 px body style
  is the preferred starting point. Supporting text must remain comfortably
  readable and high contrast.
- Use a line-height around 1.5 for paragraphs. Keep long text to a readable
  measure (about 60–75 characters per line on wider screens); let it wrap on
  narrow screens rather than shrinking it.
- Prefer wrapping over truncation. If space genuinely requires truncation, make
  the full value available on demand and to assistive technology.
- Use tabular figures for values that need to align or remain stable, such as
  dates, amounts, and times.

### Spacing, shape, and icons

- Follow a 4 px base / 8 px spacing rhythm. Use smaller steps for tight
  component internals and larger steps to distinguish sections; avoid arbitrary
  one-off gaps.
- Reuse the prototype's rounded-lg controls and rounded-xl/2xl surfaces. Keep
  shadows and borders restrained and consistent; elevation should communicate
  hierarchy, not be added for decoration.
- Use the existing SVG icon style (Lucide-like, consistent stroke). Keep icons
  aligned with their text and use the same visual size at the same hierarchy.
  Do not use emoji as interface icons.
- Give decorative icons `aria-hidden="true"`. Provide an accessible name for
  icon-only controls.

## Responsive layout

Use the narrow layout as the default, then progressively enhance it. The
prototype uses Tailwind's default `sm` (640 px) and `lg` (1024 px) breakpoints;
reuse those unless a tested content need justifies another shared breakpoint.
Breakpoints are for adapting content, not targeting specific devices.

### Small screens first

- Keep the viewport declaration as `width=device-width, initial-scale=1`; never
  disable user zoom.
- Use fluid widths, `min-width: 0` where flex/grid children can overflow, and
  wrapping content. Do not give page containers fixed pixel widths.
- Keep the core task and its primary action near the top. Stack content and
  related form fields in one column; move secondary detail below the primary
  content.
- Use full-width controls when that improves mobile clarity. Keep actions
  comfortably separated and do not compress text, labels, or tap areas to make
  a layout fit.
- Avoid horizontal page scrolling. For inherently wide data, choose a
  mobile-appropriate presentation or provide a clearly labelled alternative
  rather than shrinking it until it is unreadable.
- Prefer the page as the primary scroll region. Avoid nested scroll containers
  unless there is a strong interaction need.

### Larger screens

- Add columns only when they improve scanning and fit the content. Use a
  constrained content width and generous adaptive gutters rather than
  stretching paragraphs and forms edge to edge.
- Keep reading and task order logical when columns stack or reflow.
- Sidebars may become persistent on wide screens; keep them in normal reading
  order and do not let sticky content cover page content.
- Check portrait and landscape layouts. Controls, dialogs, and content must not
  depend on a particular orientation.

### Fixed and sticky UI

- Follow the prototype's navigation pattern: compact top bar on small screens,
  sidebar on wide screens, and a labelled bottom navigation for the top-level
  mobile destinations.
- Keep bottom navigation to five or fewer destinations, with both icon and text
  label. Move less-used destinations to an appropriate secondary location.
- Respect top and bottom safe areas. Add matching content padding so fixed
  navigation, sticky headers, and action bars never obscure focus, fields, or
  the last item in a scrollable page.
- Keep sticky elements useful but non-blocking. Verify that keyboard focus and
  browser anchor navigation do not land behind them.

## Components and interaction

Build new components from the established patterns in `index.html` (such as
`.btn`, `.input`, `.label`, `.help`, `.chip`, `.nav-link`, and `.tab-link`)
before creating another visual variant.

### Buttons and links

- Use a real `<button>` for an action and a real `<a>` for navigation. Do not
  make a generic container behave like a button.
- Keep one visually primary action per screen or decision area. Use the
  existing primary, outline, quiet, and danger treatments according to the
  action's importance; do not style competing actions as primary.
- Make controls at least 44 × 44 CSS px (the prototype's main buttons and
  inputs are 48 px tall). Leave at least 8 px between separate touch targets.
- Button labels should describe the outcome (for example, “Save changes”).
  Avoid ambiguous labels such as “OK” when the consequence is not obvious.
- Include visible hover, keyboard-focus, pressed, and disabled states. Hover is
  supplemental and must never be the only indication or way to operate a
  control. Disabled controls must use the native `disabled` state when
  appropriate and must not appear actionable.
- For asynchronous actions, prevent accidental repeat submission and show
  progress. Confirm success or failure and provide a recovery action where
  possible.
- Use the danger treatment for destructive actions and ask for confirmation
  when an action is irreversible or has significant consequences.

### Forms

- Give every field a persistent visible `<label>` associated with its input.
  Placeholders are examples, not labels. Use `fieldset` and `legend` for
  related groups.
- Use the correct input type and autocomplete value so mobile keyboards and
  autofill work as expected. Keep inputs at least 44 px high.
- Put concise help text and validation errors next to the relevant field.
  Explain both what went wrong and how to fix it; do not rely on colour alone.
- Validate after a user has had a chance to complete the field (typically on
  blur or submit), not on every keystroke. On failed submission, identify the
  errors and move focus to the first invalid field or an error summary.
- Preserve entered values after errors. For longer forms, prevent accidental
  loss of work and clearly explain any unsaved-changes behavior.

### Cards, lists, and status

- Use a card when a group of related content benefits from a clear boundary or
  action. Do not wrap every section in a card; simple headings, spacing, and
  dividers often create better hierarchy.
- Keep list rows readable and allow long labels to wrap. Separate row actions
  from the row's main content and give each action its own touch target.
- Make status labels explicit and consistent. Use the same label, icon, and
  semantic token for the same state throughout the product.
- Provide intentional loading, empty, success, and error states. Empty states
  should tell the user what is absent and, when relevant, what to do next.

### Navigation, dialogs, and feedback

- Keep navigation placement and naming consistent across pages. Clearly show
  the current destination (for example, with `aria-current="page"`).
- Preserve browser back behavior and meaningful URLs. Do not use a modal as a
  substitute for primary page navigation.
- Give dialogs and sheets a clear title, close/cancel route, sensible initial
  focus, contained keyboard navigation, and restored focus on dismissal. Do not
  dismiss silently when unsaved changes would be lost.
- Announce important asynchronous feedback without moving focus unexpectedly.
  Use an appropriate live region for status messages; errors that require
  immediate attention should be announced as such.

## Accessibility requirements

- Use semantic HTML landmarks and controls. Include a skip link on pages with
  repeated navigation; ensure the main region can receive focus after
  navigation.
- Keep keyboard order aligned with the visual and reading order. All actions
  must work without a pointer, with a clearly visible focus indicator.
- Give meaningful images appropriate alternative text. Hide decorative images
  and icons from assistive technology.
- Provide accessible names and states for controls (including selected,
  expanded, current, and disabled states). Do not add ARIA when native HTML
  already provides the needed semantics.
- Do not convey meaning using colour, position, or icon alone. Include a text
  label or equivalent.
- Support text zoom and user font scaling without clipping, overlap, or lost
  actions. Do not prevent pinch zoom.
- Respect `prefers-reduced-motion`. Use motion only to explain a state change;
  keep short transitions around 150–300 ms, avoid layout-shifting animation, and
  never make animation a prerequisite for understanding or input.
- Give images and media dimensions or an aspect ratio to prevent layout shifts;
  lazy-load non-critical below-the-fold media.

## Before sharing a new page or component

- [ ] Uses the existing colour, type, spacing, shape, and icon conventions.
- [ ] Works at 320 px, 375 px, tablet, and wide desktop widths without
      horizontal page scrolling or clipped content.
- [ ] Works in portrait and landscape, with browser zoom and larger text.
- [ ] Primary content and actions remain clear when the layout stacks.
- [ ] Fixed/sticky UI respects safe areas and never hides content or focus.
- [ ] All controls are keyboard-operable and have visible focus and state
      feedback.
- [ ] Touch targets are at least 44 × 44 px with comfortable separation.
- [ ] Text, icons, borders, and status indicators have sufficient contrast.
- [ ] Forms have labels, useful errors, and an understandable recovery path.
- [ ] Loading, empty, success, and error states are designed where relevant.
- [ ] Reduced-motion preference is respected and motion does not block input.
- [ ] Checked with a screen reader and at narrow and wide viewport sizes.
