/**
 * «This expense document, of THIS company — or 404» — the ONE opening of every `documents/[id]/…` handler.
 *
 * The repository read is tenant-fenced (ADR-917 Φ4.0: foreign ≡ absent), so a foreign id and a missing one give
 * the same 404 — no existence oracle. Returns the repository too: the handler goes on with the same tenant.
 *
 * @module api/accounting/_shared/expense-document-access
 * @see ADR-917 Φ4.0 · ADR-ACC-005
 */

import 'server-only';

import type { AuthContext } from '@/lib/auth';
import { notFound } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';

export async function requireExpenseDocument(auth: AuthContext, documentId: string) {
  const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
  const document = await repository.getExpenseDocument(documentId);
  if (!document) notFound('Document not found');
  return { repository, document };
}
