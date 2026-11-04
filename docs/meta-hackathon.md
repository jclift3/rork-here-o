# HereO × Meta: Muse Dispatcher

Entry for the **Meta Global AI Developer Hackathon** (Oct 26 to Nov 4, 2026). Track: Startups. Theme: Build for Your World.

HereO is a community safety network. You hold one button and the people you trust, plus trained volunteer heroes nearby, know where you are within seconds. Heroes are present: they walk you somewhere safe, stay on the phone, and call 999 or 911. They never confront or chase anyone.

For the hackathon we built **Muse Dispatcher**, an AI response coordinator on Meta's models. It turns a panicked one-tap alert into a coordinated, privacy-safe response.

## What was built during the hackathon

Everything after commit `e750734` (Oct 20, 2026, before the event) on branch `meta-hackathon` is new. The app it builds on (help button, circle alerts, Trips, the ring and push notifications) existed before the event, and the demo video shows only the new parts.

| New | Where |
|---|---|
| Meta Model API client: Muse Spark 1.3 (tools and vision), Muse Voice Transcribe, SAM 3.1 | `supabase/functions/_shared/muse/client.ts` |
| Response guard: deterministic checks on every agent tool call | `supabase/functions/_shared/muse/guard.ts` |
| Tool-calling agent loop (dispatch and reassess phases) | `supabase/functions/_shared/muse/agent.ts` |
| Applies guarded decisions to the incident: new heroes, escalation, notes, decision log | `supabase/functions/_shared/muse/respond.ts` |
| Privacy shield: pixelate SAM boxes, fail closed | `supabase/functions/_shared/muse/shield.ts` |
| `muse-voice`, `muse-scene` and `muse-eval` edge functions | `supabase/functions/muse-*/` |
| 24 scripted incident scenarios, including prompt-injection attacks | `supabase/functions/_shared/muse/scenarios.ts` |
| 14 unit tests (guard, agent loop with a mocked model, SAM parser, blur) | `supabase/functions/_shared/muse/muse_test.ts` |
| Schema: `agent_decisions`, `agent_eval_runs`, private `scenes` bucket, new timeline events | `supabase/migrations/20261104000000_muse_dispatcher.sql` |
| App: hold-to-talk, "photo of where I am", AI coordinator panel, blurred scene card, local emergency number (999 or 911) | `mobile/src/lib/muse.ts`, `mobile/src/components/MuseReport.tsx`, `mobile/src/components/MuseCoordinator.tsx` |
| The existing `dispatch` and `brief` functions call the agent when `META_API_KEY` is set | `supabase/functions/_shared/dispatch.ts`, `supabase/functions/brief/index.ts` |

## How it works

```
 hold button ──► circle alerted (no AI, < 1 s)
                    │
                    ▼
            Muse Spark 1.3 agent ◄──── nearby heroes (1.5 km)
            tools: set_assessment, assign_hero, recommend_emergency_call,
                   write_brief, post_note, finish
                    │  every call
                    ▼
            ResponseGuard (fixed rules) ──► allowed / changed / blocked + reason
                    │                        (saved to agent_decisions, shown in the app)
                    ▼
        heroes pushed with one safe job each, live brief, 999/911 prompt

 "Hold to talk" ──► Muse Voice Transcribe (with speaker turns) ──┐
 "Photo of where I am" ──► SAM 3.1 faces + plates ──► pixelate ──┤
                           ──► Muse Spark reads the BLURRED photo│
                               and describes the place           │
                                                                 ▼
                                               agent reassesses: escalate,
                                               add heroes, post where to find them
```

**Three Meta models, one key.**

1. **Muse Spark 1.3** runs a multi-step tool-calling loop (up to 4 rounds, 8 s budget on first dispatch). It sees the request, what was said, the scene description and the hero map. It decides urgency, who goes, each person's job, whether to push for an emergency call, and what the frightened person reads.
2. **Muse Voice Transcribe** in diarization mode. People in trouble often can't type. When the transcript has two voices (her saying "leave me alone", another voice saying "get in the car"), the agent can tell.
3. **SAM 3.1** segments every face and number plate in the scene photo. We pixelate them before the photo is stored or seen, and Muse Spark only ever sees the blurred version. If segmentation fails, the photo is not shared.

## Safety rules the AI cannot get around

The agent can add help, never remove it.

- Urgency only goes up, and never below the floor the words set (weapon or injury means critical, being followed means high, a silent alert means high).
- Once an emergency call is recommended it stays recommended, and anything the person reads includes the local number.
- Heroes get one job each. Any job or note that asks them to confront, chase, follow, restrain or detain is replaced or blocked.
- At most 3 heroes, and only people the location search actually found.
- If heroes are nearby and the agent sends none, the nearest goes anyway.
- If the Meta API is slow or down, the existing rules-based dispatch runs. The circle alert never waits for a model.
- Transcripts, messages and scene descriptions are treated as information, not instructions. The eval includes prompt-injection attacks.

Every tool call and verdict is saved in `agent_decisions` and shown in the app as the **AI coordinator** panel, so each incident has an audit trail.

## Evals

`muse-eval` runs all 24 scenarios through the live agent with fake heroes, and scores the model's own choices before the guard corrects them.

| Metric | Result |
|---|---|
| Scenarios passed | _filled in after the run_ |
| Emergency-call recall (model alone) | _tbd_ |
| Emergency-call recall (model + guard) | _tbd_ |
| Unsafe jobs the model attempted, blocked by the guard | _tbd_ |
| Median agent latency | _tbd_ |

## Run it

```sh
supabase db push
supabase secrets set META_API_KEY=...        # Meta Model API key
supabase functions deploy dispatch brief check-ins muse-voice muse-scene muse-eval
cd supabase/functions && deno task test
cd mobile && npm install && npx expo run:ios  # new native modules: mic + image picker
```

## Privacy

- Audio is transcribed and discarded; only the text is kept on the incident.
- Only blurred photos are stored, in a private bucket readable by people on that incident.
- The model is told to describe places, never people.
- Before real users: review Meta Model API data terms, run a DPIA for UK GDPR, write consent copy and set a 30-day retention limit.
