import { createModuleLogger } from '@/lib/telemetry';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { mapFormDataToContact } from '@/utils/contactForm/modular/orchestrator';
import {
  outcomeOrThrow,
  type GuardResult,
  type SettledGuardOutcome,
} from '@/hooks/impact-guard/guard-result';

const logger = createModuleLogger('ExecuteGuardedContactUpdate');

interface ExecuteGuardedContactUpdateParams {
  readonly formData: ContactFormData;
  readonly previewBeforeUpdate: (
    formData: ContactFormData,
    contactData: Record<string, unknown>,
    action: () => Promise<void>,
  ) => Promise<GuardResult>;
  readonly action: () => Promise<void>;
  readonly logScope: string;
}

/**
 * Φυλαγμένη ενημέρωση επαφής ⇒ **ονομασμένη** έκβαση, αφού τελειώσει (ADR-777 §8.69.13).
 *
 * `failed` ⇒ ρίχνει το αρχικό σφάλμα στο `catch` του καλούντα (ίδια συμπεριφορά με πριν στο
 * `allow`, και πλέον **και** μετά από επιβεβαίωση `warn`, όπου χανόταν).
 *
 * 🗑️ Αφαιρέθηκε το `blockedUnsafeClear`: δεν γινόταν **ποτέ** `true` (μετρημένο με grep —
 * ο μόνος παραγωγός επέστρεφε πάντα `false`), άρα ο κλάδος του ήταν νεκρός.
 */
export async function executeGuardedContactUpdate({
  formData,
  previewBeforeUpdate,
  action,
  logScope,
}: ExecuteGuardedContactUpdateParams): Promise<SettledGuardOutcome> {
  const mappingResult = mapFormDataToContact(formData);
  if (mappingResult.warnings.length > 0) {
    logger.warn(`${logScope}: Mapping warnings`, { warnings: mappingResult.warnings });
  }

  return outcomeOrThrow(await previewBeforeUpdate(formData, mappingResult.contactData, action));
}
