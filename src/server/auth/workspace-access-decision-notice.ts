import 'server-only';

/**
 * @fileoverview **ΠΕΣ ΣΤΟΝ ΑΙΤΟΥΝΤΑ ΤΙ ΑΠΑΝΤΗΘΗΚΕ** (ADR-660 §6).
 * @module server/auth/workspace-access-decision-notice
 *
 * ⚠️ **Δεν πετά ΠΟΤΕ**: η απόφαση **έχει ήδη** γραφτεί· το email είναι ενημέρωση, όχι μέρος της
 * πράξης. Η αποτυχία του γράφεται στο ημερολόγιο — δεν αναιρεί έγκριση ή απόρριψη.
 */

import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { loadDeclaredEmailLanguage } from '@/server/notifications/user-notification-settings-store';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildWorkspaceAccessDecisionEmail } from '@/services/email-templates/workspace-access-decision-email';
import type { WorkspaceAccessRequestView } from '@/types/workspace-access-request';

const logger = createModuleLogger('WORKSPACE_ACCESS_DECISION_NOTICE');

export async function notifyAccessDecision(request: WorkspaceAccessRequestView): Promise<void> {
  if (request.status !== 'approved' && request.status !== 'denied') return;
  if (!request.requesterEmail.includes('@')) return;

  try {
    const language = await loadDeclaredEmailLanguage(request.requesterUid).catch(() => null);
    const email = buildWorkspaceAccessDecisionEmail({
      decision: request.status,
      language,
      address: request.requesterEmail,
    });
    if (email === null) {
      logger.error('Email απόφασης αιτήματος χωρίς δημόσια διεύθυνση — δεν στάλθηκε', { requestId: request.id });
      return;
    }
    const sent = await sendReplyViaMailgun({
      to: request.requesterEmail, subject: email.subject, textBody: email.text, htmlBody: email.html,
    });
    if (!sent.success) logger.error('Email απόφασης αιτήματος δεν στάλθηκε', { requestId: request.id, error: sent.error });
  } catch (error: unknown) {
    logger.error('Email απόφασης αιτήματος απέτυχε', { requestId: request.id, error: getErrorMessage(error) });
  }
}
