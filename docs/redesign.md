# HereO redesign direction

Based on the Figma prototype (Welcome, Log in, Discover, Chats) and the Rork prototype in `expo/`.

## What to keep from Figma

- **The voice.** "Will you answer the call?" is the best line in either prototype. It speaks to the guardian, not the victim, and it is the activation idea in five words. Keep it as the welcome headline.
- **The visual system.** Black and white, big rounded geometric headings, square-cornered outlined inputs, and one loud accent: the magenta-to-orange gradient on the center tab button. It already feels confident rather than fearful, which is right for a guardian product.
- **Discover's two sections.** "Today's top Here-Os" (recognition) and "Certifications" (training) are exactly the guardian pathway. They become the core of the Discover tab.
- **Chats as gratitude.** Every sample chat is a thank-you. That is the retention loop: people come back because someone thanked them. Messages keep that, tied to real incidents.
- **Five tabs with a center gradient button.**

## What changes

| Area | Figma / Rork | Redesign |
|---|---|---|
| Center button | "+" (post something) | **Hold to get help.** The single most important action lives in the thumb zone on every screen. Hold 2 seconds, ring fills, haptic, alert sent. A tap opens the help sheet instead, so pocket-taps never fire an alert. |
| Welcome art | Dreamstime stock photo (watermarked, not licensed) | Original art. Until there is commissioned art: ink background, gradient cape mark, type-led layout. |
| Sign-in | Email + password | Email code (passwordless). One less thing to remember in a stressful moment; phone number verification comes later. |
| Home | Feed of help requests | **Your safety at a glance:** hold button, Walk with me, Check in later, Fake call, and a live line like "6 guardians nearby · 3 in your circle". The request feed moves to Respond (guardians only). |
| Active help | Static "Quick help" form | **Live incident screen:** AI brief at the top ("Maya is 2 min away. Your circle knows."), map, responder chips with live status, message box, and two fixed buttons: **Call 911** and **I'm safe**. |
| Guardian side | "I can help" on a feed card | **Incoming request card** with distance, AI-assigned role ("Go to the corner of 5th and Main and be visible"), and a standing conduct line: *Be present. Don't pursue. Call 911 for danger.* |
| Her-O | Segmented toggle in a few places | One mode switch on Home. In Her-O mode, requests route only to verified women guardians and the accent shifts to a deeper magenta. |
| Tone of copy | Superhero/vigilante ("Will you answer the call?", capes) | Keep the superhero warmth in onboarding and recognition; use plain, calm, short copy everywhere during an incident. |

## Design tokens

| Token | Value | Use |
|---|---|---|
| `ink` | `#0B0B0F` | Text, primary buttons, welcome background |
| `paper` | `#FFFFFF` | Surfaces |
| `mist` | `#F4F4F6` | Secondary surfaces, cards |
| `line` | `#E4E4E8` | Dividers, input borders (inputs use 2px `ink` when focused) |
| `muted` | `#6B6B76` | Secondary text |
| `heroStart` → `heroEnd` | `#E8338B` → `#F2602E` | The gradient. Center button, primary call to action, guardian badges |
| `herO` | `#B0247A` | Her-O mode accent |
| `alert` | `#E5252A` | Active incident and Call 911 only |
| `safe` | `#12A150` | Resolved, "I'm safe", guardian on scene |

Type: **Lexend** for headings (closest free match to the Figma headings), system font for body. Corner radius 12 on cards and buttons, 0 on inputs (Figma's square inputs). Minimum touch target 48pt; the emergency controls are 64pt+.

## Navigation

```
Welcome → Sign in (email code) → Onboarding (name, Her-O eligibility, circle, guardian opt-in)
Tabs: Home · Discover · [Hold for help] · Messages · Profile
Incident (requester or guardian view), Circle, Become a guardian
```
