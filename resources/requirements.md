# Nesse Requirements

## 1. Purpose

Nesse is a mobile-first web application for coordinating house- and pet-sitting arrangements between people who already know one another or have been invited to use the service. It provides one reliable record for availability, requests, agreed handover times, expenses, updates, and cancellations.

The initial release is invite-only. It is a scheduling and record-keeping product, not a public sitter marketplace, payment processor, emergency-response service, or source of legal advice.

## 2. Product Goals

- Make availability and booking status visible to the people involved.
- Ensure both parties know the agreed arrival and departure dates and times.
- Keep booking-related decisions and notifications in one authoritative record rather than scattered messages.
- Support clear expectations for pets, optional services, rates, travel reimbursement, and incidental expenses.
- Make common booking tasks straightforward on a phone, including selecting a date range and entering handover times.
- Preserve a clear history of requests, decisions, updates, uploaded evidence, and cancellations.

## 3. Users

**Booker:** Invites or selects a sitter, provides the care requirements, requests dates and times, reviews the sitter's response, and records agreed expenses and emergency details.

**Sitter:** Maintains a profile, rates, services, pet preferences, and unavailable dates; reviews requests; accepts or declines; confirms handover times; and may post updates or attachments during a sit.

**Inviter/administrator:** Manages access to the invite-only service and can assist with account or access issues. This role does not decide disputes between bookers and sitters.

## 4. Scope

### First Release

- Invite-only accounts and private sitter profiles.
- Availability management and an in-app calendar.
- Booking requests, accept/decline, confirmed times, and explicit cancellation.
- In-app status and email notifications.
- Recording agreed rates, travel reimbursement, and incidental expenses; no in-app payment collection.
- Optional progress updates and file attachments.
- Mobile-first responsive web experience.

### Later Phases, Not First-Release Commitments

- Public sitter discovery, searchable profiles, reviews, or ratings.
- Identity or background-check integrations.
- External Google, Apple, or Outlook calendar synchronization.
- SMS or push notifications.
- In-app payments, sitter payouts, refunds, platform fees, or payment disputes.
- Automated determination or collection of cancellation compensation.

## 5. Core Booking Lifecycle

1. A booker selects an invited sitter and submits dates, preferred arrival and departure times, care needs, and any proposed expense terms.
2. The sitter receives an in-app and email notification and may accept or decline. A request with no response remains pending; silence, a missed call, or an unanswered message never changes it to cancelled.
3. On acceptance, the sitter confirms or proposes exact arrival and departure times. The booking record must show the exact agreed handover times and make any pending time agreement clear to both parties.
4. The parties use the booking record for changes, updates, agreed expenses, and relevant attachments.
5. A party who needs to cancel explicitly cancels through Nesse. The other party is notified and the event is recorded in the booking history.
6. After the sit, the booking can be marked completed and its agreed expense record retained for reference.

## 6. Functional Requirements

### Accounts and Profiles

- **FR-01 — Invite-only access:** Users must join through an invitation or an administrator-issued access flow. Private profile and booking information must not be publicly discoverable in the first release.
- **FR-02 — Sitter profile:** A sitter must be able to maintain contact details, a description, their rate and rate basis, pets they accept, and optional services with any associated prices.
- **FR-03 — Profile visibility:** Bookers may view a sitter profile only when they have appropriate access. Home addresses and sensitive property instructions must not appear on a public or pre-booking profile.

### Availability and Booking

- **FR-04 — Availability blocks:** A sitter must be able to mark dates or date/time periods unavailable, review those blocks in a calendar, and remove or amend them. The interface must clearly distinguish unavailable periods from open availability and confirmed bookings.
- **FR-05 — Mobile date selection:** A booker must be able to select a start and end date using a touch-friendly date-range interface. On narrow screens, date selection must remain usable without requiring a desktop-style multi-month layout or horizontal scrolling.
- **FR-06 — Requested times:** A booker must be able to enter preferred arrival and departure times along with the requested dates. The request must make clear that these are requested times until confirmed.
- **FR-07 — Request details:** A booking request must support relevant care details, pets, requested optional services, property instructions appropriate to the request stage, and proposed rate or expense terms.
- **FR-08 — Conflict prevention:** Nesse must check a request against the sitter's recorded unavailable periods and other active bookings. It must warn against overlapping requests and prevent two bookings from being confirmed for the same sitter and time period.
- **FR-09 — Accept or decline:** A sitter must be able to accept or decline a request. The booker must see the current status and receive an in-app and email notification when it changes.
- **FR-10 — Exact handover times:** After accepting, the sitter must be able to confirm or propose exact arrival and departure times. Both parties must be able to see the current agreed times and identify any time that still needs agreement.
- **FR-11 — Explicit status:** Each booking must have a visible status, at minimum: requested, declined, accepted/time details pending, confirmed, cancelled, or completed. No absence of response or activity may be interpreted as acceptance or cancellation.
- **FR-12 — Confirmed booking changes:** Changes to confirmed dates, times, sitter, or material care requirements must be recorded and communicated to both parties. A change must not silently overwrite the previous agreement.

### Communication, Updates, and Safety Details

- **FR-13 — Single source of truth:** Booking status, agreed times, cancellation state, and expense terms in Nesse are the canonical record. Notifications must link back to the relevant booking. External messages do not modify booking status.
- **FR-14 — Notifications:** The application must provide in-app and email notifications for new requests, acceptances, declines, confirmed or changed handover times, cancellations, and new progress updates or attachments.
- **FR-15 — Emergency contacts:** A booking must record the booker's emergency contact and the sitter's contact details, visible to the parties who need them for that booking. The booker must be able to record property-specific emergency instructions and relevant veterinary contacts where pets are involved.
- **FR-16 — Optional progress updates:** A sitter may post dated progress updates during a confirmed sit. Updates are optional and must not be presented as proof of attendance.
- **FR-17 — Attachments:** A sitter or booker may attach relevant artefacts to a booking, including a travel ticket receipt. Uploads must show who added the file and when; supported file types and size limits must be stated in the interface.

### Rates, Travel, and Other Expenses

- **FR-18 — Agreed costs:** The booking record must distinguish the sitter's rate, optional service charges, travel reimbursement, and incidental expenses. The parties must be able to see the agreed amount or terms before the booking is confirmed.
- **FR-19 — Travel evidence:** A ticket receipt may support the final agreed travel reimbursement amount. A receipt is not required to confirm attendance, must not be represented as proof of attendance, and must not imply that the sitter has to purchase a ticket by a particular date.
- **FR-20 — Travel class:** First-class travel is not reimbursable under the default product policy. Any reimbursable travel amount and applicable standard/economy-class expectations must be visible in the booking agreement.
- **FR-21 — Incidental expenses:** Snacks, drinks, and other incidental costs must be separately itemized and agreed in advance; they must not be silently added to the sitter's rate or travel reimbursement.
- **FR-22 — No payment processing:** First release records agreed charges and reimbursement terms only. Payment, payout, refund, and collection happen outside Nesse.

### Cancellation and Audit History

- **FR-23 — Explicit cancellation:** Either party must be able to explicitly cancel a booking. Nesse must record who cancelled, when, and any reason they choose to provide, and notify the other party by in-app and email notification.
- **FR-24 — No inferred cancellation:** A booking remains in its current state until an authorized party explicitly changes it. Unanswered texts, calls, emails, or in-app messages do not cancel a booking.
- **FR-25 — 72-hour agreement:** The parties may record and acknowledge a proposed term that a sitter cancellation within 72 hours of the agreed start may make the sitter responsible for agreed alternative-care costs. Nesse must show the term and its acknowledgement clearly, and identify the applicable start time.
- **FR-26 — No liability enforcement:** In the first release, Nesse records and notifies about the cancellation and the parties' stated terms only. It does not decide whether a party is legally liable, calculate damages, charge a user, or guarantee recovery of alternative-care costs.
- **FR-27 — Booking history:** The parties must be able to review a chronological history of requests, decisions, agreed-time changes, cancellations, updates, and uploaded files for the booking.

## 7. Non-Functional Requirements

- **NFR-01 — Mobile-first:** Core journeys must work at a 320 CSS-pixel-wide viewport and scale up for tablet and desktop. There must be no horizontal page scrolling for normal booking workflows.
- **NFR-02 — Touch and input:** Primary touch targets must be at least 44 by 44 CSS pixels where practical, with sufficient separation to avoid accidental activation. Date and time entry must work with touch, keyboard, and assistive technology.
- **NFR-03 — Accessibility:** Target WCAG 2.2 AA. Use visible labels, keyboard-operable controls, meaningful focus indicators, clear field-level errors, and status text/icons in addition to color. Respect reduced-motion preferences.
- **NFR-04 — Date and timezone correctness:** Store and display booking times with the property's applicable timezone. Handle daylight-saving transitions and bookings that cross midnight without changing the intended local handover time.
- **NFR-05 — Privacy:** Restrict home addresses, access instructions, emergency contacts, and attachments to authorized booking participants. Reveal sensitive property details only when appropriate to the booking stage.
- **NFR-06 — Security:** Enforce role-based access on the server, protect authentication and uploaded files, and use encrypted transport. Users must not be able to access another invitation, profile, booking, or attachment by guessing an identifier.
- **NFR-07 — Clear feedback:** Show loading, success, error, and empty states for requests, availability, notifications, and uploads. Errors must explain the next useful action without losing entered data where possible.
- **NFR-08 — Responsive readability:** Body text should remain comfortably readable on mobile, controls must not depend on hover, and content must reflow rather than truncate important booking or cost details.

## 8. Design Language

**Direction:** Calm, trustworthy, and practical, with a restrained editorial character. The interface should feel suitable for coordinating care of someone's home and pets: clear information hierarchy, warm but not overly decorative, and focused on dates, responsibilities, and confirmation.

**Typography:** Use Fraunces for selected page and section headings, paired with Source Sans 3 for interface text, forms, and longer content. Keep body text highly legible and use tabular figures for times and monetary amounts where available. Provide sensible system fallbacks.

**Palette:**

| Token | Suggested color | Use |
| --- | --- | --- |
| Evergreen | `#173F35` | Primary actions, navigation, and strong brand accents |
| Soft neutral | `#F7F8F4` | Main page and application surfaces |
| Ink | `#26312F` | Primary text and high-contrast content |
| Coral | `#D9674E` | Limited emphasis and secondary actions; verify contrast for each pairing |
| Pale blue | `#DCECEF` | Informational panels and secondary surfaces |
| Success / warning / error | Accessible semantic green / amber / red tokens | Statuses, always paired with text or an icon |

These values are a starting palette, not a substitute for contrast testing. Text/background combinations must meet WCAG AA contrast requirements. Do not rely on color alone to distinguish open dates, unavailable dates, booking status, or errors.

**Interaction principles:** Use one clear primary action per view, visible labels and feedback, stable layouts, and date/time controls designed for touch first. Keep animation purposeful and respect reduced motion. The mobile date-range experience should be optimized for selecting a start and end date without precision gestures.

## 9. Acceptance Criteria for First Release

- A booker can submit a date-range request with preferred handover times and care details from a mobile viewport.
- A sitter can block dates, see conflicts, and accept or decline a request; the booker receives the resulting status notification.
- An accepted request shows exact arrival and departure times as pending or agreed, never ambiguously as both.
- A missed or unanswered message leaves the booking status unchanged.
- A cancellation is explicit, attributed, timestamped, visible in history, and notified to the other party.
- Both parties can find the sitter's contact details, emergency contacts, and applicable property or pet instructions in the confirmed booking.
- Agreed rate, travel reimbursement, and incidental costs are separately visible. An uploaded ticket receipt is labeled as expense evidence, not attendance proof.
- Users on mobile can complete the core flow with keyboard and assistive technology support; status is not communicated by color alone.

## 10. Open Decisions Before Later Phases

- What identity, background-check, or reference checks should be required before public sitter discovery?
- Which payment provider, platform fees, payout schedule, refund rules, and dispute process should apply if payments are introduced?
- Should travel reimbursement use an explicit per-booking cap, mileage/route rules, or another agreed calculation?
- What retention and deletion periods apply to booking history, emergency contacts, and uploaded documents?
- What support or escalation process is available for emergencies or disputes? Nesse must not be represented as an emergency-response service.
- What legal review and user acknowledgement are required for the proposed 72-hour cancellation and alternative-care-cost term?

The requirements describe intended product behavior and are not legal advice. Cancellation, reimbursement, privacy, and consumer terms should receive appropriate legal review before launch.