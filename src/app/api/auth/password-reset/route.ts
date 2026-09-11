/**
 * POST /api/auth/password-reset — **στείλτε μου σύνδεσμο νέου κωδικού** (ADR-851 Φ2).
 *
 * 🔒 **ΙΔΙΑ ΑΠΑΝΤΗΣΗ ΓΙΑ ΟΛΟΥΣ, ΚΑΙ ΣΤΟΝ ΙΔΙΟ ΧΡΟΝΟ.** Η απόκριση `202` φεύγει **πριν**
 * ρωτηθεί αν υπάρχει λογαριασμός — η αναζήτηση και η αποστολή γίνονται στο `after()`.
 * Αλλιώς ο **χρόνος** θα πρόδιδε ό,τι κρύβει το σώμα: γνωστό email ⇒ δημιουργία συνδέσμου +
 * Mailgun (εκατοντάδες ms)· άγνωστο ⇒ μία ανάγνωση (OWASP Authentication Cheat Sheet,
 * «user enumeration via response times»).
 *
 * Δημόσια πόρτα (ο καλών ξέχασε τον κωδικό του)· όριο **ανά IP** εδώ (`withSensitiveRateLimit`)
 * **και** ανά **παραλήπτη** μέσα στην υπηρεσία (`AUTH_MAIL_RECIPIENT_QUOTA`).
 *
 * @module api/auth/password-reset
 */

import 'server-only';

import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { sendPasswordResetMail } from '@/server/auth/auth-action-mail';

const logger = createModuleLogger('PASSWORD_RESET_ROUTE');

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  language: z.string().max(16).optional(),
});

async function handler(request: NextRequest): Promise<NextResponse> {
  const parsed = await readJsonBody(request, bodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const { email, language } = parsed.data;
  after(async () => {
    try {
      await sendPasswordResetMail({ email, requestedLanguage: language });
    } catch (error: unknown) {
      // ⚠️ Χωρίς το email: προσωπικό δεδομένο, και ο λόγος της αποτυχίας δεν το χρειάζεται.
      logger.error('Το email επαναφοράς κωδικού απέτυχε', { error: getErrorMessage(error) });
    }
  });

  return NextResponse.json({ accepted: true } as const, { status: 202 });
}

export const POST = withSensitiveRateLimit(handler);
