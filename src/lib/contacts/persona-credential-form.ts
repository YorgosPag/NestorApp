/**
 * @fileoverview **Ο ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ ΕΠΑΓΓΕΛΜΑΤΟΣ ΣΤΗ ΦΟΡΜΑ ΤΗΣ ΕΠΑΦΗΣ** — ανάγνωση, εγγραφή, ενεργοποίηση persona
 * (ADR-950 §9 · ADR-121 · ADR-282).
 * @module lib/contacts/persona-credential-form
 * @related config/declared-credential-adoption.ts (αρχή → persona + πεδία) · config/isco-registry-authority.ts
 *   (επάγγελμα → αρχή) · lib/contacts/declared-credential-adoption-patch.ts (η ίδια πράξη πάνω στο αποθηκευμένο `personas[]`)
 *
 * 🔑 **Κανένας δεύτερος πίνακας**: «ποιο πεδίο ποιας persona» το λέει **μόνο** το `DECLARED_CREDENTIAL_ADOPTION`. Εδώ ζει
 *    ό,τι χρειάζεται η **φόρμα** (`activePersonas` + `personaData`), ώστε πίνακας εγγράφου, καρτέλα «Επαγγελματικά» και
 *    διακόπτης ιδιότητας να κάνουν **την ίδια** πράξη — όχι τρεις παραλλαγές της.
 * 🔑 **Εγγραφή αριθμού ⇒ η persona ενεργοποιείται** αν λείπει: αριθμός μητρώου χωρίς ιδιότητα δεν έχει πού να φανεί.
 * 🔑 Μόνο η **ενεργή** persona μετρά ως «τιμή της επαφής» (ίδιος κανόνας με το `declared-credential-comparison`).
 *
 * **Layering**: καθαρή — καμία I/O. (Το `createDefaultPersonaData` σφραγίζει `activatedAt`, που εδώ **πετιέται**.)
 */

import { DECLARED_CREDENTIAL_ADOPTION, type PersonaAdoptionTarget } from '@/config/declared-credential-adoption';
import { resolveRegistryAuthority } from '@/config/isco-registry-authority';
import { REGISTRY_AUTHORITIES, type RegistryAuthorityId } from '@/constants/professional-registries';
import type { CredentialValue } from '@/lib/contacts/declared-credential-comparison';
import { createDefaultPersonaData, type PersonaType } from '@/types/contacts/personas';
import type { ContactFormData } from '@/types/ContactFormTypes';

type PersonaFormFields = Record<string, string | number | null>;

/** Τα δύο πεδία ενός διαπιστευτηρίου: ο αριθμός και (όπου η αρχή έχει παραρτήματα) ο εκδότης. */
export type CredentialPart = 'number' | 'chapter';

/** Η persona + τα πεδία της για μια αρχή μητρώου — `null` όταν η αρχή δεν γράφει σε persona (άδεια · ΓΕΜΗ). */
export function personaAdoptionTargetOf(authority: RegistryAuthorityId): PersonaAdoptionTarget | null {
  const target = DECLARED_CREDENTIAL_ADOPTION[authority];
  return target !== null && target.kind === 'persona' ? target : null;
}

/** Όλοι οι προορισμοί persona, με τη σειρά του λεξιλογίου των αρχών — **παράγεται**, δεν απαριθμείται. */
export const PERSONA_ADOPTION_TARGETS: readonly PersonaAdoptionTarget[] = REGISTRY_AUTHORITIES
  .map(personaAdoptionTargetOf)
  .filter((target): target is PersonaAdoptionTarget => target !== null);

/** Τα κενά πεδία μιας persona σε μορφή φόρμας (χωρίς τα πεδία κύκλου ζωής — αυτά τα γράφει η αποθήκευση). */
function defaultPersonaFormFields(personaType: PersonaType): PersonaFormFields {
  const { personaType: _type, status: _status, activatedAt: _at, deactivatedAt: _off, notes: _notes, ...rest } =
    createDefaultPersonaData(personaType);
  const fields: PersonaFormFields = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === null || typeof value === 'string' || typeof value === 'number') fields[key] = value;
  }
  return fields;
}

/**
 * **Η ΜΙΑ ενεργοποίηση persona στη φόρμα**: μπαίνει στις ενεργές και αποκτά τα κενά πεδία της — ό,τι είχε ήδη, μένει.
 * Ιδεμποτική: ήδη ενεργή ⇒ οι ίδιες αναφορές.
 */
export function activatePersonaInForm(
  formData: ContactFormData,
  personaType: PersonaType,
): Pick<ContactFormData, 'activePersonas' | 'personaData'> {
  const active = formData.activePersonas ?? [];
  const personaData = formData.personaData ?? {};
  return {
    activePersonas: active.includes(personaType) ? active : [...active, personaType],
    personaData: personaData[personaType] ? personaData : { ...personaData, [personaType]: defaultPersonaFormFields(personaType) },
  };
}

function fieldIdOf(target: PersonaAdoptionTarget, part: CredentialPart): string | null {
  return part === 'number' ? target.numberField : target.chapterField;
}

function presentText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** Ό,τι γράφει το πεδίο της φόρμας **τώρα** — για το χειριστήριο (κενό κείμενο όταν δεν υπάρχει). */
export function formCredentialPart(formData: ContactFormData, target: PersonaAdoptionTarget, part: CredentialPart): string {
  const fieldId = fieldIdOf(target, part);
  if (fieldId === null) return '';
  const value = formData.personaData?.[target.persona]?.[fieldId];
  return value === null || value === undefined ? '' : String(value);
}

/** Το διαπιστευτήριο **που έχει** η επαφή — `null` όταν η persona δεν είναι ενεργή ή ο αριθμός είναι κενός. */
export function formCredentialOf(formData: ContactFormData, target: PersonaAdoptionTarget): CredentialValue | null {
  if (!(formData.activePersonas ?? []).includes(target.persona)) return null;
  const number = presentText(formCredentialPart(formData, target, 'number'));
  if (number === null) return null;
  return { number, chapter: presentText(formCredentialPart(formData, target, 'chapter')) };
}

/** Νέα `formData` με **ένα** πεδίο του διαπιστευτηρίου γραμμένο — και την persona ενεργή. */
export function writeFormCredentialPart(
  formData: ContactFormData,
  target: PersonaAdoptionTarget,
  part: CredentialPart,
  value: string,
): ContactFormData {
  const fieldId = fieldIdOf(target, part);
  if (fieldId === null) return formData;
  const activated = activatePersonaInForm(formData, target.persona);
  const fields = activated.personaData[target.persona] ?? {};
  return {
    ...formData,
    ...activated,
    personaData: { ...activated.personaData, [target.persona]: { ...fields, [fieldId]: value } },
  };
}

/** Νέα `formData` με ολόκληρο το διαπιστευτήριο (αριθμός + εκδότης όπου υπάρχει) — και την persona ενεργή. */
export function writeFormCredential(formData: ContactFormData, target: PersonaAdoptionTarget, value: CredentialValue): ContactFormData {
  const withNumber = writeFormCredentialPart(formData, target, 'number', value.number);
  return value.chapter === null ? withNumber : writeFormCredentialPart(withNumber, target, 'chapter', value.chapter);
}

/**
 * **Ποια μητρώα δείχνει η καρτέλα «Επαγγελματικά»**: το μητρώο του **επαγγέλματος** (ISCO → αρχή) και κάθε μητρώο
 * του οποίου η persona είναι ήδη ενεργή (π.χ. ήρθε από έγγραφο, ή επάγγελμα που ο πίνακας ISCO δεν λύνει — συμβολαιογράφος).
 */
export function visibleCredentialTargets(formData: ContactFormData): readonly PersonaAdoptionTarget[] {
  const verdict = resolveRegistryAuthority(formData.iscoCode);
  const ofProfession = verdict.kind === 'authority' ? personaAdoptionTargetOf(verdict.authority) : null;
  const active = formData.activePersonas ?? [];
  return PERSONA_ADOPTION_TARGETS.filter((target) => target === ofProfession || active.includes(target.persona));
}

/** Τα μητρώα που **δεν** φαίνονται ακόμη — οι επιλογές του «Προσθήκη μητρώου». */
export function addableCredentialTargets(formData: ContactFormData): readonly PersonaAdoptionTarget[] {
  const visible = visibleCredentialTargets(formData);
  return PERSONA_ADOPTION_TARGETS.filter((target) => !visible.includes(target));
}
