/**
 * ADR-915 §40.7 — οι τάξεις μιας άδειας: η ρίζα (ΦΕΚ Β΄ 1228/2025), ο σχηματισμός, η ανάγνωση, η σύγκριση, και η
 * διαδρομή φόρμα → σύρμα → άδεια → φόρμα χωρίς απώλεια.
 */

import { LICENCE_GRADES, PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { formShowcaseLicences, readShowcaseLicences } from '@/lib/agency/showcase-licence';
import { sameLicenceValue } from '@/lib/contacts/contact-licences';
import { NO_LICENCE_DRAFTS, licenceDraftsOf, licenceWireOf } from '@/lib/professional/licence-drafts';
import {
  formLicenceGrades,
  gradesField,
  licenceGradeScopes,
  readLicenceGrades,
  sameLicenceGrades,
} from '@/lib/professional/licence-grades';

describe('Ρ — η ρίζα: ΥΠΕΝ/ΣΕΝΕ/17806/1085', () => {
  it('Ρ1 δύο τάξεις, Α΄ και Β΄ — Γ΄ δεν υπάρχει στο ισχύον κείμενο', () => {
    expect(LICENCE_GRADES).toEqual(['A', 'B']);
  });

  it('Ρ2 ο επιθεωρητής: Κτίρια Α΄ ≤ 250 τ.μ. · Θέρμανση/Κλιματισμός Α΄ μόνο κατοικία < 150 kW · Β΄ χωρίς όριο', () => {
    const scheme = PROFESSIONAL_LICENCE_SPECS['energy-inspector'].gradeScheme;
    expect(scheme?.scopes).toEqual(['buildings', 'heating', 'cooling']);
    expect(scheme?.entitlements).toEqual({
      buildings: { A: { kind: 'area-cap', maxAreaSqm: 250 }, B: { kind: 'unrestricted' } },
      heating: { A: { kind: 'residential-power-cap', belowPowerKw: 150 }, B: { kind: 'unrestricted' } },
      cooling: { A: { kind: 'residential-power-cap', belowPowerKw: 150 }, B: { kind: 'unrestricted' } },
    });
  });

  it('Ρ3 ο ηλεκτρολόγος δεν έχει (ακόμη) τάξεις', () => {
    expect(licenceGradeScopes('electrical-installer')).toEqual([]);
  });
});

describe('Σ — σχηματισμός', () => {
  it('Σ1 καμία δήλωση ⇒ null · κενό αντικείμενο ⇒ null', () => {
    expect(formLicenceGrades('energy-inspector', undefined)).toEqual({ grades: null });
    expect(formLicenceGrades('energy-inspector', {})).toEqual({ grades: null });
  });

  it('Σ2 έγκυρες τάξεις ⇒ με τη σειρά της ρίζας', () => {
    expect(formLicenceGrades('energy-inspector', { cooling: 'A', buildings: 'B' })).toEqual({
      grades: { buildings: 'B', cooling: 'A' },
    });
  });

  it('Σ3 «Γ΄» · άγνωστη κατηγορία · τάξη σε άδεια χωρίς τάξεις ⇒ άρνηση', () => {
    expect(formLicenceGrades('energy-inspector', { buildings: 'C' })).toBeNull();
    expect(formLicenceGrades('energy-inspector', { lifts: 'A' })).toBeNull();
    expect(formLicenceGrades('electrical-installer', { buildings: 'A' })).toBeNull();
  });

  it('Σ4 ο σχηματισμός αδειών αρνείται ονομαστικά', () => {
    expect(formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: '2600', grades: { buildings: 'C' } }])).toEqual({
      reason: 'licence-grade-unknown',
    });
  });

  it('Σ5 χωρίς τάξεις ⇒ ΚΑΝΕΝΑ πεδίο `grades` (ούτε undefined ούτε {})', () => {
    const result = formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: '2600' }]);
    if ('reason' in result) throw new Error(result.reason);
    expect(Object.prototype.hasOwnProperty.call(result.licences[0], 'grades')).toBe(false);
    expect(gradesField(null)).toEqual({});
  });
});

describe('Α — ανάγνωση από τον δίσκο', () => {
  it('Α1 ό,τι δεν περνά τον φρουρό παραλείπεται — σημαίνει «δεν δηλώθηκε», όχι «Όχι»', () => {
    expect(readLicenceGrades('energy-inspector', { buildings: 'B', heating: 'C', lifts: 'A' })).toEqual({ buildings: 'B' });
    expect(readLicenceGrades('energy-inspector', 'B')).toBeNull();
    expect(readLicenceGrades('energy-inspector', [])).toBeNull();
    expect(readLicenceGrades('electrical-installer', { buildings: 'A' })).toBeNull();
  });

  it('Α2 η άδεια διαβάζεται με τις τάξεις της', () => {
    const [held] = readShowcaseLicences([
      {
        licence: 'energy-inspector',
        attestation: { state: 'declared', registration: { authorityKind: 'national', authority: 'ypen', number: '2600' } },
        grades: { buildings: 'B' },
      },
    ]);
    expect(held.grades).toEqual({ buildings: 'B' });
  });
});

describe('Ι — ταυτότητα τιμής', () => {
  it('Ι1 απουσία = απουσία · σειρά κλειδιών αδιάφορη', () => {
    expect(sameLicenceGrades(undefined, undefined)).toBe(true);
    expect(sameLicenceGrades({ buildings: 'B', cooling: 'A' }, { cooling: 'A', buildings: 'B' })).toBe(true);
    expect(sameLicenceGrades({ buildings: 'A' }, undefined)).toBe(false);
  });

  it('Ι2 αλλαγμένη τάξη = άλλη τιμή ⇒ νέα προέλευση', () => {
    const formed = (grades?: { buildings: 'A' | 'B' }) => {
      const result = formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: '2600', ...(grades ? { grades } : {}) }]);
      if ('reason' in result) throw new Error(result.reason);
      return result.licences[0];
    };
    expect(sameLicenceValue(formed({ buildings: 'A' }), formed({ buildings: 'A' }))).toBe(true);
    expect(sameLicenceValue(formed({ buildings: 'A' }), formed({ buildings: 'B' }))).toBe(false);
    expect(sameLicenceValue(formed(), formed({ buildings: 'A' }))).toBe(false);
  });
});

describe('Δ — φόρμα ⇄ σύρμα χωρίς απώλεια', () => {
  it('Δ1 οι τάξεις ταξιδεύουν μέχρι την άδεια και πίσω στη φόρμα', () => {
    const drafts = { ...NO_LICENCE_DRAFTS, 'energy-inspector': { number: '2600', chapter: '', grades: { buildings: 'B' as const } } };
    const result = formShowcaseLicences(licenceWireOf(drafts, []));
    if ('reason' in result) throw new Error(result.reason);
    expect(licenceDraftsOf(result.licences)['energy-inspector']).toEqual({ number: '2600', chapter: '', grades: { buildings: 'B' } });
  });

  it('Δ2 όλες οι τάξεις καθαρισμένες ({}) ⇒ το σύρμα δεν τις φέρει', () => {
    const drafts = { ...NO_LICENCE_DRAFTS, 'energy-inspector': { number: '2600', chapter: '', grades: {} } };
    expect(licenceWireOf(drafts, [])).toEqual([{ licence: 'energy-inspector', registrationNumber: '2600' }]);
  });
});
