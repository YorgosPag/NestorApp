/**
 * @fileoverview **ΜΑΣΚΑ ΠΕΔΙΩΝ ΤΟΥ ΠΡΟΦΙΛ ΕΤΑΙΡΕΙΑΣ** — γράφεται μόνο ό,τι άλλαξε ο άνθρωπος
 *   (ADR-841 §7 Α23 Φ3.2 Γ3 · ADR-256 · ADR-440). Καθαρό SSoT — πελάτης **και** διακομιστής.
 * @module subapps/accounting/services/setup/company-profile-field-mask
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PUT /api/accounting/setup` έγραφε **ολόκληρο** το προφίλ. Μια οθόνη ανοιχτή πριν από την
 * «Υιοθέτηση επωνυμίας ΓΕΜΗ» ξανάγραφε **σιωπηλά την παλιά επωνυμία** με το πρώτο «Αποθήκευση».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΡΑΚΤΙΚΗ ΜΕΓΑΛΩΝ (επίσημες πηγές, 2026-09-15)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κανόνας | Πηγή |
 * |---|---|
 * | «κερδίζει ο τελευταίος» **ανά ιδιότητα**, όχι ανά έγγραφο | Figma multiplayer |
 * | γράφονται μόνο τα πεδία της μάσκας · χωρίς μάσκα = πλήρης αντικατάσταση (`*`) | Google AIP-134 |
 * | άγνωστο πεδίο στη μάσκα ⇒ `INVALID_ARGUMENT` | Google AIP-161 |
 * | «Any parameters not provided are left unchanged» — και όταν αλλάζει ο τύπος | Stripe Accounts API |
 * | νέα μορφή ⇒ τα πεδία της **παλιάς** μορφής σβήνονται (`oneof`) | Protocol Buffers |
 * | κανένα παράθυρο σύγκρουσης (θόρυβος) | ADR-256, 2026-04-13 |
 *
 * 🔑 **Εξυπνότερα από etag ολόκληρου εγγράφου**: ένα etag θα αρνιόταν την αποθήκευση τηλεφώνου
 * επειδή άλλαξε η επωνυμία. Εδώ δύο άσχετες αλλαγές **δεν συγκρούονται ποτέ**.
 *
 * ⚠️ **Εξάντληση από κατασκευή**: το {@link FIELD_SCOPE} είναι mapped type πάνω σε **κάθε** κλειδί
 * του `CompanySetupInput` — νέο πεδίο στον τύπο χωρίς γραμμή εδώ = σφάλμα τύπου, ποτέ σιωπηλή απώλεια.
 *
 * ⚠️ **Όχι `lib/audit/audit-diff`**: εκείνο εξομοιώνει `''`/`[]` με `null` για να μη θορυβεί το
 * ίχνος· η μάσκα οφείλει να βλέπει **ακριβώς** τι άλλαξε ⇒ `dequal` (MIT, ήδη εξάρτηση).
 */

import { dequal } from 'dequal';

import type {
  CompanyProfile,
  CompanyProfileField,
  CompanyProfileFieldMask,
  CompanySetupInput,
} from '../../types/company';
import type { EntityType } from '../../types/entity';

/**
 * - `common` — υπάρχει σε κάθε μορφή, γράφεται **μόνο** αν είναι στη μάσκα.
 * - `legal-form` — η τιμή του **εξαρτάται από τη μορφή** (ο διακομιστής την κανονικοποιεί ανά μορφή):
 *   γράφεται και όταν αλλάζει η μορφή.
 * - λίστα μορφών — υπάρχει **μόνο** σε αυτές (`oneof`): σβήνεται όταν η μορφή φύγει από τη λίστα.
 */
type FieldScope = 'common' | 'legal-form' | readonly EntityType[];

const FIELD_SCOPE: { readonly [K in CompanyProfileField]: FieldScope } = {
  entityType: 'legal-form',
  bookCategory: 'legal-form', // Γ' βιβλία υποχρεωτικά σε ΕΠΕ/ΑΕ
  gemiNumber: 'legal-form', // `null` σε ατομική/ΟΕ, κείμενο σε ΕΠΕ/ΑΕ
  businessName: 'common',
  profession: 'common',
  vatNumber: 'common',
  taxOffice: 'common',
  address: 'common',
  city: 'common',
  postalCode: 'common',
  phone: 'common',
  mobile: 'common',
  email: 'common',
  website: 'common',
  mainKad: 'common',
  secondaryKads: 'common',
  vatRegime: 'common',
  fiscalYearEnd: 'common',
  currency: 'common',
  invoiceSeries: 'common',
  efkaCategory: ['sole_proprietor'],
  partners: ['oe'],
  members: ['epe'],
  shareholders: ['ae'],
  shareCapital: ['epe', 'ae'],
};

/** Το κλειστό σύνολο — παράγεται από το {@link FIELD_SCOPE}, καμία δεύτερη απαρίθμηση. */
export const COMPANY_PROFILE_FIELDS: readonly CompanyProfileField[] = Object.freeze(
  Object.keys(FIELD_SCOPE) as CompanyProfileField[],
);

export function isCompanyProfileField(value: unknown): value is CompanyProfileField {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FIELD_SCOPE, value);
}

export type ProfileFieldMaskParse =
  | { readonly kind: 'full' }
  | { readonly kind: 'fields'; readonly fields: readonly CompanyProfileField[] }
  | { readonly kind: 'invalid'; readonly rejected: readonly string[] };

/**
 * Η μάσκα όπως ήρθε από το δίκτυο. Απούσα ⇒ `full` · οτιδήποτε άγνωστο ⇒ `invalid` (AIP-161:
 * ποτέ γραφή αυθαίρετου κλειδιού). Διπλότυπα συμπτύσσονται.
 */
export function parseProfileFieldMask(value: unknown): ProfileFieldMaskParse {
  if (value === undefined) return { kind: 'full' };
  if (!Array.isArray(value)) return { kind: 'invalid', rejected: [typeof value] };
  const rejected = value.filter((entry) => !isCompanyProfileField(entry)).map((entry) => String(entry));
  if (rejected.length > 0) return { kind: 'invalid', rejected };
  return { kind: 'fields', fields: [...new Set(value as CompanyProfileField[])] };
}

/** Χωρίς cast: τα interfaces δεν έχουν index signature, το `Object.entries` τα διαβάζει ως έχουν. */
function recordOf(value: CompanyProfile | CompanySetupInput | null): Readonly<Record<string, unknown>> {
  return value === null ? {} : Object.fromEntries(Object.entries(value));
}

/**
 * Τα πεδία κορυφής που διαφέρουν — βαθιά ισότητα. `undefined` ≡ `null`: ένα παλιό έγγραφο χωρίς
 * `mobile` και μια φόρμα με `mobile: null` λένε το ίδιο πράγμα.
 */
export function changedProfileFields(
  base: CompanyProfile | CompanySetupInput | null,
  next: CompanySetupInput,
): CompanyProfileField[] {
  const before = recordOf(base);
  const after = recordOf(next);
  return COMPANY_PROFILE_FIELDS.filter((field) => !dequal(before[field] ?? null, after[field] ?? null));
}

function belongsToForm(field: CompanyProfileField, form: EntityType): boolean {
  const scope = FIELD_SCOPE[field];
  return typeof scope === 'string' || scope.includes(form);
}

/** Κλειδί που ανήκει σε **άλλη** μορφή — τα κλειδιά εκτός προφίλ (`createdAt`, …) μένουν πάντα. */
function isForeignToForm(key: string, form: EntityType): boolean {
  return isCompanyProfileField(key) && !belongsToForm(key, form);
}

/** Η μάσκα, συν — σε αλλαγή μορφής — ό,τι κουβαλά η μορφή: `legal-form` και τα πεδία που **μόνο** η νέα έχει. */
function fieldsToWrite(
  mask: readonly CompanyProfileField[],
  from: EntityType,
  to: EntityType,
): ReadonlySet<CompanyProfileField> {
  if (from === to) return new Set(mask);
  const carried = COMPANY_PROFILE_FIELDS.filter(
    (field) => FIELD_SCOPE[field] === 'legal-form' || (belongsToForm(field, to) && !belongsToForm(field, from)),
  );
  return new Set([...mask, ...carried]);
}

/**
 * **Η συγχώνευση** — πάνω στο αποθηκευμένο, γράφονται μόνο τα πεδία της μάσκας.
 *
 * - Χωρίς αποθηκευμένο ή χωρίς μάσκα ⇒ ολόκληρο το `next` (πρώτη ρύθμιση · παλιός πελάτης).
 * - Η μορφή αλλάζει **μόνο** αν το `entityType` είναι στη μάσκα: μια οθόνη παλιάς μορφής δεν
 *   επαναφέρει ποτέ τη μορφή που άλλαξε αλλού.
 * - Πεδία της μάσκας που δεν ανήκουν στη μορφή του αποτελέσματος **αγνοούνται**· πεδία της παλιάς
 *   μορφής **σβήνονται** (`oneof`). `undefined` στο `next` δεν γράφεται ποτέ ως απουσία.
 */
export function mergeProfileFields(
  stored: CompanyProfile | null,
  next: CompanySetupInput,
  mask: CompanyProfileFieldMask,
): CompanySetupInput {
  if (stored === null || mask === undefined) return next;
  const form = mask.includes('entityType') ? next.entityType : stored.entityType;
  const incoming = recordOf(next);
  const merged = Object.fromEntries(
    Object.entries(recordOf(stored)).filter(([key]) => !isForeignToForm(key, form)),
  );
  for (const field of fieldsToWrite(mask, stored.entityType, form)) {
    if (belongsToForm(field, form) && incoming[field] !== undefined) merged[field] = incoming[field];
  }
  // ⚠️ Η μία μετατροπή τύπου: το σχήμα της ένωσης το εγγυάται η κατασκευή (μορφή + πεδία της μορφής).
  return merged as unknown as CompanySetupInput;
}
