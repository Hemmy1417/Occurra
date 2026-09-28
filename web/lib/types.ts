/**
 * The records the contract writes, as it writes them. Every field here is a
 * field contracts/occurra.py puts in its JSON; nothing is inferred. When the
 * contract changes a shape, this file changes with it (tests/shapes.test.ts
 * holds fixtures built from the contract's own writes).
 */

export type Category = "PROPERTY" | "VEHICLE" | "CARGO" | "BUSINESS_INTERRUPTION";
export type TypeState = "ACTIVE" | "PAUSED";
export type ClaimState = "OPEN" | "DETERMINED" | "UNDER_APPEAL" | "FINAL" | "WITHDRAWN" | "CLOSED";
export type Outcome = "ESTABLISHED" | "NOT_ESTABLISHED" | "UNDETERMINED";
export type Rating = "SATISFIED" | "NOT_SATISFIED" | "NOT_ESTABLISHED" | "NOT_APPLICABLE";
export type Lifecycle = "APPEALABLE" | "APPEALED" | "SUPERSEDED" | "FINAL";
export type Role = "CLAIMANT" | "ASSESSOR" | "SPONSOR";
export type View = "SCENE" | "DAMAGE_DETAIL" | "IDENTIFIER" | "BEFORE" | "DOCUMENT_SCAN";
export type DocType =
  | "INCIDENT_REPORT" | "REPAIR_ESTIMATE" | "DELIVERY_RECORD" | "CLOSURE_NOTICE" | "CLAIMANT_STATEMENT"
  | "ASSESSOR_REPORT";
export type RequirementType =
  | "SCENE_PHOTO" | "DAMAGE_PHOTO" | "IDENTIFIER_PHOTO" | "BEFORE_PHOTO" | "INCIDENT_REPORT" | "REPAIR_ESTIMATE"
  | "DELIVERY_RECORD" | "CLOSURE_NOTICE" | "ASSESSOR_REPORT";

export interface Config {
  ruleset: string;
  categories: Record<Category, string[]>;
  image_views: View[];
  document_types: DocType[];
  requirement_types: RequirementType[];
  system_requirements: { id: string; text: string }[];
  determination_rule: string[];
  limits: {
    max_criteria: number;
    max_evidence_rules: number;
    max_assessors: number;
    max_versions: number;
    max_open_per_claimant: number;
    min_benefit_wei: string;
    max_benefit_wei: string;
    window_seconds: [number, number];
    max_image_bytes: number;
    max_text_chars: number;
    quotas: Record<Role, { IMAGE: number; TEXT: number }>;
    appeal_additions: { IMAGE: number; TEXT: number };
    stale_appeal_seconds: number;
  };
}

export interface Stats {
  type: number;
  claim: number;
  evidence: number;
  determination: number;
  established: number;
  paid_wei: number;
}

export interface EvidenceRule {
  type: RequirementType;
  min_count: number;
}

/** One immutable version of an event type. */
export interface TypeVersion {
  type_id: string;
  version: number;
  published_at: string;
  title: string;
  category: Category;
  event_kind: string;
  definition: string;
  exclusions: string;
  criteria: { id: string; text: string }[];
  evidence_requirements: EvidenceRule[];
  benefit_wei: string;
  bond_wei: string;
  filing_window_days: number;
  evidence_days: number;
  appeal_window_seconds: number;
  evidence_period_seconds: number;
  max_appeals: number;
  assessors: string[];
  assessor_required: boolean;
}

/** The event type's running record; get_event_type adds the last three fields. */
export interface EventType {
  type_id: string;
  sponsor: string;
  state: TypeState;
  version: number;
  title: string;
  category: Category;
  event_kind: string;
  benefit_wei: string;
  bond_wei: string;
  created_at: string;
  reserve_wei: string;
  committed_wei: string;
  funded_wei: string;
  paid_wei: string;
  forfeited_wei: string;
  withdrawn_wei: string;
  open_claims: number;
  claim_count: number;
  free_wei?: string;
  accepted_assessors?: string[];
  now?: string;
}

export interface Evidence {
  evidence_id: string;
  claim_id: string;
  type_id: string;
  role: Role;
  kind: "IMAGE" | "DOCUMENT";
  submitter: string;
  submitted_at: string;
  content_hash: string;
  bytes: number;
  during_appeal: boolean;
  view?: View;
  doc_type?: DocType;
  title?: string;
  description: string;
  capture_note: string;
}

export interface Appeal {
  determination_id: string;
  by: "CLAIMANT" | "SPONSOR";
  opened_by: string;
  reason: string;
  opened_at: string;
  mark: number;
  evidence_ends: string;
}

export interface Final {
  determination: Outcome;
  determination_id: string;
  at: string;
  how: string;
  paid_wei: string;
  bond_to: "CLAIMANT" | "SPONSOR_RESERVE";
}

export interface Claim {
  claim_id: string;
  type_id: string;
  type_version: number;
  sponsor: string;
  claimant: string;
  assessor: string;
  subject: string;
  subject_ref: string;
  location: string;
  event_date: string;
  declared_cause: string;
  account: string;
  state: ClaimState;
  bond_wei: string;
  benefit_wei: string;
  filed_at: string;
  evidence_ends: string;
  determinations: string[];
  determination_id: string | null;
  appeal: Appeal | null;
  appeals_used: number;
  final: Final | null;
  closed_at: string | null;
  close_reason: string | null;
  bond_to: "CLAIMANT" | "SPONSOR_RESERVE" | null;
  /** get_claim only */
  evidence?: Evidence[];
  now?: string;
}

export interface RequirementResult {
  id: string;
  source: "EVENT_TYPE" | "SYSTEM";
  text: string;
  status: Rating;
}

export interface Observation {
  evidence_id: string;
  view: string;
  role: string;
  seen: boolean;
  shows: string;
  text: string[];
  subject_doubts: string;
  change: string;
}

export interface Determination {
  determination_id: string;
  snapshot_id: string;
  kind: "ASSESSMENT" | "READJUDICATION";
  claim_id: string;
  type_id: string;
  type_version: number;
  claimant: string;
  decided_at: string;
  requested_by: string;
  determination: Outcome;
  requirements: RequirementResult[];
  failed: string[];
  not_established: string[];
  evidence_sufficient: boolean;
  conflicts_detected: boolean;
  unseen: string[];
  bound: { determination: boolean; requirements: string[]; ratings_by: string };
  appeal_of: string | null;
  appeal: { by: string; opened_by: string; reason: string; opened_at: string } | null;
  lifecycle: Lifecycle;
  appeal_window_ends: string;
  appeals_left: number;
  finalized_at: string | null;
  superseded_by: string | null;
  notes: {
    reasoning: string;
    conflict_note: string;
    raw: Record<string, Rating>;
    basis: Record<string, string[]>;
    requirement_notes: Record<string, string>;
    observations: Observation[];
    finalized_undecided_on_appeal?: boolean;
  };
}

export interface Snapshot {
  snapshot_id: string;
  determination_id: string;
  claim_id: string;
  type_id: string;
  type_version: number;
  evaluated_at: string;
  evidence_count: number;
  evidence: { evidence_id: string; kind: string; type: string; role: string; content_hash: string;
              new_on_appeal: boolean }[];
}

export interface Receipt {
  claim_id: string;
  type_id: string;
  type_version: number;
  category: Category;
  event_kind: string;
  state: ClaimState;
  determination: Outcome | null;
  final: boolean;
  determination_id: string | null;
  snapshot_id: string | null;
  decided_at: string | null;
  finalized_at: string | null;
  subject_ref: string;
  event_date: string;
  claimant: string;
}

export interface Credit {
  owed: string;
  paid: string;
}

export interface ChainEvent {
  n: number;
  kind: string;
  subject: string;
  detail: string;
  at: string;
  by: string;
}

export interface EventsPage {
  total: number;
  events: ChainEvent[];
}
