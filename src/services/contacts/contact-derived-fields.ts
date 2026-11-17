/**
 * @fileoverview **ΤΑ ΠΑΡΑΓΩΓΑ ΠΕΔΙΑ ΤΗΣ ΕΠΑΦΗΣ** στον πελατικό γραφέα — `personaTypes` + `emailKeys`, ένα σημείο.
 * @module services/contacts/contact-derived-fields
 * @related ADR-268 Q88 (`personaTypes`) · ADR-944 (`emailKeys`) · `lib/contacts/contact-email-keys` (το SSoT)
 *
 * Εξήχθη από το `contacts.service.ts` (όριο 500 γραμμών): create και update είχαν **δίδυμο** μπλοκ `personaTypes`.
 *
 * 🔑 **Update = μερικό**: παράγωγο γράφεται **μόνο** όταν το φορτίο αγγίζει την πηγή του. Ένα update χωρίς `emails`
 *    δεν ξέρει τα email της επαφής — αν έγραφε `emailKeys: []` θα έσβηνε σιωπηλά τα κλειδιά.
 * ⚠️ Ο πελατικός update **αφαιρεί** το επίπεδο `email` (`LEGACY_FIELDS`) ⇒ τα κλειδιά παράγονται από το `emails[]`.
 *    Επαφή μόνο με παλαιό επίπεδο `email` καλύπτεται από τη συμπλήρωση (`scripts/backfill-contact-email-keys.ts`).
 */

import { deleteField } from 'firebase/firestore';

import { CONTACT_EMAIL_KEYS_FIELD, contactEmailKeys } from '@/lib/contacts/contact-email-keys';

interface PersonaEntry {
  readonly personaType: string;
  readonly status: string;
}

function isPersonaEntry(value: unknown): value is PersonaEntry {
  return typeof value === 'object' && value !== null
    && 'personaType' in value && typeof value.personaType === 'string'
    && 'status' in value && typeof value.status === 'string';
}

/** ADR-268 Q88 — τα ενεργά είδη persona, όταν το φορτίο φέρει `personas[]`. */
function applyPersonaTypes(record: Record<string, unknown>): void {
  if (!Array.isArray(record.personas)) return;
  record.personaTypes = record.personas.filter(isPersonaEntry).filter((p) => p.status === 'active').map((p) => p.personaType);
}

/** Νέα επαφή: τα κλειδιά από **όλη** την πηγή (`emails[]` + επίπεδο `email`) — πάντα γραμμένο, έστω κενό. */
export function applyDerivedFieldsOnCreate(record: Record<string, unknown>): void {
  applyPersonaTypes(record);
  record[CONTACT_EMAIL_KEYS_FIELD] = contactEmailKeys(record.emails, record.email);
}

/**
 * Ενημέρωση: `emails` πίνακας ⇒ νέα κλειδιά · `emails` ως sentinel διαγραφής (ο καθαριστής μετατρέπει το `[]` σε
 * `deleteField()`) ⇒ διαγραφή και των κλειδιών · καμία αναφορά σε `emails` ⇒ **άθικτα**.
 */
export function applyDerivedFieldsOnUpdate(record: Record<string, unknown>): void {
  applyPersonaTypes(record);
  // `undefined` = «δεν το άγγιξε» (το `deepCleanUndefined` θα το αφαιρέσει) — ποτέ διαγραφή κλειδιών.
  if (record.emails === undefined) return;
  record[CONTACT_EMAIL_KEYS_FIELD] = Array.isArray(record.emails) ? contactEmailKeys(record.emails) : deleteField();
}
