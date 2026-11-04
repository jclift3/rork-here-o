// The response guard: deterministic rules that check every tool call the Muse
// Spark agent makes before it touches the real world.
// Built during the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026).
//
// The principle: the agent can add help, never remove it.
// * Urgency can go up, never below the floor the words themselves set.
// * An emergency call, once recommended (by the agent or by the rules), stays
//   recommended.
// * Heroes get one safe job each: never confront, chase, follow or detain.
// * At most MAX_GUARDIANS heroes, and only people the search actually found.
// * Anything the person in trouble reads mentions the emergency number when a
//   call is recommended.
// Every verdict is recorded with its reason, so each incident has an audit
// trail of what the AI tried and what the rules did about it.

import { describesImmediateDanger, GUARDIAN_CONDUCT, isSafeRole } from "../safety.ts";
import { MAX_GUARDIANS } from "../triage.ts";
import type { GuardianCandidate, Urgency } from "../types.ts";

export const URGENCY_ORDER: Urgency[] = ["low", "elevated", "high", "critical"];

export type Verdict = "allowed" | "changed" | "blocked";

export interface Decision {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  verdict: Verdict;
  reason: string | null;
}

export interface Assignment {
  user_id: string;
  job: string;
  distance_m: number;
}

export interface Note {
  audience: "requester" | "responders" | "everyone";
  text: string;
}

// Being followed or watched is serious even without the words for violence.
const FOLLOWED = /\b(follow(ing|ed)? me|someone('s| is) behind me|won'?t leave me alone|keeps? staring|stalk)/i;

/** UK (and Ireland) use 999/112; everywhere else in our launch plan uses 911. */
export function emergencyNumber(lat: number | null, lng: number | null): "999" | "911" {
  if (lat == null || lng == null) return "911";
  const inBritishIsles = lat > 49.8 && lat < 61 && lng > -11 && lng < 2.1;
  return inBritishIsles ? "999" : "911";
}

export function urgencyFloor(text: string, silent: boolean): Urgency {
  if (describesImmediateDanger(text)) return "critical";
  if (FOLLOWED.test(text)) return "high";
  if (silent) return "high";
  return text.trim() ? "elevated" : "high";
}

function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_ORDER.indexOf(a) >= URGENCY_ORDER.indexOf(b) ? a : b;
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export interface GuardState {
  urgency: Urgency;
  category: string;
  emergencyRecommended: boolean;
  emergencyReason: string | null;
  brief: string | null;
  assignments: Assignment[];
  notes: Note[];
  finished: boolean;
}

export class ResponseGuard {
  readonly decisions: Decision[] = [];
  readonly state: GuardState;
  private step = 0;
  private readonly candidates: Map<string, GuardianCandidate>;
  private readonly floor: Urgency;
  private readonly dangerInWords: boolean;
  readonly number: "999" | "911";

  constructor(
    private readonly ctx: {
      /** Everything the person or their responders have said so far. */
      words: string;
      silent: boolean;
      candidates: GuardianCandidate[];
      /** Guardians already on this incident (they count toward the cap). */
      alreadySent: number;
      alreadySentIds: string[];
      current?: { urgency: Urgency; category: string | null; emergencyRecommended: boolean };
      lat: number | null;
      lng: number | null;
    },
  ) {
    this.candidates = new Map(ctx.candidates.map((c) => [c.user_id, c]));
    this.floor = urgencyFloor(ctx.words, ctx.silent);
    this.dangerInWords = describesImmediateDanger(ctx.words);
    this.number = emergencyNumber(ctx.lat, ctx.lng);
    this.state = {
      urgency: maxUrgency(ctx.current?.urgency ?? "low", this.floor),
      category: ctx.current?.category ?? "help requested",
      emergencyRecommended: (ctx.current?.emergencyRecommended ?? false) || this.dangerInWords,
      emergencyReason: this.dangerInWords ? "the words describe immediate danger" : null,
      brief: null,
      assignments: [],
      notes: [],
      finished: false,
    };
  }

  private record(tool: string, args: Record<string, unknown>, verdict: Verdict, reason: string | null) {
    this.decisions.push({ step: this.step, tool, args, verdict, reason });
  }

  /** Applies one tool call. Returns the text the model sees as the tool result. */
  apply(tool: string, rawArgs: unknown): string {
    this.step++;
    const args = rawArgs && typeof rawArgs === "object" ? rawArgs as Record<string, unknown> : {};
    switch (tool) {
      case "assign_hero":
        return this.assignHero(args);
      case "recommend_emergency_call":
        return this.recommendEmergency(args);
      case "set_assessment":
        return this.setAssessment(args);
      case "write_brief":
        return this.writeBrief(args);
      case "post_note":
        return this.postNote(args);
      case "finish":
        this.state.finished = true;
        this.record(tool, args, "allowed", null);
        return "ok";
      default:
        this.record(tool, args, "blocked", "unknown tool");
        return `error: unknown tool ${tool}`;
    }
  }

  private assignHero(args: Record<string, unknown>): string {
    const id = typeof args.user_id === "string" ? args.user_id : "";
    const job = clean(args.job, 160);
    const candidate = this.candidates.get(id);
    if (!candidate) {
      this.record("assign_hero", args, "blocked", "not one of the heroes the search found");
      return "blocked: that person is not in the nearby_heroes list";
    }
    if (this.ctx.alreadySentIds.includes(id) || this.state.assignments.some((a) => a.user_id === id)) {
      this.record("assign_hero", args, "blocked", "already assigned");
      return "blocked: already assigned";
    }
    if (this.ctx.alreadySent + this.state.assignments.length >= MAX_GUARDIANS) {
      this.record("assign_hero", args, "blocked", `cap of ${MAX_GUARDIANS} heroes per incident`);
      return `blocked: at most ${MAX_GUARDIANS} heroes per incident`;
    }
    if (!job) {
      const safe = `Go to them and stay visible nearby. ${GUARDIAN_CONDUCT}`;
      this.state.assignments.push({ user_id: id, job: safe, distance_m: candidate.distance_m });
      this.record("assign_hero", args, "changed", "no job given; used the safe default");
      return `changed: assigned with the default job "${safe}"`;
    }
    if (!isSafeRole(job)) {
      const safe = `Go to them and stay visible nearby. ${GUARDIAN_CONDUCT}`;
      this.state.assignments.push({ user_id: id, job: safe, distance_m: candidate.distance_m });
      this.record("assign_hero", args, "changed", "job asked a hero to confront, chase or detain; replaced");
      return `changed: heroes never confront, chase, follow or detain. Assigned "${safe}" instead.`;
    }
    this.state.assignments.push({ user_id: id, job, distance_m: candidate.distance_m });
    this.record("assign_hero", args, "allowed", null);
    return "ok: hero alerted with that job";
  }

  private recommendEmergency(args: Record<string, unknown>): string {
    const reason = clean(args.reason, 200) ?? "agent judgement";
    this.state.emergencyRecommended = true;
    this.state.emergencyReason ??= reason;
    this.state.urgency = maxUrgency(this.state.urgency, "high");
    this.record("recommend_emergency_call", args, "allowed", null);
    return `ok: the person and responders are prompted to call ${this.number}`;
  }

  private setAssessment(args: Record<string, unknown>): string {
    const asked = URGENCY_ORDER.includes(args.urgency as Urgency) ? args.urgency as Urgency : null;
    const category = clean(args.category, 40);
    if (category) this.state.category = category;
    if (!asked) {
      this.record("set_assessment", args, "changed", "invalid urgency ignored");
      return `changed: urgency must be one of ${URGENCY_ORDER.join(", ")}; kept ${this.state.urgency}`;
    }
    const next = maxUrgency(asked, this.floor);
    // Never lower urgency that was already set on this incident.
    const final = maxUrgency(next, this.state.urgency);
    this.state.urgency = final;
    if (final !== asked) {
      this.record("set_assessment", args, "changed", `urgency can only go up; floor is ${final}`);
      return `changed: urgency kept at ${final} (the rules never let it drop below that)`;
    }
    this.record("set_assessment", args, "allowed", null);
    return "ok";
  }

  private writeBrief(args: Record<string, unknown>): string {
    let text = clean(args.text, 400);
    if (!text) {
      this.record("write_brief", args, "blocked", "empty brief");
      return "blocked: brief was empty";
    }
    let verdict: Verdict = "allowed";
    let reason: string | null = null;
    if (this.state.emergencyRecommended && !text.includes(this.number)) {
      text += ` If you are in danger, call ${this.number} now.`;
      verdict = "changed";
      reason = `added the ${this.number} prompt because an emergency call is recommended`;
    }
    this.state.brief = text;
    this.record("write_brief", { text }, verdict, reason);
    return verdict === "allowed" ? "ok" : `changed: ${reason}`;
  }

  private postNote(args: Record<string, unknown>): string {
    const audience = ["requester", "responders", "everyone"].includes(args.audience as string)
      ? args.audience as Note["audience"]
      : "everyone";
    const text = clean(args.text, 300);
    if (!text) {
      this.record("post_note", args, "blocked", "empty note");
      return "blocked: empty note";
    }
    if (audience !== "requester" && !isSafeRole(text)) {
      this.record("post_note", args, "blocked", "note asked responders to confront, chase or detain");
      return "blocked: notes to responders can't ask anyone to confront, chase, follow or detain";
    }
    if (this.state.notes.length >= 3) {
      this.record("post_note", args, "blocked", "note limit reached for this run");
      return "blocked: note limit reached";
    }
    this.state.notes.push({ audience, text });
    this.record("post_note", args, "allowed", null);
    return "ok: posted";
  }

  /**
   * Rules applied after the agent finishes, whatever it did. Presence is the
   * point: if heroes are nearby and none were sent on first dispatch, the
   * nearest one goes. A brief always exists.
   */
  finalize(opts: { phase: "dispatch" | "reassess"; requesterFirstName: string; fallbackBrief: string }) {
    if (opts.phase === "dispatch" && this.state.assignments.length === 0 && this.ctx.alreadySent === 0) {
      const nearest = [...this.candidates.values()].sort((a, b) => a.distance_m - b.distance_m)[0];
      if (nearest) {
        const job = `Go to ${opts.requesterFirstName} and stay visible nearby. ${GUARDIAN_CONDUCT}`;
        this.state.assignments.push({ user_id: nearest.user_id, job, distance_m: nearest.distance_m });
        this.step++;
        this.record("guard:presence_floor", { user_id: nearest.user_id }, "changed", "a hero was nearby and none sent");
      }
    }
    if (!this.state.brief) {
      let text = opts.fallbackBrief;
      if (this.state.emergencyRecommended && !text.includes(this.number)) {
        text += ` If you are in danger, call ${this.number} now.`;
      }
      this.state.brief = text;
      this.step++;
      this.record("guard:brief_fallback", {}, "changed", "agent wrote no brief");
    }
  }
}
