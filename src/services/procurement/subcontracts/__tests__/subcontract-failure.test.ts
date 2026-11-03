/**
 * ADR-928 Φ3α-2 — η ερμηνεία της άρνησης του γραφέα της υπεργολαβίας, και η ολικότητα των πινάκων μηνυμάτων.
 */

import elProcurement from '@/i18n/locales/el/procurement.json';
import enProcurement from '@/i18n/locales/en/procurement.json';
import { ApiClientError } from '@/lib/api/api-client-types';
import { SUBCONTRACT_FAILURE_KEYS, SUBCONTRACT_ISSUE_KEYS } from '@/components/procurement/subcontracts/subcontract-message-keys';
import { SUBCONTRACT_ISSUE_CODES } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { SUBCONTRACT_FAILURE_KINDS, subcontractFailureOf } from '../subcontract-failure';

const refusal = (status: number, body: unknown) =>
  new ApiClientError('refused', status, undefined, undefined, undefined, undefined, body);

describe('subcontractFailureOf', () => {
  it('409 CAS: «άλλαξε από άλλον», με την τρέχουσα αναθεώρηση', () => {
    const failure = subcontractFailureOf(refusal(409, { errorCode: 'subcontracts.revisionMismatch', issues: [], currentRevision: 9 }));
    expect(failure).toEqual({ kind: 'revisionMismatch', issues: [], currentRevision: 9 });
  });

  it('άρνηση κύκλου ζωής φτάνει με το ΔΙΚΟ της είδος (ίδιος πίνακας με τον διακομιστή)', () => {
    expect(subcontractFailureOf(refusal(409, { errorCode: 'subcontracts.deviationsPending', issues: [] })).kind).toBe('deviationsPending');
  });

  it('422: μόνο ευρήματα του λεξιλογίου περνούν — άγνωστος κωδικός από το δίκτυο απορρίπτεται', () => {
    const body = {
      errorCode: 'subcontracts.invalid',
      issues: [{ code: 'clauseVersionOutdated', path: 'clauses.1' }, { code: 'madeUp', path: 'x' }, { code: 'contactUnknown' }],
    };
    expect(subcontractFailureOf(refusal(422, body)).issues).toEqual([{ code: 'clauseVersionOutdated', path: 'clauses.1' }]);
  });

  it('κωδικός ΑΛΛΟΥ τομέα δεν γίνεται είδος της υπεργολαβίας· 403 ⇒ forbidden· όχι απάντηση ⇒ network', () => {
    expect(subcontractFailureOf(refusal(409, { errorCode: 'catalog.revisionMismatch', currentRevision: 2 }))).toEqual({
      kind: 'unknown', issues: [], currentRevision: null,
    });
    expect(subcontractFailureOf(refusal(403, {})).kind).toBe('forbidden');
    expect(subcontractFailureOf(new Error('offline')).kind).toBe('network');
  });
});

type Tree = { readonly [key: string]: string | Tree };

function lookup(tree: Tree, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Tree)[part] : undefined), tree);
}

describe('πίνακες μηνυμάτων — ολικοί και μεταφρασμένοι', () => {
  it('κάθε κωδικός ευρήματος και κάθε είδος άρνησης έχει κλειδί', () => {
    expect(Object.keys(SUBCONTRACT_ISSUE_KEYS).sort()).toEqual([...SUBCONTRACT_ISSUE_CODES].sort());
    expect(Object.keys(SUBCONTRACT_FAILURE_KEYS).sort()).toEqual([...SUBCONTRACT_FAILURE_KINDS].sort());
  });

  it.each([['el', elProcurement], ['en', enProcurement]] as const)('κάθε κλειδί λύνεται σε κείμενο στα %s', (_language, bundle) => {
    const keys = [...Object.values(SUBCONTRACT_ISSUE_KEYS), ...Object.values(SUBCONTRACT_FAILURE_KEYS), 'subcontracts.messages.pending'];
    const missing = keys.filter((key) => {
      const value = lookup(bundle as Tree, key);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });
});
