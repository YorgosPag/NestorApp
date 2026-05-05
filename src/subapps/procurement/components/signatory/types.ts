/**
 * ADR-336 — Client-safe types for the signatory commit flow.
 * Mirrors the server-side `commit-signatory-service` request/response shape
 * so UI components can build typed payloads without importing 'server-only'
 * modules.
 */

import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';

export interface SignatoryFields {
  firstName: string;
  lastName: string;
  role: string | null;
  profession: string | null;
  /** ESCO occupation URI (set when picked from autocomplete, ADR-034) */
  escoUri: string | null;
  /** Cached ESCO label */
  escoLabel: string | null;
  /** ISCO-08 4-digit code */
  iscoCode: string | null;
  mobile: string | null;
  email: string | null;
  vatNumber: string | null;
}

export type SignatoryFieldKey = keyof SignatoryFields;

export type RelationshipTypeChoice =
  | { kind: 'static'; type: RelationshipType }
  | { kind: 'custom'; labelEl: string; reverseLabelEl?: string | null };

export interface CommitSignatoryRequest {
  signatory: SignatoryFields;
  relationshipType: RelationshipTypeChoice;
  linkToContactId?: string | null;
  forceCreate?: boolean;
}

export interface WeakMatchCandidate {
  contactId: string;
  displayName: string;
  matchedOn: ReadonlyArray<'mobile' | 'email' | 'name'>;
  divergenceReason: string;
}

export type CommitMatchKind = 'strong' | 'weak_force_create' | 'none' | 'manual_link';

export interface CommitSignatorySuccess {
  success: true;
  data: {
    contactId: string;
    relationshipId: string;
    matchKind: CommitMatchKind;
    relationshipTypeKey: string;
    relationshipTypeIsStatic: boolean;
    reused: { contact: boolean; relationship: boolean };
  };
}

export interface CommitSignatoryDisambiguation {
  success: false;
  requiresDisambiguation: true;
  candidates: WeakMatchCandidate[];
}

export interface CommitSignatoryError {
  success: false;
  error: string;
}

export type CommitSignatoryResponse =
  | CommitSignatorySuccess
  | CommitSignatoryDisambiguation
  | CommitSignatoryError;
