'use client';

/**
 * 🏢 ENTERPRISE: Client-side Communications Service
 *
 * ADR-214 Phase 5: READ methods delegated to firestoreQueryService.
 * SECURITY FIX: tenant filtering auto-injected (companyId was previously MISSING).
 *
 * NOTE: Server-side operations (server actions) are in communications.service.ts
 *
 * 🔄 2026-01-17: Uses MESSAGES collection (COMMUNICATIONS collection deprecated)
 * 🔄 2026-03-13: ADR-214 Phase 5 — READ methods via firestoreQueryService (auto companyId)
 */

import { orderBy, where, type DocumentData } from 'firebase/firestore';
import type { Communication } from '@/types/crm';
import { firestoreQueryService } from '@/services/firestore';
import { normalizeToISO } from '@/lib/date-local';

const toCommunication = (raw: DocumentData & { id: string }): Communication => {
  const communication: Record<string, unknown> = {};
  for (const key in raw) {
    const iso = normalizeToISO(raw[key]);
    communication[key] = iso ?? raw[key];
  }
  return communication as unknown as Communication;
};

/**
 * 🎯 ENTERPRISE: Επικοινωνίες ανά επαφή (tenant-aware)
 * SECURITY FIX: Auto companyId filter (was previously MISSING)
 */
export async function getCommunicationsByContact(contactId: string): Promise<Communication[]> {
  const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('MESSAGES', {
    constraints: [where('contactId', '==', contactId), orderBy('createdAt', 'desc')],
  });
  return result.documents.map(toCommunication);
}
