/**
 * =============================================================================
 * PATCH /api/ika/workers/[contactId]/insurance-class
 * =============================================================================
 *
 * Updates the insuranceClassId field on the contact's construction_worker persona.
 * If the persona does not yet exist, it is created with active status.
 *
 * @module api/ika/workers/[contactId]/insurance-class
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 * @enterprise ADR-121 — Contact Persona System
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import type { PersonaData } from '@/types/contacts/personas';

const UpdateInsuranceClassSchema = z.object({
  insuranceClassNumber: z.number().int().min(1).max(99),
});

async function handlePatch(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> },
): Promise<NextResponse> {
  const { contactId } = await segmentData.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateInsuranceClassSchema, await req.json());
        if (parsed.error) return parsed.error;
        const { insuranceClassNumber } = parsed.data;

        const db = getAdminFirestore();
        const contactRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
        const contactSnap = await contactRef.get();

        if (!contactSnap.exists) {
          return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });
        }

        const data = contactSnap.data() ?? {};

        // Tenant isolation check
        if (data.companyId !== ctx.companyId) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const personas: PersonaData[] = (data.personas as PersonaData[] | undefined) ?? [];
        const idx = personas.findIndex(
          (p) => p.personaType === 'construction_worker' && p.status === 'active',
        );

        const oldClassId = idx >= 0
          ? (personas[idx] as { insuranceClassId?: number | null }).insuranceClassId ?? null
          : null;

        if (idx >= 0) {
          personas[idx] = { ...personas[idx], insuranceClassId: insuranceClassNumber } as PersonaData;
        } else {
          personas.push({
            personaType: 'construction_worker',
            status: 'active',
            activatedAt: nowISO(),
            deactivatedAt: null,
            notes: null,
            ikaNumber: null,
            insuranceClassId: insuranceClassNumber,
            triennia: null,
            dailyWage: null,
            specialtyCode: null,
            efkaRegistrationDate: null,
          });
        }

        await contactRef.update({ personas, updatedAt: nowISO() });

        const entityName = `${(data.firstName as string) ?? ''} ${(data.lastName as string) ?? ''}`.trim() || contactId;

        await EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.CONTACT,
          entityId: contactId,
          entityName,
          action: 'updated',
          changes: [{
            field: 'personas.construction_worker.insuranceClassId',
            oldValue: oldClassId,
            newValue: insuranceClassNumber,
            label: 'Ασφαλιστική Κλάση',
          }],
          performedBy: ctx.uid,
          performedByName: ctx.uid,
          companyId: ctx.companyId,
        });

        await logAuditEvent(ctx, 'data_updated', contactId, 'contact', {
          metadata: { reason: `Insurance class set to ${insuranceClassNumber} via IKA stamps tab` },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update insurance class');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
