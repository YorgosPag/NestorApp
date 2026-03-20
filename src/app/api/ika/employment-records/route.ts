/**
 * =============================================================================
 * POST /api/ika/employment-records — Batch save employment records
 * =============================================================================
 *
 * Migrated from client-side write (useEmploymentRecords.ts) to server-side
 * for: validation, tenant isolation, audit trail, atomic batch writes.
 *
 * Records contain legally-binding EFKA stamps, contributions, APD status.
 *
 * @module api/ika/employment-records
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 * @security SPEC-255C — Client-Side Writes Migration (CRITICAL)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';

export const maxDuration = 30;

// =============================================================================
// TYPES
// =============================================================================

interface WorkerStampsSummaryInput {
  contactId: string;
  daysWorked: number;
  insuranceClassNumber?: number;
  stampsCount: number;
  imputedDailyWage?: number;
  employerContribution: number;
  employeeContribution: number;
  totalContribution: number;
  hasIssues?: boolean;
}

interface SaveEmploymentRecordsBody {
  projectId: string;
  month: number;
  year: number;
  workerSummaries: WorkerStampsSummaryInput[];
}

// =============================================================================
// POST — Batch Save Employment Records
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as SaveEmploymentRecordsBody;

        // Validation
        if (!body.projectId || !body.month || !body.year || !Array.isArray(body.workerSummaries)) {
          return NextResponse.json(
            { success: false, error: 'projectId, month, year, workerSummaries are required' },
            { status: 400 }
          );
        }

        if (body.month < 1 || body.month > 12) {
          return NextResponse.json(
            { success: false, error: 'month must be 1-12' },
            { status: 400 }
          );
        }

        const db = getAdminFirestore();
        const now = new Date().toISOString();
        const collRef = db.collection(COLLECTIONS.EMPLOYMENT_RECORDS);

        // Load existing records for this project+month+year
        const existingSnapshot = await collRef
          .where('projectId', '==', body.projectId)
          .where('year', '==', body.year)
          .where('month', '==', body.month)
          .get();

        const existingMap = new Map<string, { id: string; apdStatus: string; apdSubmissionDate: string | null; apdReferenceNumber: string | null }>();
        for (const doc of existingSnapshot.docs) {
          const data = doc.data();
          existingMap.set(data.contactId as string, {
            id: doc.id,
            apdStatus: data.apdStatus as string,
            apdSubmissionDate: (data.apdSubmissionDate as string) ?? null,
            apdReferenceNumber: (data.apdReferenceNumber as string) ?? null,
          });
        }

        const batch = db.batch();
        let created = 0;
        let updated = 0;

        for (const ws of body.workerSummaries) {
          if (ws.hasIssues) continue;

          const recordData = {
            projectId: body.projectId,
            contactId: ws.contactId,
            month: body.month,
            year: body.year,
            totalDaysWorked: ws.daysWorked,
            totalHoursWorked: ws.daysWorked * 8,
            overtimeHours: 0,
            insuranceClassNumber: ws.insuranceClassNumber ?? 0,
            stampsCount: ws.stampsCount,
            dailyWage: ws.imputedDailyWage ?? 0,
            employerContribution: ws.employerContribution,
            employeeContribution: ws.employeeContribution,
            totalContribution: ws.totalContribution,
            companyId: ctx.companyId,
            updatedAt: now,
          };

          const existing = existingMap.get(ws.contactId);

          if (existing) {
            // Update — preserve APD status if already submitted
            const docRef = collRef.doc(existing.id);
            batch.update(docRef, {
              ...recordData,
              apdStatus: existing.apdStatus === 'pending' ? 'pending' : existing.apdStatus,
              apdSubmissionDate: existing.apdSubmissionDate,
              apdReferenceNumber: existing.apdReferenceNumber,
            });
            updated++;
          } else {
            // Create new
            const newRef = collRef.doc();
            batch.set(newRef, {
              ...recordData,
              apdStatus: 'pending',
              apdSubmissionDate: null,
              apdReferenceNumber: null,
              createdAt: now,
            });
            created++;
          }
        }

        await batch.commit();

        await logAuditEvent(ctx, 'data_created', body.projectId, 'project', {
          metadata: {
            reason: `Employment records batch saved — ΕΦΚΑ compliance (${body.month}/${body.year}, created: ${created}, updated: ${updated})`,
          },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({
          success: true,
          data: { created, updated, total: created + updated },
        }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to save employment records');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
