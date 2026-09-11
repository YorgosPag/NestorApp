/**
 * @fileoverview **ΕΛΕΓΧΟΣ ΚΑΙ ΕΦΑΡΜΟΓΗ ΤΗΣ ΡΥΘΜΙΣΗΣ FIREBASE AUTH** — η σύνθεση (ADR-851).
 * @module server/firebase-auth-config/auth-config-audit
 *
 * Δύο καταναλωτές, **ίδια** απάντηση:
 * - `scripts/firebase-auth/auth-config.ts` — ο άνθρωπος (`--check` · `--apply`)·
 * - `lib/cron/jobs/firebase-auth-config-drift.job.ts` — η ημερήσια επιτήρηση (ADR-740):
 *   μια χειροκίνητη αλλαγή στην κονσόλα **δεν** μένει αόρατη μέχρι να σπάσει κάτι.
 *
 * 🔒 **Η εφαρμογή απαιτεί τον αριθμό αποκλίσεων που είδε ο άνθρωπος** (πρότυπο του
 * `notifications:destination-drift`): αν η κονσόλα άλλαξε ανάμεσα στο `--check` και στο
 * `--apply`, **αρνείται** — γράφεται ακριβώς ό,τι εγκρίθηκε, ποτέ κάτι νεότερο.
 */

import 'server-only';

import { publicOrigin } from '@/lib/http/public-origin';
import { buildFirebaseAuthTemplate, type FirebaseAuthTemplate } from '@/services/email-templates/auth-action-email';

import {
  JUDGED_TEMPLATE_KINDS,
  NOT_JUDGED,
  buildDesiredAuthConfig,
  diffAuthConfig,
  partitionDrifts,
  patchForDrifts,
  type AuthConfigDrift,
  type JudgedTemplateKind,
} from './auth-config-state';
import { fetchLiveAuthConfig, patchAuthConfig } from './identity-toolkit-config';

export type AuthConfigAudit =
  | { readonly kind: 'refused'; readonly reason: 'no-public-origin' }
  | {
      readonly kind: 'audited';
      readonly projectId: string;
      readonly drifts: readonly AuthConfigDrift[];
      readonly notJudged: readonly string[];
    };

/**
 * Τα πρότυπα που **κρίνονται** — χτισμένα από το **ίδιο** λεξιλόγιο με τα δικά μας email.
 * Εξάγεται για το `--export-templates`: αυτό επικολλά ο άνθρωπος στην κονσόλα.
 */
export function declaredFirebaseTemplates(): Record<JudgedTemplateKind, FirebaseAuthTemplate> {
  return Object.fromEntries(
    JUDGED_TEMPLATE_KINDS.map((kind) => [kind, buildFirebaseAuthTemplate(kind)]),
  ) as Record<JudgedTemplateKind, FirebaseAuthTemplate>;
}

function declaredTemplates(): Record<JudgedTemplateKind, FirebaseAuthTemplate> {
  return declaredFirebaseTemplates();
}

async function desiredAndLive() {
  const { projectId, live } = await fetchLiveAuthConfig();
  const outcome = buildDesiredAuthConfig({ publicOrigin: publicOrigin(), projectId, templates: declaredTemplates() });
  return { projectId, live, outcome };
}

/** **Συμφωνεί η κονσόλα με το git;** — μόνο ανάγνωση. */
export async function auditFirebaseAuthConfig(): Promise<AuthConfigAudit> {
  const { projectId, live, outcome } = await desiredAndLive();
  if (outcome.kind === 'refused') return outcome;
  return { kind: 'audited', projectId, drifts: diffAuthConfig(outcome.desired, live), notJudged: NOT_JUDGED };
}

export type AuthConfigApplyOutcome =
  | { readonly kind: 'refused'; readonly reason: 'no-public-origin' }
  /** Η κονσόλα άλλαξε από τον έλεγχο — **τίποτα** δεν γράφτηκε. */
  | { readonly kind: 'stale'; readonly expected: number; readonly found: number }
  | {
      readonly kind: 'applied';
      readonly paths: readonly string[];
      /** Αποκλίσεις που **μόνο** άνθρωπος διορθώνει στην κονσόλα — λέγονται, δεν σιωπάται. */
      readonly consoleOnly: readonly AuthConfigDrift[];
    };

/**
 * **Γράψε ό,τι απέκλινε και ΜΠΟΡΕΙ να γραφτεί — ΚΑΙ ΜΟΝΟ αν αποκλίνει όσο είδε ο άνθρωπος.**
 *
 * @param expectedApplicable ο αριθμός **εγγράψιμων** αποκλίσεων του `--check`.
 */
export async function applyFirebaseAuthConfig(expectedApplicable: number): Promise<AuthConfigApplyOutcome> {
  const { live, outcome } = await desiredAndLive();
  if (outcome.kind === 'refused') return outcome;

  const { applicable, consoleOnly } = partitionDrifts(diffAuthConfig(outcome.desired, live));
  if (applicable.length !== expectedApplicable) {
    return { kind: 'stale', expected: expectedApplicable, found: applicable.length };
  }
  if (applicable.length > 0) {
    const { body, updateMask } = patchForDrifts(outcome.desired, applicable);
    await patchAuthConfig(body, updateMask);
  }
  return { kind: 'applied', paths: applicable.map((drift) => drift.path), consoleOnly };
}
