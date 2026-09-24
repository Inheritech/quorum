# Accessibility verification

Target: [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/). This is an implementation and verification record, not a conformance certification.

## Implemented

- Purple color tokens with dark body and secondary text, visible control borders, and a distinct focus outline. Statuses include words and icons rather than relying on color. Selected radio cards have a check or filled radio indicator; the room switch has separate Open and Locked labels and icons.
- Semantic headings, landmarks, a skip link, native radio groups and checkboxes, labeled fields, and described validation errors. Step changes focus the new heading; validation focuses the first invalid field. Back navigation preserves entered values.
- A keyboard-operated tablist, switch, and queue disclosure. Hidden queue controls leave the tab order. Room-lifetime and security details use native disclosures.
- Native modal dialogs with initial focus, Tab/Shift+Tab containment, Escape dismissal, and focus return to the opener. Background content is inert while a modal is open.
- Controls target at least 44 CSS pixels in height; icon buttons are 44 by 44. Radio cards use the full card as the input target.
- Responsive reflow at 320 CSS pixels, rem-based text, visible labels, and wrapping for room/item names. Primary and secondary button state changes do not animate through low-contrast colors.
- A slow, subtle waiting-request gradient with a pause/resume button. A new pending participant triggers a single fading ring. Reduced-motion preferences disable the ring and ongoing gradient motion; there is no flashing. New requests also trigger a quiet two-note chime lasting under one second, once browser audio is unlocked by interaction. A labeled Arrival sound toggle mutes it. Visual/text announcements remain available independently of audio.
- Polite voting, pending-request, and host-transfer status announcements. The three-second reveal countdown announces progress without requiring a timed response; voting and progression are disabled during it. Errors use alert semantics. Copy confirmation has a status region.
- A People dialog lists roles, supports removal confirmation, and moves focus to the non-destructive choice. Removed participants disappear from voting/observer lists. Room names appear in browser tab titles and reset on exit.

## Automated and browser checks

`tests/browser/accessibility.spec.ts` uses axe-core's WCAG 2 A/AA, WCAG 2.1 A/AA, and WCAG 2.2 AA rules. It scans the three creation steps (including custom cards and expanded lifetime settings), joining, the security dialog, the room with pending participants, expanded queue and locked state, add-item dialog, revealed results, and end-room dialog.

Playwright also checks field validation, retained wizard choices, heading focus, tablist arrow keys, skip navigation, Space/Enter operation, modal focus containment/return, waiting-animation pause, 320px reflow, and 200% text size combined with WCAG text-spacing values. Existing browser scenarios cover voting, admission, observation, queue advancement, and invitations. The suite runs in Edge at desktop and mobile viewport sizes; mobile emulation is not a physical device test.

Run against a local server using `PLAYWRIGHT_BASE_URL`, with temporary browser profiles inside `.tmp`. Screenshots are generated there for visual review and are not committed.

## Remaining conformance work

- Test actual NVDA/JAWS and VoiceOver announcements, real touch devices, Safari/Firefox, operating-system high-contrast modes, and browser zoom. Automated rules cannot establish complete conformance.
- Review live multi-person flows after Convex is configured, including asynchronous arrivals, network interruptions, declined requests, and room expiration. These are covered by backend integration tests but have not been verified end to end against a deployed backend.
- Assess the fixed shared-session expiry against WCAG 2.2.1 (Timing Adjustable). The host can choose 1/2/4/8 hours before creation, but participants cannot extend the deadline. This is not sufficient by itself to claim that success criterion; a documented applicable exception or an accessible extension policy is needed before a full AA claim.
- Validate keyboard focus when live participants or queue controls disappear due to another person's action. No independent accessibility audit has been performed.

Avoid labeling the application “WCAG certified” or unconditionally “WCAG 2.2 AA compliant” based on these checks alone.
