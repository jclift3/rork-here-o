// Tests for the Muse Dispatcher guard, agent loop, SAM parser and blur.
// Built during the Meta Global AI Developer Hackathon (Nov 2026).

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { Image } from "imagescript";
import type { GuardianCandidate } from "../types.ts";
import { type Chat, runAgent } from "./agent.ts";
import { formatTranscript, parseSamBoxes, type ToolCall } from "./client.ts";
import { emergencyNumber, ResponseGuard } from "./guard.ts";
import { pixelate } from "./shield.ts";

const heroes: GuardianCandidate[] = [
  { user_id: "h1", display_name: "Nia Patel", distance_m: 180, push_token: null, trainings: ["first_aid"] },
  { user_id: "h2", display_name: "Sam Okafor", distance_m: 420, push_token: null, trainings: [] },
  { user_id: "h3", display_name: "Ava Chen", distance_m: 700, push_token: null, trainings: [] },
  { user_id: "h4", display_name: "Leo Grant", distance_m: 900, push_token: null, trainings: [] },
];
const CAMBRIDGE = { lat: 52.2053, lng: 0.1218 };
const SARASOTA = { lat: 27.3364, lng: -82.5307 };

function guard(words = "", extra: Partial<ConstructorParameters<typeof ResponseGuard>[0]> = {}) {
  return new ResponseGuard({
    words,
    silent: false,
    candidates: heroes,
    alreadySent: 0,
    alreadySentIds: [],
    ...CAMBRIDGE,
    ...extra,
  });
}

Deno.test("emergency number follows location", () => {
  assertEquals(emergencyNumber(CAMBRIDGE.lat, CAMBRIDGE.lng), "999");
  assertEquals(emergencyNumber(SARASOTA.lat, SARASOTA.lng), "911");
  assertEquals(emergencyNumber(null, null), "911");
});

Deno.test("guard replaces a confrontational job", () => {
  const g = guard();
  const out = g.apply("assign_hero", { user_id: "h1", job: "Chase the man and grab his bag" });
  assert(out.startsWith("changed"));
  assertEquals(g.decisions[0].verdict, "changed");
  assert(!/chase/i.test(g.state.assignments[0].job));
});

Deno.test("guard allows 'don't pursue' advice", () => {
  const g = guard();
  g.apply("assign_hero", { user_id: "h1", job: "Walk her to the Co-op and wait inside. Don't follow anyone." });
  assertEquals(g.decisions[0].verdict, "allowed");
});

Deno.test("guard blocks unknown heroes, duplicates and the cap", () => {
  const g = guard();
  assertEquals(g.apply("assign_hero", { user_id: "stranger", job: "Go" }).split(":")[0], "blocked");
  g.apply("assign_hero", { user_id: "h1", job: "Go to her and stay visible." });
  assertEquals(g.apply("assign_hero", { user_id: "h1", job: "Go" }).split(":")[0], "blocked");
  g.apply("assign_hero", { user_id: "h2", job: "Call her and stay on the line." });
  g.apply("assign_hero", { user_id: "h3", job: "Meet the porter at the gate." });
  assertEquals(g.apply("assign_hero", { user_id: "h4", job: "Head over." }).split(":")[0], "blocked");
  assertEquals(g.state.assignments.length, 3);
});

Deno.test("urgency never drops below what the words say", () => {
  const g = guard("he has a knife");
  assertEquals(g.state.urgency, "critical");
  assert(g.state.emergencyRecommended);
  const out = g.apply("set_assessment", { urgency: "low", category: "misunderstanding" });
  assert(out.startsWith("changed"));
  assertEquals(g.state.urgency, "critical");
});

Deno.test("being followed sets a high floor", () => {
  const g = guard("a guy has been following me since the bridge");
  assertEquals(g.state.urgency, "high");
});

Deno.test("brief gets the local emergency number when a call is recommended", () => {
  const g = guard();
  g.apply("recommend_emergency_call", { reason: "being followed, can't reach a safe place" });
  g.apply("write_brief", { text: "Nia is 3 minutes away. Head to the lit shop on the corner." });
  assert(g.state.brief!.includes("999"));
  assertEquals(g.decisions.at(-1)!.verdict, "changed");
});

Deno.test("notes to responders can't ask for confrontation", () => {
  const g = guard();
  assert(g.apply("post_note", { audience: "responders", text: "Corner him by the bins" }).startsWith("blocked"));
  assert(
    g.apply("post_note", { audience: "responders", text: "She is by the bus shelter on Mill Road." }) ===
      "ok: posted",
  );
});

Deno.test("presence floor sends the nearest hero when the agent sends none", () => {
  const g = guard();
  g.finalize({ phase: "dispatch", requesterFirstName: "Rae", fallbackBrief: "Help is coming." });
  assertEquals(g.state.assignments[0].user_id, "h1");
  assertEquals(g.state.brief, "Help is coming.");
});

function call(name: string, args: Record<string, unknown>, i = 0): ToolCall {
  return { id: `c${i}${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

Deno.test("agent loop applies tool calls through the guard", async () => {
  let rounds = 0;
  const chat: Chat = ({ messages }) => {
    rounds++;
    if (rounds === 1) {
      return Promise.resolve({
        finish_reason: "tool_calls",
        message: {
          content: null,
          tool_calls: [
            call("set_assessment", { urgency: "high", category: "being followed" }, 1),
            call("assign_hero", { user_id: "h1", job: "Follow the man and take his photo" }, 2),
            call("assign_hero", { user_id: "h2", job: "Call Rae and stay on the line." }, 3),
            call("recommend_emergency_call", { reason: "followed at night" }, 4),
          ],
        },
      });
    }
    // Second round: the model sees the guard's results.
    const toolMsgs = messages.filter((m) => m.role === "tool");
    assertEquals(toolMsgs.length, 4);
    return Promise.resolve({
      finish_reason: "tool_calls",
      message: {
        content: null,
        tool_calls: [
          call("write_brief", { text: "Nia is 2 minutes away and Sam is calling you." }, 5),
          call("finish", {}, 6),
        ],
      },
    });
  };
  const out = await runAgent({
    phase: "dispatch",
    incident: { mode: "here_o", trigger: "hold", note: "someone is following me", alarm: "loud", ...CAMBRIDGE },
    requesterName: "Rae Smith",
    candidates: heroes,
    responding: [],
    transcripts: [],
    scenes: [],
    messages: [],
    fallbackBrief: "Your circle has been alerted.",
    budgetMs: 5000,
  }, chat);
  assert(out.modelAnswered);
  assertEquals(out.state.assignments.length, 2);
  assert(!/follow the man/i.test(out.state.assignments[0].job));
  assert(out.state.emergencyRecommended);
  assert(out.state.brief!.includes("999"));
  assertEquals(out.decisions.filter((d) => d.verdict === "changed").length, 2);
});

Deno.test("agent falls back to rules when the model is down", async () => {
  const out = await runAgent({
    phase: "dispatch",
    incident: { mode: "here_o", trigger: "hold", note: null, alarm: "silent", ...SARASOTA },
    requesterName: "Rae",
    candidates: heroes,
    responding: [],
    transcripts: [],
    scenes: [],
    messages: [],
    fallbackBrief: "Your circle has been alerted. If you are in danger, call 911 now.",
    budgetMs: 3000,
  }, () => Promise.resolve(null));
  assertEquals(out.model, "rules-only");
  assertEquals(out.state.urgency, "high");
  assertEquals(out.state.assignments.length, 1);
});

Deno.test("parses SAM boxes", () => {
  const text =
    "<0f>0<|box;x1=181;y1=365;x2=556;y2=486;w=1516;h=1600;c=0.91|><|mask;x=0;y=0;data=122,376,!abc|>,<0f>1<|box;x1=10;y1=20;x2=30;y2=40;w=1516;h=1600|>";
  const boxes = parseSamBoxes(text);
  assertEquals(boxes.length, 2);
  assertEquals(boxes[0].confidence, 0.91);
  assertEquals(boxes[1].x2, 30);
});

Deno.test("pixelate changes the boxed region only", () => {
  const img = new Image(200, 200);
  for (let y = 1; y <= 200; y++) for (let x = 1; x <= 200; x++) img.setPixelAt(x, y, Image.rgbaToColor(x, y, 0, 255));
  const outside = img.getPixelAt(190, 190);
  const inside = img.getPixelAt(51, 51);
  const n = pixelate(img, [{ x1: 40, y1: 40, x2: 80, y2: 80, w: 200, h: 200, confidence: null }]);
  assertEquals(n, 1);
  assertEquals(img.getPixelAt(190, 190), outside);
  assertNotEquals(img.getPixelAt(51, 51), inside);
});

Deno.test("transcript labels voices only when there are two", () => {
  assertEquals(formatTranscript({ text: "help me", turns: [{ speaker: "0", text: "help me" }] }), "help me");
  assertEquals(
    formatTranscript({
      text: "",
      turns: [{ speaker: "a", text: "leave me alone" }, { speaker: "b", text: "come here" }],
    }),
    "Voice 1: leave me alone / Voice 2: come here",
  );
});
