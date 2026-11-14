/**
 * ADR-915 §40.5 — οι άδειες της επαφής: ανάγνωση με προέλευση, σχηματισμός από τη φόρμα, διατήρηση προέλευσης.
 */

import { formShowcaseLicences } from '@/lib/agency/showcase-licence';
import {
  contactLicencesFromDrafts,
  readContactLicences,
  sameLicenceValue,
  sortByVocabulary,
} from '@/lib/contacts/contact-licences';
import { NO_LICENCE_DRAFTS, type LicenceDrafts } from '@/lib/professional/licence-drafts';
import type { ShowcaseLicence } from '@/types/agency-profile';
import type { ContactLicence } from '@/types/contacts/contact-licences';

const NOW = '2026-11-14T10:00:00.000Z';
const EARLIER = '2026-10-01T08:00:00.000Z';

function formed(...declared: Parameters<typeof formShowcaseLicences>[0]): readonly ShowcaseLicence[] {
  const result = formShowcaseLicences(declared);
  if ('reason' in result) throw new Error(`fixture rejected: ${result.reason}`);
  return result.licences;
}

const [INSPECTOR] = formed({ licence: 'energy-inspector', registrationNumber: '2600' });
const [INSTALLER] = formed({ licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: 'ΠΕ Θεσσαλονίκης' });

const ADOPTED_INSPECTOR: ContactLicence = {
  ...INSPECTOR,
  provenance: { source: 'self-declared', recordedAt: EARLIER, engagementId: 'eng_1' },
};

function drafts(overrides: Partial<Record<keyof LicenceDrafts, { number: string; chapter: string } | null>>): LicenceDrafts {
  return { ...NO_LICENCE_DRAFTS, ...overrides };
}

describe('readContactLicences', () => {
  it('απόν ή μη-πίνακας ⇒ καμία άδεια', () => {
    expect(readContactLicences(undefined)).toEqual([]);
    expect(readContactLicences({})).toEqual([]);
  });

  it('διαβάζει γραμμή με έγκυρη προέλευση', () => {
    expect(readContactLicences([ADOPTED_INSPECTOR])).toEqual([ADOPTED_INSPECTOR]);
  });

  it('παραλείπει γραμμή χωρίς ή με άκυρη προέλευση — ποτέ μαντεψιά', () => {
    expect(readContactLicences([{ ...INSPECTOR }])).toEqual([]);
    expect(readContactLicences([{ ...INSPECTOR, provenance: { source: 'robot', recordedAt: NOW, engagementId: null } }])).toEqual([]);
    expect(readContactLicences([{ ...INSPECTOR, provenance: { source: 'office', recordedAt: '', engagementId: null } }])).toEqual([]);
  });

  it('το engagementId κρατιέται μόνο σε self-declared', () => {
    const [read] = readContactLicences([{ ...INSPECTOR, provenance: { source: 'office', recordedAt: NOW, engagementId: 'eng_x' } }]);
    expect(read?.provenance.engagementId).toBeNull();
  });

  it('δεύτερη γραμμή της ίδιας άδειας παραλείπεται (κρατιέται η πρώτη)', () => {
    const second: ContactLicence = { ...ADOPTED_INSPECTOR, provenance: { source: 'office', recordedAt: NOW, engagementId: null } };
    expect(readContactLicences([ADOPTED_INSPECTOR, second])).toEqual([ADOPTED_INSPECTOR]);
  });
});

describe('sameLicenceValue', () => {
  it('ίδιος αριθμός και εκδότης ⇒ ίδια τιμή', () => {
    expect(sameLicenceValue(INSPECTOR, INSPECTOR)).toBe(true);
    expect(sameLicenceValue(INSTALLER, INSTALLER)).toBe(true);
  });

  it('άλλος αριθμός, άλλος εκδότης ή άλλη άδεια ⇒ άλλη τιμή', () => {
    const [otherNumber] = formed({ licence: 'energy-inspector', registrationNumber: '2601' });
    const [otherChapter] = formed({ licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: 'ΠΕ Σερρών' });
    expect(sameLicenceValue(INSPECTOR, otherNumber)).toBe(false);
    expect(sameLicenceValue(INSTALLER, otherChapter)).toBe(false);
    expect(sameLicenceValue(INSPECTOR, INSTALLER)).toBe(false);
  });
});

describe('contactLicencesFromDrafts', () => {
  it('αμετάβλητη τιμή κρατά την προέλευση και την αρχική ώρα', () => {
    const result = contactLicencesFromDrafts([ADOPTED_INSPECTOR], drafts({ 'energy-inspector': { number: ' 2600 ', chapter: '' } }), NOW);
    expect(result).toEqual({ licences: [ADOPTED_INSPECTOR] });
  });

  it('αλλαγμένη τιμή ⇒ office, τώρα', () => {
    const result = contactLicencesFromDrafts([ADOPTED_INSPECTOR], drafts({ 'energy-inspector': { number: '2700', chapter: '' } }), NOW);
    if ('reason' in result) throw new Error(result.reason);
    expect(result.licences[0]?.provenance).toEqual({ source: 'office', recordedAt: NOW, engagementId: null });
    expect(result.licences[0]?.attestation.registration.number).toBe('2700');
  });

  it('νέα άδεια ⇒ office· αφαιρεμένη άδεια ⇒ φεύγει', () => {
    const result = contactLicencesFromDrafts(
      [ADOPTED_INSPECTOR],
      drafts({ 'electrical-installer': { number: '4521', chapter: 'ΠΕ Θεσσαλονίκης' } }),
      NOW,
    );
    if ('reason' in result) throw new Error(result.reason);
    expect(result.licences.map((held) => held.licence)).toEqual(['electrical-installer']);
    expect(result.licences[0]?.provenance.source).toBe('office');
  });

  it('ονομασμένη άρνηση: κενός αριθμός · λείπει εκδότης', () => {
    expect(contactLicencesFromDrafts([], drafts({ 'energy-inspector': { number: '  ', chapter: '' } }), NOW)).toEqual({
      reason: 'licence-number-missing',
    });
    expect(contactLicencesFromDrafts([], drafts({ 'electrical-installer': { number: '4521', chapter: ' ' } }), NOW)).toEqual({
      reason: 'licence-chapter-missing',
    });
  });

  it('καμία δηλωμένη ⇒ καμία άδεια', () => {
    expect(contactLicencesFromDrafts([ADOPTED_INSPECTOR], NO_LICENCE_DRAFTS, NOW)).toEqual({ licences: [] });
  });
});

describe('sortByVocabulary', () => {
  it('σειρά του λεξιλογίου, ανεξάρτητα από τη σειρά εισόδου', () => {
    const installer: ContactLicence = { ...INSTALLER, provenance: { source: 'office', recordedAt: NOW, engagementId: null } };
    const sorted = sortByVocabulary([installer, ADOPTED_INSPECTOR]);
    expect(sorted.map((held) => held.licence)).toEqual(['energy-inspector', 'electrical-installer']);
  });
});
