'use client';

/**
 * Client API helpers for the super-admin BIM Diagnostics dashboard.
 * Wraps PATCH/PUT calls with Firebase ID-token auth.
 *
 * @module admin/bim-diagnostics/lib/admin-api
 */

import { getAuth } from 'firebase/auth';
import type { TriageHistoryEntry, TriageStatus } from '@/types/performance-diagnostic';

async function authHeader(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export interface TriagePatchPayload {
  status?: TriageStatus;
  transitionNote?: string;
  assignedSuperAdminId?: string | null;
}

export interface TriagePatchResponse {
  id: string;
  status: TriageStatus;
  assignedSuperAdminId: string | null;
  triageHistory: TriageHistoryEntry[];
}

export async function patchTriage(
  diagnosticId: string,
  payload: TriagePatchPayload,
): Promise<TriagePatchResponse> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(`/api/admin/bim-diagnostics/${diagnosticId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as TriagePatchResponse;
}

export interface NotesPutResponse {
  id: string;
  internalNotes: string | null;
}

export async function putInternalNote(
  diagnosticId: string,
  note: string,
): Promise<NotesPutResponse> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(`/api/admin/bim-diagnostics/${diagnosticId}/notes`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as NotesPutResponse;
}
