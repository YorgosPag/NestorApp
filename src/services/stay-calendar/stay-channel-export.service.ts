/**
 * @fileoverview **Ο ΜΥΣΤΙΚΟΣ ΣΥΝΔΕΣΜΟΣ ΕΞΑΓΩΓΗΣ** — υπογραφή, επαλήθευση, και το `.ics`
 *   ενός καταλύματος ανά προορισμό.
 * @related ADR-835 §22 (Στάδιο Γ) · lib/tokens/signed-token.ts · lib/stay/stay-channel-export.ts ·
 *   app/api/stay-ical/[feed]/route.ts · config/environment-contract.ts
 * @module services/stay-calendar/stay-channel-export.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 HMAC ΠΑΝΩ ΣΤΟ ΥΠΑΡΧΟΝ SSoT — ΚΑΜΙΑ ΝΕΑ ΚΡΥΠΤΟΓΡΑΦΙΑ, ΚΑΝΕΝΑ ΜΗΤΡΩΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το token είναι `['stay-ical', 'v1', propertyId, scope, generation]` υπογεγραμμένο με
 * το `lib/tokens/signed-token.ts` (τέταρτος καταναλωτής). Δύο συνέπειες:
 *
 * 1. **Η ανάκληση είναι μία πράξη**: `exportGeneration + 1` στο έγγραφο καναλιών ⇒ **όλοι**
 *    οι παλιοί σύνδεσμοι πεθαίνουν μαζί. Κανένα μητρώο nonce, καμία σάρωση.
 * 2. **Η εμβέλεια είναι ΜΕΣΑ στην υπογραφή**: ο σύνδεσμος ενός καναλιού δεν γίνεται
 *    «όλα» αλλάζοντας ένα γράμμα στο URL — θα έσπαγε η υπογραφή (ίδιο μάθημα με το
 *    `scopeField` του ADR-849).
 *
 * ⚠️ **Ο έλεγχος υπογραφής προηγείται ΚΑΘΕ ανάγνωσης**: πλαστός σύνδεσμος απορρίπτεται
 * χωρίς **κανένα** αίτημα στη βάση, άρα δεν μπορεί να μας κοστίσει.
 *
 * ⚠️ **Χωρίς μυστικό ΔΕΝ πετά**: η οθόνη λέει «η εξαγωγή δεν είναι ρυθμισμένη» και ο
 * σύνδεσμος δεν προσφέρεται — ποτέ σπασμένος σύνδεσμος στα χέρια καναλιού (βαθμίδα
 * `feature` του `environment-contract.ts`).
 */

import 'server-only';
import { stayExportCalendar, type StayExportScope } from '@/lib/stay/stay-channel-export';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';
import { readConfiguredValue } from '@/lib/environment/environment-audit';
import type { StayCalendarEntry } from '@/types/stay-calendar';
import type { StayRules } from '@/types/stay-rules';

const logger = createModuleLogger('stay-channel-export');

/** Το μυστικό — **δικό του**, ποτέ κοινό (ίδια απόφαση με το ADR-848). */
export const STAY_ICAL_SECRET_ENV = 'STAY_ICAL_FEED_SECRET';

/** Ο σκοπός και η έκδοση του σχήματος, **μέσα** στην υπογραφή. */
const PURPOSE = 'stay-ical';
const SCHEMA_V1 = 'v1';
/** Η εμβέλεια «όλα» ως πεδίο — τα feeds χρησιμοποιούν το `schf_*` τους. */
export const STAY_EXPORT_SCOPE_ALL = 'all';

/** Είναι ρυθμισμένη η εξαγωγή σε αυτόν τον διακομιστή; */
export function stayExportConfigured(): boolean {
  return readConfiguredValue(process.env, STAY_ICAL_SECRET_ENV) !== null;
}

/**
 * **Ο σύνδεσμος ενός προορισμού**, ή `null` όταν λείπει το μυστικό.
 *
 * @param scope — `'all'` για τον γενικό σύνδεσμο, ή το `schf_*` της πηγής που **δεν**
 *   πρέπει να δει τα δικά της γεγονότα (ασπίδα echo, §22).
 */
export function stayExportToken(propertyId: string, scope: string, generation: number): string | null {
  if (!stayExportConfigured()) return null;
  try {
    const secret = requireTokenSecret(STAY_ICAL_SECRET_ENV);
    return encodeSignedToken(secret, [PURPOSE, SCHEMA_V1, propertyId, scope, String(generation)]);
  } catch (cause) {
    logger.error('Ο σύνδεσμος εξαγωγής ημερολογίου δεν υπογράφηκε', {
      data: { propertyId, scope },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/** Τι λέει ένας σύνδεσμος — ή γιατί δεν τον δεχτήκαμε. */
export type StayExportClaim =
  | { readonly ok: true; readonly propertyId: string; readonly scope: StayExportScope; readonly generation: number }
  | { readonly ok: false; readonly reason: 'invalid' | 'server-config' };

function scopeOf(field: string): StayExportScope {
  return field === STAY_EXPORT_SCOPE_ALL ? { kind: 'all' } : { kind: 'feed', feedId: field };
}

/**
 * **Σύνδεσμος → ισχυρισμός**, χωρίς καμία επαφή με βάση.
 *
 * 🔴 Η **γενιά** επιστρέφεται αλλά **δεν** κρίνεται εδώ: η σύγκριση με το τρέχον
 * `exportGeneration` γίνεται όταν διαβαστεί το έγγραφο — δηλαδή η ανάκληση είναι
 * **κατάσταση**, όχι ημερομηνία λήξης μέσα στο token.
 */
export function stayExportClaimOf(token: string): StayExportClaim {
  if (!stayExportConfigured()) return { ok: false, reason: 'server-config' };
  const verdict = decodeSignedToken(requireTokenSecret(STAY_ICAL_SECRET_ENV), token, 5);
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason === 'server-config' ? 'server-config' : 'invalid' };
  }
  const [purpose, schema, propertyId, scope, generation] = verdict.fields;
  if (purpose !== PURPOSE || schema !== SCHEMA_V1) return { ok: false, reason: 'invalid' };
  if (propertyId === undefined || scope === undefined || generation === undefined) {
    return { ok: false, reason: 'invalid' };
  }
  if (!/^\d+$/.test(generation)) return { ok: false, reason: 'invalid' };
  return { ok: true, propertyId, scope: scopeOf(scope), generation: Number(generation) };
}

/**
 * **Το σώμα του feed.** Καθαρή σύνθεση — ο καλών (διαδρομή) έχει ήδη αποδείξει υπογραφή,
 * γενιά και ότι το ακίνητο είναι κατάλυμα.
 *
 * @param instant — η στιγμή της λήψης: κρίνει ποια αιτήματα **ζουν ακόμη** (Στάδιο Δ, §23.2).
 *   ⚠️ Το σώμα μένει ντετερμινιστικό **ανάμεσα** σε λήξεις: η στιγμή δεν γράφεται μέσα του
 *   (`DTSTAMP` = ώρα της εγγραφής, §22.13), άρα το `ETag` αλλάζει **μόνο** όταν αλλάζει κάτι.
 */
export function stayExportBody(
  entries: readonly StayCalendarEntry[],
  rules: StayRules,
  scope: StayExportScope,
  title: string,
  instant: string,
): string {
  return stayExportCalendar(entries, rules, scope, title, instant);
}
