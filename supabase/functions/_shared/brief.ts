import { describeDistance } from "./geo.ts";
import { firstName } from "./triage.ts";
import type { EventView, Incident, ResponderView } from "./types.ts";

export const BRIEF_SYSTEM =
  `You keep a live incident brief for HereO, a community safety network. Everyone involved reads the same brief: the person who asked for help, their trusted circle, and volunteer guardians.

Write two or three short, calm sentences in plain words: who is on the way or on scene, the latest thing the person said, and the next step. If anything suggests a weapon, violence, or a medical emergency, say to call 911. Guardians are present and de-escalate; never suggest anyone confront or chase someone. Use first names only. No greetings, no markdown.`;

export const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brief"],
  properties: { brief: { type: "string" } },
} as const;

export function buildBriefPrompt(
  incident: Pick<Incident, "note" | "mode">,
  requesterName: string,
  responders: ResponderView[],
  events: EventView[],
): string {
  return JSON.stringify(
    {
      person: firstName(requesterName),
      first_note: incident.note,
      responders: responders.map((r) => ({
        name: firstName(r.display_name),
        kind: r.kind,
        status: r.status,
        distance: r.distance_m == null ? null : describeDistance(r.distance_m),
      })),
      timeline: events.slice(-20).map((e) => ({
        at: e.created_at,
        who: e.actor_name ? firstName(e.actor_name) : "system",
        kind: e.kind,
        text: e.body,
      })),
    },
    null,
    2,
  );
}

/** Deterministic brief from responder states, used when the model is unavailable. */
export function composeBrief(requesterName: string, responders: ResponderView[], call911: boolean): string {
  const name = (r: ResponderView) => firstName(r.display_name);
  const onScene = responders.filter((r) => r.status === "on_scene");
  const enRoute = responders.filter((r) => r.status === "en_route");
  const notified = responders.filter((r) => r.status === "notified");
  const parts: string[] = [];
  if (onScene.length) {
    parts.push(
      `${joinNames(onScene.map(name))} ${onScene.length > 1 ? "are" : "is"} with ${firstName(requesterName)}.`,
    );
  }
  for (const r of enRoute) {
    parts.push(`${name(r)} is on the way${r.distance_m != null ? `, ${describeDistance(r.distance_m)}` : ""}.`);
  }
  if (!onScene.length && !enRoute.length) {
    parts.push(
      notified.length
        ? `${notified.length} ${notified.length === 1 ? "person has" : "people have"} been alerted.`
        : "Looking for help nearby.",
    );
  }
  if (call911) parts.push("If anyone is in danger, call 911 now.");
  return parts.join(" ");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
