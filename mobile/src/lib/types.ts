// Row shapes for the tables in supabase/migrations. Keep in sync by hand
// until `supabase gen types` is wired into CI.

export type HelpMode = 'here_o' | 'her_o';
export type IncidentStatus = 'active' | 'resolved' | 'cancelled';
export type ResponderStatus = 'notified' | 'en_route' | 'on_scene' | 'declined' | 'released';
export type Urgency = 'low' | 'elevated' | 'high' | 'critical';

export interface Profile {
  id: string;
  display_name: string;
  her_o_verified: boolean;
  is_guardian: boolean;
  guardian_available: boolean;
}

export interface Incident {
  id: string;
  requester_id: string;
  mode: HelpMode;
  status: IncidentStatus;
  note: string | null;
  lat: number | null;
  lng: number | null;
  urgency: Urgency;
  category: string | null;
  call_911_recommended: boolean;
  brief: string | null;
  triage_source: 'ai' | 'fallback' | null;
  dispatched_at: string | null;
  escalated_911_at: string | null;
  /** How her phone sounded; null when nobody nearby was to be rung. */
  alarm: 'loud' | 'silent' | null;
  ring_at: string | null;
  duress_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Responder {
  incident_id: string;
  user_id: string;
  kind: 'circle' | 'guardian';
  status: ResponderStatus;
  role: string | null;
  distance_m: number | null;
  updated_at: string;
  profiles: { display_name: string } | null;
}

export interface IncidentEvent {
  id: number;
  incident_id: string;
  actor_id: string | null;
  kind: 'created' | 'triaged' | 'brief' | 'message' | 'status' | 'escalated_911' | 'resolved' | 'cancelled';
  body: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
}

export const COURSES = [
  { id: 'code_of_conduct', title: 'Hero code of conduct', detail: 'Be present, de-escalate, never pursue. Required.', selfServe: true },
  { id: 'de_escalation', title: 'De-escalation', detail: 'Calm a tense moment with words and position.', selfServe: false },
  { id: 'bystander', title: 'Bystander intervention', detail: 'The 5 Ds: distract, delegate, document, delay, direct.', selfServe: false },
  { id: 'stop_the_bleed', title: 'Stop the Bleed', detail: 'Control serious bleeding until EMS arrives.', selfServe: false },
  { id: 'first_aid', title: 'First aid & CPR', detail: 'Certified first aid and CPR.', selfServe: false },
] as const;

export type CourseId = (typeof COURSES)[number]['id'];

export type WalkStatus = 'active' | 'arrived' | 'cancelled' | 'escalated';
export type TripKind = 'walk' | 'run' | 'ride';

/** A trip. Stored in the walks table, which predates runs and rides. */
export interface Walk {
  id: string;
  user_id: string;
  mode: HelpMode;
  kind: TripKind;
  status: WalkStatus;
  destination: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  /** True when the trip ended because the traveller reached the destination. */
  arrived_automatically: boolean;
  started_at: string;
  due_at: string;
  lat: number | null;
  lng: number | null;
  location_at: string | null;
  ended_at: string | null;
  incident_id: string | null;
  profiles?: { display_name: string } | null;
}

export interface HerOVerification {
  user_id: string;
  status: 'pending' | 'approved' | 'declined';
  note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}
