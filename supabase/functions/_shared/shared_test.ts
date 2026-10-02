import { assert, assertEquals, assertFalse, assertMatch } from "@std/assert";
import { composeBrief } from "./brief.ts";
import { minutesAway } from "./geo.ts";
import { buildPushMessages, sendPush } from "./push.ts";
import { describesImmediateDanger, isSafeRole } from "./safety.ts";
import { buildTriagePrompt, fallbackTriage, finalizeTriage, MAX_GUARDIANS } from "./triage.ts";
import type { GuardianCandidate } from "./types.ts";

const guardians: GuardianCandidate[] = [
  {
    user_id: "g1",
    display_name: "Maya Ortiz",
    distance_m: 160,
    push_token: "ExponentPushToken[a]",
    trainings: ["de_escalation"],
  },
  {
    user_id: "g2",
    display_name: "Jordan",
    distance_m: 420,
    push_token: "ExponentPushToken[b]",
    trainings: ["first_aid"],
  },
  { user_id: "g3", display_name: "Sam", distance_m: 900, push_token: null, trainings: [] },
  { user_id: "g4", display_name: "Lee", distance_m: 1300, push_token: "ExponentPushToken[d]", trainings: [] },
];
const silent = { note: null, trigger: "hold" as const };

Deno.test("danger detection", () => {
  assert(describesImmediateDanger("he has a knife"));
  assert(describesImmediateDanger("My friend is not breathing"));
  assert(describesImmediateDanger("guy grabbed me and won't let me leave"));
  assertFalse(describesImmediateDanger("someone is following me"));
  assertFalse(describesImmediateDanger(null));
});

Deno.test("unsafe guardian roles are rejected", () => {
  assertFalse(isSafeRole("Chase him down the block"));
  assertFalse(isSafeRole("Confront the man and get his name"));
  assertFalse(isSafeRole("Restrain him until police arrive"));
  assert(isSafeRole("Walk to the corner of 5th and Main and stay visible"));
  assert(isSafeRole("Call her and stay on the line"));
  assert(isSafeRole("Stay with her. Don't pursue anyone."));
  assertFalse(isSafeRole("Don't wait, chase him"));
});

Deno.test("fallback triage sends the closest guardians with safe roles", () => {
  const t = fallbackTriage(silent, guardians, "Alice Smith");
  assertEquals(t.urgency, "high");
  assertFalse(t.call_911_recommended);
  assertEquals(t.guardian_roles.map((r) => r.user_id), ["g1", "g2", "g3"]);
  assertMatch(t.summary, /Maya is about 2 minutes away/);
  assert(t.guardian_roles.every((r) => isSafeRole(r.role)));
});

Deno.test("fallback triage with no guardians points to 911", () => {
  const t = fallbackTriage(silent, [], "Alice");
  assertEquals(t.guardian_roles, []);
  assertMatch(t.summary, /call 911/);
});

Deno.test("fallback triage escalates described danger", () => {
  const t = fallbackTriage({ note: "he hit me", trigger: "tap" }, guardians, "Alice");
  assertEquals(t.urgency, "critical");
  assert(t.call_911_recommended);
});

Deno.test("finalizeTriage keeps good model output", () => {
  const t = finalizeTriage(
    {
      urgency: "high",
      category: "being followed",
      call_911_recommended: false,
      summary: "Maya is two minutes away. Head into the pharmacy on your left.",
      guardian_roles: [
        { user_id: "g1", role: "Meet her at the pharmacy entrance and stay with her." },
        { user_id: "g2", role: "Call her now and stay on the line." },
      ],
    },
    { note: "someone is following me", trigger: "hold" },
    guardians,
    "Alice",
  );
  assert(t);
  assertEquals(t.category, "being followed");
  assertEquals(t.guardian_roles.length, 2);
  assertEquals(t.guardian_roles[0].role, "Meet her at the pharmacy entrance and stay with her.");
});

Deno.test("finalizeTriage overrides the model where it would make things worse", () => {
  const t = finalizeTriage(
    {
      urgency: "low",
      category: "minor",
      call_911_recommended: false,
      summary: "Someone is nearby.",
      guardian_roles: [
        { user_id: "g1", role: "Chase the attacker and get his plate number." },
        { user_id: "unknown", role: "Go help" },
        { user_id: "g1", role: "duplicate" },
        { user_id: "g2", role: "Bring your first aid kit." },
        { user_id: "g3", role: "Stay nearby." },
        { user_id: "g4", role: "Stay nearby too." },
      ],
    },
    { note: "he has a gun", trigger: "tap" },
    guardians,
    "Alice",
  );
  assert(t);
  assertEquals(t.urgency, "critical");
  assert(t.call_911_recommended);
  assertMatch(t.summary, /911/);
  assertEquals(t.guardian_roles.map((r) => r.user_id), ["g1", "g2", "g3"]);
  assert(isSafeRole(t.guardian_roles[0].role));
  assertEquals(t.guardian_roles.length, MAX_GUARDIANS);
});

Deno.test("finalizeTriage never treats a silent alert as low, and always sends someone", () => {
  const t = finalizeTriage(
    { urgency: "low", category: "x", call_911_recommended: false, summary: "ok", guardian_roles: [] },
    silent,
    guardians,
    "Alice",
  );
  assert(t);
  assertEquals(t.urgency, "high");
  assertEquals(t.guardian_roles.map((r) => r.user_id), ["g1"]);
});

Deno.test("finalizeTriage rejects unusable output", () => {
  assertEquals(finalizeTriage(null, silent, guardians, "A"), null);
  assertEquals(finalizeTriage({ urgency: "panic", summary: "x" }, silent, guardians, "A"), null);
  assertEquals(finalizeTriage({ urgency: "high", summary: "  " }, silent, guardians, "A"), null);
});

Deno.test("triage prompt carries first names only and rounded distances", () => {
  const prompt = JSON.parse(buildTriagePrompt({ mode: "her_o", trigger: "hold", note: " " }, guardians, ["Bob Jones"]));
  assertEquals(prompt.request.note, null);
  assertEquals(prompt.nearby_guardians[0].first_name, "Maya");
  assertEquals(prompt.circle_alerted, ["Bob"]);
  assertFalse("push_token" in prompt.nearby_guardians[0]);
});

Deno.test("composeBrief reflects responder states", () => {
  const brief = composeBrief("Alice", [
    { user_id: "g1", display_name: "Maya", kind: "guardian", status: "on_scene", distance_m: 100 },
    { user_id: "g2", display_name: "Jordan", kind: "guardian", status: "en_route", distance_m: 400 },
    { user_id: "c1", display_name: "Bob", kind: "circle", status: "notified", distance_m: null },
  ], true);
  assertEquals(
    brief,
    "Maya is with Alice. Jordan is on the way, about 5 minutes away. If anyone is in danger, call 911 now.",
  );
  assertEquals(composeBrief("Alice", [], false), "Looking for help nearby.");
});

Deno.test("minutesAway", () => {
  assertEquals(minutesAway(10), 1);
  assertEquals(minutesAway(800), 10);
  assertEquals(minutesAway(null), null);
});

Deno.test("push messages dedupe and drop invalid tokens", async () => {
  const msgs = buildPushMessages(["ExponentPushToken[a]", "ExponentPushToken[a]", "garbage", null], "t", "b", { x: 1 });
  assertEquals(msgs.length, 1);
  assertEquals(msgs[0].priority, "high");
  let calls = 0;
  const fakeFetch = (() => {
    calls++;
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;
  assertEquals(await sendPush(msgs, fakeFetch), 1);
  assertEquals(calls, 1);
  const failing = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  assertEquals(await sendPush(msgs, failing), 0);
});

Deno.test("check-ins only accepts the scheduler secret", async () => {
  const { isServiceRequest } = await import("./walks.ts");
  assert(isServiceRequest("Bearer secret-key", "secret-key"));
  assertFalse(isServiceRequest("Bearer secret-kez", "secret-key"));
  assertFalse(isServiceRequest("Bearer anon", "secret-key"));
  assertFalse(isServiceRequest(null, "secret-key"));
  assertFalse(isServiceRequest("Bearer ", undefined));
});
