/**
 * ADR-901 Φ4.4 — η ΜΙΑ μετάφραση αποτελέσματος transmittal → HTTP (αποστολή · απόσυρση).
 *
 * - δική μου συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο (ίδιο με την όψη/τα αρχεία)
 * - πάγωμα υπόθεσης ⇒ 409 (`case-frozen`) · άλλη άρνηση του κριτή ⇒ 422 με το όνομά της
 * - ανύπαρκτο / ξένο / λάθος αρχείο ⇒ 404 — **ίδιο**, κανένα μαντείο ύπαρξης
 * - «δεν μπόρεσα να ξέρω» ⇒ 503
 *
 * @module api/engagements/_shared/contribution-response
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import type { IssueContributionOutcome, WithdrawContributionOutcome } from '@/services/conveyance/conveyance-contribution.service';
import type { ContributionSummary } from '@/types/conveyance-contribution';

type Outcome = IssueContributionOutcome | WithdrawContributionOutcome;

const STATUS = { 'not-found': 404, unknown: 503, failed: 503 } as const;

export function contributionResponse(outcome: Outcome, uid: string) {
  if (outcome.ok) {
    const { contribution } = outcome;
    const summary: ContributionSummary = {
      id: contribution.id,
      checklistItemId: contribution.checklistItemId,
      authorRole: contribution.authorRole,
      fileId: contribution.file.fileId,
      displayName: contribution.file.displayName,
      issuedAt: contribution.issuedAt,
      own: contribution.authorUid === uid,
    };
    return apiSuccess({ kind: outcome.kind, contribution: summary });
  }
  switch (outcome.rejection) {
    case 'denied':
      return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
    case 'refused':
      return NextResponse.json({ success: false, error: outcome.refusal }, { status: outcome.refusal === 'case-frozen' ? 409 : 422 });
    default:
      return NextResponse.json({ success: false, error: outcome.rejection }, { status: STATUS[outcome.rejection] });
  }
}
