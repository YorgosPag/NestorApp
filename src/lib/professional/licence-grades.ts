/**
 * @fileoverview **ΟΙ ΤΑΞΕΙΣ ΜΙΑΣ ΑΔΕΙΑΣ** — σχηματισμός, ανάγνωση, σύγκριση (ADR-915 §40.7).
 * @related config/professional-licences.ts (`gradeScheme` — η ρίζα) · lib/agency/showcase-licence.ts (ο ΕΝΑΣ
 *   σχηματισμός/αναγνώστης αδειών, που τις ζητά) · lib/contacts/contact-licences.ts (προέλευση: ίδια τιμή = ίδιες τάξεις)
 * @module lib/professional/licence-grades
 *
 * 🔑 **Μόνο οι κατηγορίες που ΕΧΕΙ η άδεια** (`gradeScheme.scopes`): τάξη «θέρμανσης» σε άδεια ηλεκτρολόγου δεν σημαίνει
 *    τίποτα — ο σχηματισμός την αρνείται ονομαστικά, ο αναγνώστης την παραλείπει.
 * 🔑 **Κενό = απόν**: καμία δηλωμένη τάξη ⇒ `null` και **κανένα** πεδίο στον δίσκο. Δύο ορθογραφίες του «τίποτα»
 *    (`{}` και απουσία) θα έκαναν το ίχνος να βλέπει αλλαγή εκεί που δεν έγινε καμία.
 * Καθαρό leaf — καμία εισαγωγή SDK.
 */

import {
  LICENCE_GRADE_SCOPES,
  PROFESSIONAL_LICENCE_SPECS,
  isLicenceGrade,
  type LicenceGrade,
  type LicenceGradeScope,
  type LicenceGrades,
  type ProfessionalLicence,
} from '@/config/professional-licences';

/** Οι κατηγορίες της άδειας, με τη σειρά της ρίζας — κενό για άδεια χωρίς τάξεις. */
export function licenceGradeScopes(licence: ProfessionalLicence): readonly LicenceGradeScope[] {
  return PROFESSIONAL_LICENCE_SPECS[licence].gradeScheme?.scopes ?? [];
}

/** Από ζεύγη (κατηγορία, τάξη) σε τάξεις — με τη σειρά της ρίζας· κανένα ζεύγος ⇒ `null`. */
function gradesOf(entries: readonly (readonly [LicenceGradeScope, LicenceGrade])[]): LicenceGrades | null {
  if (entries.length === 0) return null;
  const grades: Partial<Record<LicenceGradeScope, LicenceGrade>> = {};
  for (const [scope, grade] of entries) grades[scope] = grade;
  return grades;
}

/**
 * Από τη δήλωση (σύρμα · φόρμα) στις τάξεις. Κατηγορία που η άδεια **δεν** έχει, ή τάξη εκτός λεξιλογίου ⇒ `null`
 * (ο καλών αρνείται ονομαστικά — ποτέ σιωπηλή παράλειψη αυτού που δήλωσε ο άνθρωπος).
 */
export function formLicenceGrades(
  licence: ProfessionalLicence,
  declared: Readonly<Record<string, unknown>> | undefined,
): { readonly grades: LicenceGrades | null } | null {
  if (declared === undefined) return { grades: null };
  const scopes = licenceGradeScopes(licence);
  const entries: [LicenceGradeScope, LicenceGrade][] = [];
  for (const [scope, grade] of Object.entries(declared)) {
    if (grade === undefined) continue;
    const known = scopes.find((candidate) => candidate === scope);
    if (known === undefined || !isLicenceGrade(grade)) return null;
    entries.push([known, grade]);
  }
  entries.sort(([a], [b]) => scopes.indexOf(a) - scopes.indexOf(b));
  return { grades: gradesOf(entries) };
}

/** Οι τάξεις ενός αποθηκευμένου εγγράφου — ό,τι δεν περνά τον φρουρό παραλείπεται (σημαίνει «δεν δηλώθηκε», όχι «Όχι»). */
export function readLicenceGrades(licence: ProfessionalLicence, raw: unknown): LicenceGrades | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const entries = licenceGradeScopes(licence).flatMap((scope): (readonly [LicenceGradeScope, LicenceGrade])[] => {
    const grade = row[scope];
    return isLicenceGrade(grade) ? [[scope, grade]] : [];
  });
  return gradesOf(entries);
}

/** Ίδιες τάξεις; Η απουσία ισούται με την απουσία· η σειρά των κλειδιών δεν μετρά. */
export function sameLicenceGrades(a: LicenceGrades | undefined, b: LicenceGrades | undefined): boolean {
  return LICENCE_GRADE_SCOPES.every((scope) => a?.[scope] === b?.[scope]);
}

/** Το πεδίο `grades` μόνο όταν υπάρχει — ποτέ `grades: undefined` (Firestore) ούτε `{}` (ίχνος). */
export function gradesField(grades: LicenceGrades | null): { readonly grades?: LicenceGrades } {
  return grades === null ? {} : { grades };
}
