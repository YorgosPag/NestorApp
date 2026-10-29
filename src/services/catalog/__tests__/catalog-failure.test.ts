import { ApiClientError } from '@/lib/api/api-client-types';
import { catalogFailureOf } from '../catalog-failure';

const refusal = (status: number, body: unknown) =>
  new ApiClientError('refused', status, undefined, undefined, undefined, undefined, body);

describe('catalogFailureOf — η μία ερμηνεία της άρνησης του γραφέα', () => {
  it('409 CAS: «άλλαξε από άλλον», με την τρέχουσα αναθεώρηση του διακομιστή', () => {
    const failure = catalogFailureOf(refusal(409, { errorCode: 'catalog.revisionMismatch', issues: [], currentRevision: 7 }));
    expect(failure).toEqual({ kind: 'revisionMismatch', issues: [], currentRevision: 7, fence: null });
  });

  it('409 φράχτη: το ΦΡΕΣΚΟ αποτύπωμα και το πλήθος φτάνουν στην οθόνη (Γ3)', () => {
    const body = {
      errorCode: 'catalog.confirmationRequired',
      issues: [{ code: 'fenceDigestStale', path: 'confirmedDiffDigest' }],
      diffDigest: '0123456789abcdef',
      fencedCount: 3,
    };
    const failure = catalogFailureOf(refusal(409, body));
    expect(failure.kind).toBe('confirmationRequired');
    expect(failure.fence).toEqual({ diffDigest: '0123456789abcdef', fencedCount: 3 });
  });

  it('αποτύπωμα με λάθος σχήμα (από το δίκτυο) ΔΕΝ γίνεται δεκτό', () => {
    const body = { errorCode: 'catalog.confirmationRequired', issues: [], diffDigest: 'not-a-digest', fencedCount: 3 };
    expect(catalogFailureOf(refusal(409, body)).fence).toBeNull();
  });

  it('το αποτύπωμα διαβάζεται ΜΟΝΟ στο confirmationRequired', () => {
    const body = { errorCode: 'catalog.revisionMismatch', issues: [], diffDigest: '0123456789abcdef', fencedCount: 3 };
    expect(catalogFailureOf(refusal(409, body)).fence).toBeNull();
  });

  it('422: τα ευρήματα φτάνουν ως κωδικοί με διαδρομή — για το πεδίο τους', () => {
    const body = {
      errorCode: 'catalog.invalid',
      issues: [{ code: 'axisTypeNotAllowed', path: 'variantSchemes[0].levels[0]' }, { code: 'tooMany', path: 'units', params: { max: 40 } }],
    };
    expect(catalogFailureOf(refusal(422, body)).issues).toEqual(body.issues);
  });

  it('εύρημα με άγνωστο κωδικό (από το δίκτυο) ΔΕΝ γίνεται δεκτό', () => {
    const body = { errorCode: 'catalog.invalid', issues: [{ code: 'madeUp', path: 'x' }, { code: 'tooMany' }] };
    expect(catalogFailureOf(refusal(422, body)).issues).toEqual([]);
  });

  it('403 χωρίς κωδικό καταλόγου ⇒ «δεν επιτρέπεται»', () => {
    expect(catalogFailureOf(refusal(403, { error: 'forbidden' })).kind).toBe('forbidden');
  });

  it('κάτι που δεν είναι απάντηση διακομιστή ⇒ «δίκτυο» (δεν ξέρουμε αν έφτασε)', () => {
    expect(catalogFailureOf(new TypeError('Failed to fetch')).kind).toBe('network');
  });

  it('500 χωρίς κωδικό ⇒ «άγνωστο»', () => {
    expect(catalogFailureOf(refusal(500, null)).kind).toBe('unknown');
  });
});
