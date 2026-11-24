/** ADR-950 §9 — ο αρ. μητρώου επαγγέλματος στη φόρμα: προορισμός από την αρχή, ενεργοποίηση persona, ορατά μητρώα. */

import {
  PERSONA_ADOPTION_TARGETS,
  activatePersonaInForm,
  addableCredentialTargets,
  formCredentialOf,
  personaAdoptionTargetOf,
  visibleCredentialTargets,
  writeFormCredential,
  writeFormCredentialPart,
} from '@/lib/contacts/persona-credential-form';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';

const EMPTY: ContactFormData = { ...initialFormData, firstName: 'Γεώργιος', lastName: 'Παγώνης' };

function targetOf(authority: Parameters<typeof personaAdoptionTargetOf>[0]) {
  const target = personaAdoptionTargetOf(authority);
  if (target === null) throw new Error(`no persona target for ${authority}`);
  return target;
}

const personasOf = (formData: ContactFormData) => visibleCredentialTargets(formData).map((target) => target.persona);

describe('προορισμός ανά αρχή μητρώου', () => {
  it('ΤΕΕ · ΟΕΕ · Δικηγορικός · Συμβολαιογραφικός γράφουν σε persona· άδεια και ΓΕΜΗ όχι', () => {
    expect(PERSONA_ADOPTION_TARGETS.map((target) => target.persona).sort()).toEqual(['accountant', 'engineer', 'lawyer', 'notary']);
    expect(personaAdoptionTargetOf('gemi')).toBeNull();
    expect(personaAdoptionTargetOf('ypen')).toBeNull();
  });
});

describe('ενεργοποίηση persona στη φόρμα', () => {
  it('μπαίνει στις ενεργές με τα κενά πεδία της — χωρίς πεδία κύκλου ζωής', () => {
    const { activePersonas, personaData } = activatePersonaInForm(EMPTY, 'lawyer');
    expect(activePersonas).toEqual(['lawyer']);
    expect(personaData.lawyer).toEqual({ barAssociationNumber: null, barAssociation: null });
  });

  it('ιδεμποτική: ήδη ενεργή ⇒ οι ίδιες αναφορές, τα δεδομένα της άθικτα', () => {
    const active: ContactFormData = { ...EMPTY, activePersonas: ['engineer'], personaData: { engineer: { teeRegistryNumber: '1' } } };
    const again = activatePersonaInForm(active, 'engineer');
    expect(again.activePersonas).toBe(active.activePersonas);
    expect(again.personaData).toBe(active.personaData);
  });
});

describe('εγγραφή και ανάγνωση διαπιστευτηρίου', () => {
  it('η εγγραφή αριθμού ενεργοποιεί την persona και δεν αλλάζει την αρχική φόρμα', () => {
    const next = writeFormCredential(EMPTY, targetOf('tee'), { number: '74693', chapter: null });
    expect(formCredentialOf(next, targetOf('tee'))).toEqual({ number: '74693', chapter: null });
    expect(next.activePersonas).toEqual(['engineer']);
    expect(EMPTY.activePersonas).toEqual([]);
  });

  it('αρχή με παραρτήματα: αριθμός και εκδότης', () => {
    const next = writeFormCredential(EMPTY, targetOf('notary-association'), { number: '312', chapter: 'Εφετείου Θεσσαλονίκης' });
    expect(next.personaData.notary).toMatchObject({ notaryRegistryNumber: '312', notaryDistrict: 'Εφετείου Θεσσαλονίκης' });
  });

  it('αρχή χωρίς παραρτήματα δεν έχει πεδίο εκδότη — η εγγραφή του δεν κάνει τίποτα', () => {
    expect(writeFormCredentialPart(EMPTY, targetOf('tee'), 'chapter', 'Τμήμα')).toBe(EMPTY);
  });

  it('ανενεργή persona ή κενός αριθμός ⇒ η επαφή «δεν έχει» διαπιστευτήριο', () => {
    const inactive: ContactFormData = { ...EMPTY, personaData: { engineer: { teeRegistryNumber: '74693' } } };
    expect(formCredentialOf(inactive, targetOf('tee'))).toBeNull();
    const blank: ContactFormData = { ...EMPTY, activePersonas: ['engineer'], personaData: { engineer: { teeRegistryNumber: '  ' } } };
    expect(formCredentialOf(blank, targetOf('tee'))).toBeNull();
  });
});

describe('ποια μητρώα δείχνει η καρτέλα «Επαγγελματικά»', () => {
  it('χωρίς επάγγελμα και χωρίς ιδιότητα ⇒ κανένα· όλα προσφέρονται στο «Προσθήκη μητρώου»', () => {
    expect(personasOf(EMPTY)).toEqual([]);
    expect(addableCredentialTargets(EMPTY)).toHaveLength(PERSONA_ADOPTION_TARGETS.length);
  });

  it('το επάγγελμα φέρνει το μητρώο του: πολιτικός μηχανικός (ISCO 2142) ⇒ ΤΕΕ · δικηγόρος (2611) ⇒ Δικηγορικός', () => {
    expect(personasOf({ ...EMPTY, iscoCode: '2142' })).toEqual(['engineer']);
    expect(personasOf({ ...EMPTY, iscoCode: '2611' })).toEqual(['lawyer']);
  });

  it('επάγγελμα χωρίς μητρώο (ελαιοχρωματιστής 7131) ή με άδεια αντί για persona (υδραυλικός 7126) ⇒ κανένα πεδίο', () => {
    expect(personasOf({ ...EMPTY, iscoCode: '7131' })).toEqual([]);
    expect(personasOf({ ...EMPTY, iscoCode: '7126' })).toEqual([]);
  });

  it('ενεργή persona φαίνεται ανεξάρτητα από το επάγγελμα (συμβολαιογράφος — ISCO 2619, δηλωμένα ανοιχτό)', () => {
    const notary = writeFormCredential({ ...EMPTY, iscoCode: '2619' }, targetOf('notary-association'), { number: '312', chapter: null });
    expect(personasOf(notary)).toEqual(['notary']);
    expect(addableCredentialTargets(notary).map((target) => target.persona)).not.toContain('notary');
  });
});
