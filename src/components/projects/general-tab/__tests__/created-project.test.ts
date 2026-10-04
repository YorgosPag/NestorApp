/**
 * ΑΓΚΥΡΑ — **το έργο που μόλις γεννήθηκε φεύγει από τη φόρμα με όνομα και εταιρεία** (ADR-742).
 *
 * 🔴 Ως τις 2026-10-04 η σελίδα κρατούσε το πρόχειρο (`name: ''`, `company: ''`) και άλλαζε μόνο
 * την ταυτότητα ⇒ breadcrumb με ωμό `cont_…` και άδεια φόρμα ως την ενυδάτωση.
 */

/* global describe, it, expect */

import { createdProjectFields } from '../created-project';
import type { ProjectFormData } from '../types';

const FORM: ProjectFormData = {
  name: '  Νέο έργο  ',
  licenseTitle: 'Τίτλος άδειας',
  description: '',
  buildingBlock: '',
  protocolNumber: '',
  licenseNumber: '',
  issuingAuthority: '',
  issueDate: '',
  status: 'planning',
  companyName: '',
  type: '',
  priority: '',
  riskLevel: '',
  complexity: '',
  budget: '',
  totalValue: 1000,
  totalArea: '',
  duration: '',
  startDate: '',
  completionDate: '',
  client: '',
  location: '',
};

describe('createdProjectFields', () => {
  it('παραδίδει όνομα (χωρίς κενά στα άκρα), κατάσταση και εταιρεία — ταυτότητα ΚΑΙ όνομα', () => {
    const fields = createdProjectFields(FORM, { id: 'cont_abc', name: 'ΔΟΚΙΜΗ Α.Ε.' });

    expect(fields.name).toBe('Νέο έργο');
    expect(fields.title).toBe('Τίτλος άδειας');
    expect(fields.status).toBe('planning');
    expect(fields.linkedCompanyId).toBe('cont_abc');
    expect(fields.company).toBe('ΔΟΚΙΜΗ Α.Ε.');
    expect(fields.totalValue).toBe(1000);
  });

  it('το «δεν δηλώθηκε» της φόρμας ΛΕΙΠΕΙ — δεν γίνεται κλειδί με `undefined`', () => {
    const fields = createdProjectFields(FORM, { id: 'cont_abc', name: '' });

    for (const key of ['type', 'priority', 'riskLevel', 'complexity', 'budget', 'totalArea', 'duration']) {
      expect(key in fields).toBe(false);
    }
    expect(Object.values(fields)).not.toContain(undefined);
  });

  it('δεν φέρει ποτέ ταυτότητα έργου — αυτή τη δίνει ο διακομιστής', () => {
    expect('id' in createdProjectFields(FORM, { id: 'cont_abc', name: '' })).toBe(false);
  });
});
