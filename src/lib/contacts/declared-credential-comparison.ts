/**
 * @fileoverview **ΔΗΛΩΣΗ ΤΟΥ ΙΔΙΟΥ ↔ ΤΙΜΗ ΣΤΗΝ ΕΠΑΦΗ** — η σύγκριση που δείχνει το γραφείο και που ο server ξαναϋπολογίζει
 * πριν γράψει (ADR-915 §40.6).
 * @related config/declared-credential-adoption.ts (πού πάει κάθε αρχή) · lib/contacts/contact-licences.ts (οι άδειες) ·
 *   lib/contacts/declared-credential-adoption-patch.ts (η εγγραφή)
 * @module lib/contacts/declared-credential-comparison
 *
 * 🔑 **«Διαφέρει» ΠΑΡΑΓΕΤΑΙ, δεν αποθηκεύεται** (Salesforce Data.com Clean: σύγκριση δίπλα-δίπλα, ποτέ αυτόματη
 *    αντικατάσταση γεμάτου πεδίου). Η ίδια συνάρτηση τρέχει στον πελάτη (τι δείχνω) και στον server (CAS).
 * 🔑 Persona: μόνο η **ενεργή** μετρά (`findActivePersona`) — ανενεργή persona δεν είναι «τιμή στην επαφή».
 * Καθαρό leaf — καμία εισαγωγή SDK.
 */

import { DECLARED_CREDENTIAL_ADOPTION, type AdoptionTarget, type PersonaAdoptionTarget } from '@/config/declared-credential-adoption';
import { readContactLicences } from '@/lib/contacts/contact-licences';
import type { ContactDeclaredCredential } from '@/types/contact-professional-link';
import {
  findActivePersona,
  type AccountantPersona,
  type EngineerPersona,
  type LawyerPersona,
  type NotaryPersona,
  type PersonaData,
} from '@/types/contacts/personas';

/** Αριθμός + (όπου η αρχή έχει παραρτήματα) εκδότης — η τιμή που συγκρίνεται. */
export interface CredentialValue {
  readonly number: string;
  readonly chapter: string | null;
}

/** Ό,τι χρειάζεται η σύγκριση από την επαφή — τα ωμά πεδία, όπως έρχονται από τον δίσκο ή τη φόρμα. */
export interface ComparableContact {
  readonly licences?: unknown;
  readonly personas?: readonly PersonaData[];
}

export const CREDENTIAL_COMPARISON_STATES = ['absent', 'same', 'different', 'not-adoptable'] as const;
export type CredentialComparisonState = (typeof CREDENTIAL_COMPARISON_STATES)[number];

export type CredentialComparison =
  | { readonly state: 'not-adoptable' }
  | { readonly state: 'absent'; readonly target: AdoptionTarget; readonly current: null }
  | { readonly state: 'same' | 'different'; readonly target: AdoptionTarget; readonly current: CredentialValue };

/** Κενά στην άκρη και διπλά κενά στη μέση δεν κάνουν άλλη τιμή. */
function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function valueOf(number: string | null | undefined, chapter: string | null | undefined): CredentialValue | null {
  if (typeof number !== 'string' || normalized(number) === '') return null;
  const ch = typeof chapter === 'string' && normalized(chapter) !== '' ? normalized(chapter) : null;
  return { number: normalized(number), chapter: ch };
}

/** Ίδιος αριθμός και ίδιος εκδότης (χωρίς διάκριση πεζών/κεφαλαίων στον εκδότη — «ΠΕ Θεσσαλονίκης» ≡ «πε θεσσαλονίκης»). */
export function sameCredentialValue(a: CredentialValue | null, b: CredentialValue | null): boolean {
  if (a === null || b === null) return a === b;
  const chapterOf = (v: CredentialValue) => (v.chapter === null ? null : v.chapter.toLocaleLowerCase('el'));
  return a.number === b.number && chapterOf(a) === chapterOf(b);
}

/** Η τιμή της δήλωσης, κανονικοποιημένη ώστε να συγκρίνεται με ό,τι έχει η επαφή. */
export function declaredValueOf(declared: ContactDeclaredCredential): CredentialValue {
  return valueOf(declared.number, declared.chapter) ?? { number: '', chapter: null };
}

function personaValueOf(target: PersonaAdoptionTarget, personas: readonly PersonaData[]): CredentialValue | null {
  const list = [...personas];
  switch (target.persona) {
    case 'engineer':
      return valueOf(findActivePersona<EngineerPersona>(list, 'engineer')?.teeRegistryNumber, null);
    case 'accountant':
      return valueOf(findActivePersona<AccountantPersona>(list, 'accountant')?.oeeNumber, null);
    case 'lawyer': {
      const lawyer = findActivePersona<LawyerPersona>(list, 'lawyer');
      return valueOf(lawyer?.barAssociationNumber, lawyer?.barAssociation);
    }
    case 'notary': {
      const notary = findActivePersona<NotaryPersona>(list, 'notary');
      return valueOf(notary?.notaryRegistryNumber, notary?.notaryDistrict);
    }
  }
}

/** Η τιμή που **έχει** η επαφή στον προορισμό της υιοθέτησης — `null` αν δεν έχει. */
export function currentValueOf(target: AdoptionTarget, contact: ComparableContact): CredentialValue | null {
  if (target.kind === 'persona') return personaValueOf(target, contact.personas ?? []);
  const held = readContactLicences(contact.licences).find((licence) => licence.licence === target.licence);
  if (!held) return null;
  const { registration } = held.attestation;
  return valueOf(registration.number, registration.authorityKind === 'chapter' ? registration.chapter : null);
}

/** Η δήλωση απέναντι στην επαφή: `absent` · `same` · `different` · `not-adoptable` (π.χ. ΓΕΜΗ). */
export function compareDeclaredCredential(declared: ContactDeclaredCredential, contact: ComparableContact): CredentialComparison {
  const target = DECLARED_CREDENTIAL_ADOPTION[declared.authority];
  if (target === null) return { state: 'not-adoptable' };
  const current = currentValueOf(target, contact);
  if (current === null) return { state: 'absent', target, current };
  return { state: sameCredentialValue(current, declaredValueOf(declared)) ? 'same' : 'different', target, current };
}
