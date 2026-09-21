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

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireProjectInTenant } from '@/lib/auth/tenant-isolation';
import { guardParentScope } from '@/lib/api/tenant-scope-http';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { generateEmploymentRecordId } from '@/services/enterprise-id.service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { nowISO } from '@/lib/date-local';

export const maxDuration = 30;

/** Η διαδρομή, μία φορά — μπαίνει **αυτούσια** στο ίχνος ελέγχου κάθε άρνησης. */
const EMPLOYMENT_RECORDS_PATH = '/api/ika/employment-records';

// =============================================================================
// TYPES
// =============================================================================

const WorkerSummarySchema = z.object({
  contactId: z.string().min(1).max(128),
  daysWorked: z.number().int().min(0).max(31),
  insuranceClassNumber: z.number().int().nullable().optional(),
  stampsCount: z.number().int().min(0),
  imputedDailyWage: z.number().min(0).nullable().optional(),
  employerContribution: z.number().min(0),
  employeeContribution: z.number().min(0),
  totalContribution: z.number().min(0),
  hasIssues: z.boolean().optional(),
});

const SaveEmploymentRecordsSchema = z.object({
  projectId: z.string().min(1).max(128),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2099),
  workerSummaries: z.array(WorkerSummarySchema),
});

// =============================================================================
// POST — Batch Save Employment Records
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(SaveEmploymentRecordsSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        // 🔒 **Ο ΓΟΝΕΑΣ ΠΡΙΝ ΤΟ ΕΡΩΤΗΜΑ** — ADR-745 §9.5 · ADR-747 §13.7 #1.
        //
        // Το `projectId` έρχεται από το **σώμα του αιτήματος**, δηλαδή από τον καλούντα.
        // Το `withAuth` απαντά *«είσαι συνδεδεμένος;»*, **ποτέ** *«είναι δικό σου;»* —
        // οπότε χωρίς αυτή τη γραμμή κάθε πιστοποιημένος χρήστης διάβαζε (και μέσω του
        // `existingMap` **επανέγραφε**) τα ένσημα **οποιουδήποτε** έργου του οποίου
        // ήξερε το id.
        //
        // ⛔ **ΓΙΑΤΙ ΟΧΙ «ΣΚΕΤΟ `where(companyId)`»**: τα έγγραφα του ΙΚΑ απέκτησαν
        // `companyId` **μετά** τη γέννηση της συλλογής. Ερώτημα που φιλτράρει μόνο σε
        // αυτό **δεν βλέπει** τα παλαιότερα ⇒ το `existingMap` βγαίνει κενό ⇒ ο ίδιος
        // εργαζόμενος αποκτά **δεύτερη** εγγραφή για τον ίδιο μήνα. Δηλαδή ο προφανής
        // «φράχτης» θα γεννούσε **διπλά ένσημα**: σφάλμα **τιμής**, όχι πρόσβασης.
        // Ο έλεγχος **ιδιοκτησίας του γονέα** κλείνει την πόρτα χωρίς να αγγίξει την
        // πληρότητα της ανάγνωσης.
        // 🔑 **Μέσω του `guardParentScope`, ΟΧΙ με δικό μας `catch`** — ADR-742 §7undecies.
        //    Το `try/catch (e instanceof TenantIsolationError)` είναι **ήδη** κεντρικό·
        //    η πρώτη γραφή αυτής της διόρθωσης το ξανάγραψε εδώ και στο `apd-status`, και
        //    το **jscpd το έπιασε ως δίδυμο 11 γραμμών** (N.18) — ακριβώς το σχήμα που
        //    εκείνος ο κανόνας υπάρχει για να πιάνει. Εδώ μένει **μία** κλήση.
        const refusal = await guardParentScope(
          () => requireProjectInTenant({
            ctx,
            projectId: body.projectId,
            path: EMPLOYMENT_RECORDS_PATH,
          }),
          'Project not found',
        );
        if (refusal) return refusal;

        const db = getAdminFirestore();
        const now = nowISO();
        const collRef = db.collection(COLLECTIONS.EMPLOYMENT_RECORDS);

        // Load existing records for this project+month+year.
        //
        // ✅ **Ο ΔΕΥΤΕΡΟΣ ΦΡΑΧΤΗΣ, ΣΚΟΠΙΜΑ ΧΩΡΙΣ `companyId`** — ο άξονας απομόνωσης
        // εδώ είναι ο **γονέας**, που μόλις αποδείχθηκε δικός μας μία γραμμή πιο πάνω
        // (OWASP Multi-Tenant §"enforce ownership in the data-access layer"). Η
        // πληρότητα της ανάγνωσης είναι **απαίτηση ορθότητας**: ό,τι δεν βρεθεί εδώ
        // γεννιέται ξανά παρακάτω.
        // tenant-scope-exempt: γονέας επαληθευμένος πριν (requireProjectInTenant)
        const existingSnapshot = await collRef
          .where(FIELDS.PROJECT_ID, '==', body.projectId)
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
            const newRef = collRef.doc(generateEmploymentRecordId());
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
