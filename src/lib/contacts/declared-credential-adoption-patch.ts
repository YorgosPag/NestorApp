/**
 * @fileoverview **Η ΕΓΓΡΑΦΗ ΤΗΣ ΥΙΟΘΕΤΗΣΗΣ** — από τη δήλωση του ίδιου στα πεδία της επαφής (ADR-915 §40.6).
 * @related lib/contacts/declared-credential-comparison.ts (τι συγκρίνεται) · app/api/contacts/[contactId]/adopt-declared-credential
 * @module lib/contacts/declared-credential-adoption-patch
 *
 * 🔑 **Κανένας δεύτερος validator**: η άδεια σχηματίζεται από το `formShowcaseLicences` (ίδιος κανόνας αριθμού/εκδότη με
 *    τη φόρμα)· η persona από το `createDefaultPersonaData` όταν λείπει.
 * 🔑 **Προέλευση**: άδεια ⇒ `self-declared` + ώρα + συμμετοχή. Persona: το ίχνος (CDC) κρατά ποιος και πότε.
 * 🔑 Persona που υπάρχει **ανενεργή** ενεργοποιείται — ποτέ δεύτερη persona του ίδιου τύπου.
 * Καθαρό leaf — καμία εισαγωγή SDK.
 */

import type { AdoptionTarget, PersonaAdoptionTarget } from '@/config/declared-credential-adoption';
import { formShowcaseLicences } from '@/lib/agency/showcase-licence';
import { readContactLicences, sortByVocabulary } from '@/lib/contacts/contact-licences';
import type { CredentialValue } from '@/lib/contacts/declared-credential-comparison';
import type { ContactLicence } from '@/types/contacts/contact-licences';
import {
  createDefaultPersonaData,
  isAccountantPersona,
  isEngineerPersona,
  isLawyerPersona,
  isNotaryPersona,
  type PersonaData,
} from '@/types/contacts/personas';

export type AdoptionPatch =
  | { readonly field: 'licences'; readonly licences: readonly ContactLicence[] }
  | { readonly field: 'personas'; readonly personas: readonly PersonaData[] }
  /** Η δήλωση δεν σχηματίζει έγκυρη άδεια (π.χ. λείπει ο εκδότης) — δεν γράφεται τίποτα. */
  | { readonly field: null; readonly reason: 'invalid-declaration' };

export interface AdoptionSource {
  readonly value: CredentialValue;
  readonly engagementId: string;
  readonly nowIso: string;
}

function licencePatch(target: Extract<AdoptionTarget, { kind: 'licence' }>, rawLicences: unknown, source: AdoptionSource): AdoptionPatch {
  const formed = formShowcaseLicences([
    { licence: target.licence, registrationNumber: source.value.number, registrationChapter: source.value.chapter ?? '' },
  ]);
  if ('reason' in formed || formed.licences[0] === undefined) return { field: null, reason: 'invalid-declaration' };
  const adopted: ContactLicence = {
    ...formed.licences[0],
    provenance: { source: 'self-declared', recordedAt: source.nowIso, engagementId: source.engagementId },
  };
  const others = readContactLicences(rawLicences).filter((held) => held.licence !== target.licence);
  return { field: 'licences', licences: sortByVocabulary([...others, adopted]) };
}

/** Τα πεδία μητρώου στη persona — ο τύπος της persona κρίνεται από τον φρουρό, ποτέ από cast. */
function withCredential(persona: PersonaData, target: PersonaAdoptionTarget, value: CredentialValue): PersonaData {
  if (target.persona === 'engineer' && isEngineerPersona(persona)) return { ...persona, teeRegistryNumber: value.number };
  if (target.persona === 'accountant' && isAccountantPersona(persona)) return { ...persona, oeeNumber: value.number };
  if (target.persona === 'lawyer' && isLawyerPersona(persona)) {
    return { ...persona, barAssociationNumber: value.number, barAssociation: value.chapter };
  }
  if (target.persona === 'notary' && isNotaryPersona(persona)) {
    return { ...persona, notaryRegistryNumber: value.number, notaryDistrict: value.chapter };
  }
  return persona;
}

function personaPatch(target: PersonaAdoptionTarget, personas: readonly PersonaData[], source: AdoptionSource): AdoptionPatch {
  const index = personas.findIndex((persona) => persona.personaType === target.persona);
  const existing = index >= 0 ? personas[index] : undefined;
  const base = existing ?? createDefaultPersonaData(target.persona);
  const active: PersonaData = base.status === 'active' ? base : { ...base, status: 'active', activatedAt: source.nowIso, deactivatedAt: null };
  const next = withCredential(active, target, source.value);
  return {
    field: 'personas',
    personas: existing === undefined ? [...personas, next] : personas.map((persona, i) => (i === index ? next : persona)),
  };
}

/** Από τη δήλωση στο πεδίο της επαφής που αλλάζει — **ένα** πεδίο, ολόκληρο (λίστα αδειών ή λίστα persona). */
export function adoptionPatchOf(
  target: AdoptionTarget,
  contact: { readonly licences?: unknown; readonly personas?: readonly PersonaData[] },
  source: AdoptionSource,
): AdoptionPatch {
  return target.kind === 'licence'
    ? licencePatch(target, contact.licences, source)
    : personaPatch(target, contact.personas ?? [], source);
}
