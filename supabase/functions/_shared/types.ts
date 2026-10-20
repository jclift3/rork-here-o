export type HelpMode = "here_o" | "her_o";
export type Urgency = "low" | "elevated" | "high" | "critical";
export type ResponderStatus = "notified" | "en_route" | "on_scene" | "declined" | "released";

export interface Incident {
  id: string;
  requester_id: string;
  mode: HelpMode;
  status: "active" | "resolved" | "cancelled";
  trigger: "hold" | "tap" | "check_in_missed";
  note: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  dispatched_at: string | null;
  brief_at: string | null;
  alarm?: "loud" | "silent" | null;
  ring_at?: string | null;
  duress_at?: string | null;
}

/** A guardian the dispatcher could send, from nearby_guardians(). */
export interface GuardianCandidate {
  user_id: string;
  display_name: string;
  distance_m: number;
  push_token: string | null;
  trainings: string[];
}

export interface Triage {
  urgency: Urgency;
  /** Short label such as "being followed" or "medical". */
  category: string;
  call_911_recommended: boolean;
  /** Two or three calm sentences for the person who asked for help. */
  summary: string;
  /** One instruction per guardian chosen to respond, closest first. */
  guardian_roles: { user_id: string; role: string }[];
}

export interface ResponderView {
  user_id: string;
  display_name: string;
  kind: "circle" | "guardian";
  status: ResponderStatus;
  distance_m: number | null;
}

export interface EventView {
  kind: string;
  body: string | null;
  actor_name: string | null;
  created_at: string;
}
