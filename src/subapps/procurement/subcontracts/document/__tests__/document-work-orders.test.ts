/**
 * ADR-928 §5.24 — το έργο και οι εντολές εργασίας στο έγγραφο: κύρια σύμβαση με δήλωση «διέπεται από τους όρους της
 * παρούσας», ενότητα ανά εντολή με τον ΙΔΙΟ αριθμό με την οθόνη, κτίρια μόνο από το στιγμιότυπο του γραφέα.
 */

import { sampleProjectIdentity } from '../../agreements/__tests__/agreement-fixtures';
import type { SiteAssignment, SubcontractAgreementSnapshot } from '../../types/agreement';
import { buildAgreementDocument } from '../agreement-document-model';
import { sampleSnapshot } from './document-fixtures';

const plain = (text: string) => text.replace(/ /g, ' ');
const RAW_KEY = /\b(project|workOrders|sections)\.[a-zA-Z_.]+\b/;

function assignment(projectId: string, patch: Partial<SiteAssignment> = {}): SiteAssignment {
  return {
    id: `scas_${projectId}`, project: { ...sampleProjectIdentity(projectId), licenseNumber: '77/2026', buildings: [{ id: 'bld_a', label: 'Κτήριο Α' }, { id: 'bld_b', label: 'Κτήριο Β' }] },
    startDate: '2026-12-01', durationDays: 30, note: 'Πρόσβαση από την πίσω πλευρά', assignedBy: 'u_pm', assignedAt: '2026-11-20T08:00:00.000Z', ...patch,
  };
}

function masterSnapshot(assignments: readonly SiteAssignment[]): SubcontractAgreementSnapshot {
  return { ...sampleSnapshot(), scope: { kind: 'multi_project', assignments } };
}

describe('κύρια σύμβαση — η ενότητα «Έργο» και οι εντολές εργασίας', () => {
  const orders = [assignment('proj_1'), assignment('proj_2', { startDate: null, durationDays: null, note: null }), assignment('proj_1', { id: 'scas_again' })];

  it('το «Έργο» δηλώνει ότι οι εντολές διέπονται από τους όρους της παρούσας — όχι λίστα αναθέσεων', () => {
    const document = buildAgreementDocument(masterSnapshot(orders), 'el');
    expect(document.project).toHaveLength(1);
    expect(document.project[0].value).toContain('διέπεται από τους όρους της παρούσας');
  });

  it('μία ενότητα ανά εντολή, αριθμημένη με τη σειρά έκδοσης (ίδια με την οθόνη) — και η επανάληψη στο ίδιο έργο', () => {
    const document = buildAgreementDocument(masterSnapshot(orders), 'el');
    expect(document.workOrders.map((order) => order.heading)).toEqual(['Εντολή εργασίας αρ. 1', 'Εντολή εργασίας αρ. 2', 'Εντολή εργασίας αρ. 3']);
    expect(document.labels.workOrders).toBe('Εντολές εργασίας');
  });

  it('ταυτότητα έργου, κτίρια ως λίστα της γλώσσας, έναρξη, διάρκεια, σημείωση — el και en', () => {
    const greek = buildAgreementDocument(masterSnapshot(orders), 'el').workOrders[0].fields;
    const english = buildAgreementDocument(masterSnapshot(orders), 'en').workOrders[0].fields;
    expect(Object.fromEntries(greek.map((field) => [field.label, plain(field.value)]))).toMatchObject({
      'Άδεια δόμησης': '77/2026', 'Κτίρια': 'Κτήριο Α και Κτήριο Β', 'Έναρξη εργασιών': '1 Δεκεμβρίου 2026', 'Διάρκεια': '30 ημέρες', 'Σημείωση': 'Πρόσβαση από την πίσω πλευρά',
    });
    expect(Object.fromEntries(english.map((field) => [field.label, plain(field.value)]))).toMatchObject({
      'Building permit': '77/2026', 'Buildings': 'Κτήριο Α and Κτήριο Β', 'Start of work': 'December 1, 2026', 'Duration': '30 days',
    });
  });

  it('πεδία χωρίς τιμή δεν τυπώνονται· κανένα ωμό κλειδί', () => {
    const document = buildAgreementDocument(masterSnapshot(orders), 'en');
    expect(document.workOrders[1].fields.map((field) => field.label)).not.toEqual(expect.arrayContaining(['Start of work', 'Duration', 'Note']));
    expect(JSON.stringify(document)).not.toMatch(RAW_KEY);
  });

  it('κύρια σύμβαση χωρίς εντολή ακόμη ⇒ καμία ενότητα εντολών', () => {
    expect(buildAgreementDocument(masterSnapshot([]), 'el').workOrders).toEqual([]);
  });
});

describe('συμφωνητικό ενός έργου — κτίρια μόνο από το στιγμιότυπο', () => {
  it('με `buildings` ⇒ τυπώνονται με την ετικέτα τους', () => {
    const snapshot: SubcontractAgreementSnapshot = { ...sampleSnapshot(), scope: { kind: 'single_project', project: { ...sampleProjectIdentity(), buildings: [{ id: 'bld_1', label: 'Κτήριο Α' }] } } };
    const document = buildAgreementDocument(snapshot, 'el');
    expect(document.project).toContainEqual({ label: 'Κτίρια', value: 'Κτήριο Α' });
    expect(document.workOrders).toEqual([]);
  });

  it('έγγραφο πριν την §5.24 (μόνο `buildingIds`) ⇒ ΔΕΝ τυπώνει κτίρια — ποτέ ταυτότητα στη θέση ονόματος', () => {
    const document = buildAgreementDocument(sampleSnapshot(), 'el');
    expect(document.project.map((field) => field.label)).not.toContain('Κτίρια');
    expect(JSON.stringify(document)).not.toContain('bld_1');
  });
});
