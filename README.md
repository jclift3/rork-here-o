# HereO

A community guardian network for iOS and Android. Hold one button and the people you trust, plus trained guardians nearby, know where you are within seconds. An AI coordinator triages the moment, gives each guardian one clear job, and keeps a live brief everyone shares. Call 911 is always one tap away.

Guardians are neighbors who show up: be present, de-escalate, stay with the person, call 911. They never pursue or confront anyone, and the system enforces that in code (`supabase/functions/_shared/safety.ts`).

## What's here

| Path | What it is |
|---|---|
| `mobile/` | The app. Expo SDK 57, React Native, Expo Router, TypeScript. |
| `supabase/migrations/` | Postgres schema, row-level security and helper functions. |
| `supabase/functions/` | Edge functions: `dispatch` (alert circle, AI triage, send guardians), `brief` (refresh the shared live brief) and `check-ins` (tells the circle when a trip starts or arrives, and turns missed check-ins into help requests, every minute). |
| `supabase/tests/` | Permission tests that run the migration on a plain Postgres. |
| `docs/redesign.md` | Design direction from the Figma prototype, with tokens. |
| `expo/` | The original Rork prototype (mock data only), kept for reference. |

## The help loop

1. **Hold** the gradient button for two seconds (any tab), or tap it to add a note first.
2. The app creates the incident with the person's location and opens the live screen.
3. `dispatch` alerts the **circle** immediately, with no AI in that path.
4. It finds available **guardians** within 1.5 km (verified women only in Her-O mode).
5. Claude **triages**: urgency, whether to recommend 911, a calm summary for the person, and one job per guardian. Hard limit of 8 seconds; on timeout, refusal or error a deterministic fallback runs. Deterministic rules can only raise urgency, force a 911 recommendation for danger words, and replace any job that reads as confrontation.
6. Guardians get a push with their job and tap **On my way** or **Can't now**, then **I'm with them**.
7. Every message or status change refreshes the **live brief** (Claude again, with a fallback).
8. The person taps **I'm safe**, everyone is released, and they can **thank** the people who showed up. Thanks feed the Discover tab's top Here-Os.

Also in the app:

- **Trips.** Start a walk, run or ride with a destination and a check-in time. Your circle is told as it starts and follows your location live. Heading home (saved in Profile), the trip ends by itself within 75 m of home and the circle hears "home safe". Miss the check-in by two minutes and your circle is alerted. Nearby guardians are only alerted if you turned on **Also alert nearby guardians if I don't respond** in Profile, and only after another 5 minutes with no answer; they're told it's an unanswered check-in, not a confirmed emergency.
- **Lock screen and home screen (iOS).** A running trip shows as a Live Activity on the lock screen and in the Dynamic Island, with a live countdown. The **Start a trip** widget starts a trip in one tap (`hereo://walk?go=1&kind=walk|run|ride`).
- **Fake call.** A realistic incoming call to give you a reason to leave. Nobody is alerted.
- **Guardian background location.** Available guardians who allow "Always" location stay findable with the app closed.
- **Her-O verification requests.** Users request verification in the app; the HereO team approves with `update her_o_verifications set status = 'approved' where user_id = '<id>'`, which sets the profile's Her-O badge.

## Run it

### Backend (Supabase)

```sh
npm i -g supabase            # or brew install supabase/tap/supabase
supabase link --project-ref <your-project-ref>
supabase db push             # applies supabase/migrations
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy dispatch brief check-ins sign-up
```

Point the check-in scheduler at the project once, in the SQL editor (the migration already created the cron job and its secret):

```sql
select vault.create_secret('https://<your-project-ref>.supabase.co', 'hereo_project_url');
```

The app signs in with email and password. New accounts confirm their email with a 6-digit code (`supabase.auth.verifyOtp`, type `signup`). On the hosted project this needs:

- Custom SMTP through Resend (sender domain hereo.app, set up with Resend's Supabase integration).
- Auth › Email: "Confirm email" on.
- The "Confirm signup" template set to `supabase/templates/confirm-signup.html`, subject "Your HereO code". It must show `{{ .Token }}`, not a link.
- The "Reset password" template set to `supabase/templates/reset-password.html`, subject "Your HereO password reset code". It must also show `{{ .Token }}`: the app's "Forgot password?" asks for the code.

The old `sign-up` function, which created accounts already confirmed, now answers 410.

### App

```sh
cd mobile
cp .env.example .env         # fill in your Supabase URL and anon key
npm install
npx expo start
```

Maps, push notifications, background trip sharing, the Live Activity and the widget need a development build (`npx expo run:ios` / `run:android`, or `eas build --profile development`). Push also needs an EAS project id (`eas init`).

### Tests

```sh
supabase/tests/run.sh                         # needs local Postgres (createdb/psql)
cd supabase/functions && deno task test       # triage, safety, brief, push
cd mobile && npx tsc --noEmit && npx expo lint
```

CI runs all three on every pull request.

## Not built yet

- Silent 911 with location through a partner such as RapidSOS or Noonlight. Today Call 911 opens the dialer.
- An identity-verification vendor for Her-O (today the HereO team reviews requests by hand) and guardian background checks.
- Trip location in the background needs "Always" location permission; without it, location is shared while the app is open. The check-in deadline is enforced by the server either way.
- Licensed or commissioned welcome art and a real app icon.
