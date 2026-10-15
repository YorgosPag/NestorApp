/**
 * @fileoverview `GET /api/document-registry` — το μητρώο λήξεων εγγράφων της εταιρείας (ADR-915 Φ4β).
 * @related services/document-registry/document-registry.service.ts · app/api/owner-properties/brokered/route.ts (ιδίωμα)
 *
 * ⚠️ **Καμία παράμετρος από το δίκτυο δεν αγγίζει την εμβέλεια**: δεν υπάρχει `?companyId=`, ούτε φίλτρο κατάστασης.
 * Η κατάσταση είναι **υπολογισμένη** (`documentStanding`), άρα ένα φίλτρο διακομιστή θα ήταν δεύτερος ταξινομητής· η
 * οθόνη φιλτράρει ό,τι ήδη κρίθηκε (`matchesRegistryFilter`). Εμβέλεια = `ctx.companyId`, σε **μία** γραμμή.
 *
 * 🔑 **Χωρίς `policy`** (Ε5): ίδιο με τα ακίνητα — κάθε μέλος της εταιρείας βλέπει τα έγγραφά της· κανένα νέο
 * δικαίωμα πελάτη, άρα καμία νέα σουίτα κανόνων (3.16).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

async function registryHandler(_request: NextRequest, ctx: AuthContext): Promise<NextResponse<DocumentRegistryResponse>> {
  const registry = await readDocumentRegistry(getAdminFirestore(), ctx.companyId, new Date());
  return NextResponse.json(registry);
}

export const GET = withStandardRateLimit(withAuth(registryHandler));
