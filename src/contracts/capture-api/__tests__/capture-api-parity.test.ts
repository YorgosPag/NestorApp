/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΛΕΕΙ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** (ADR-904 Ε6 · CHECK 3.98).
 *
 * Ένα παραγόμενο OpenAPI είναι άχρηστο αν ο διακομιστής απορρίπτει ό,τι το συμβόλαιο δέχεται. Εδώ αποδεικνύεται:
 *  Κ1 — κάθε **έγκυρη** δήλωση του συμβολαίου τη δέχεται ο αναγνώστης του διακομιστή (`readCaptureDeclaration`)·
 *  Κ2 — ο διακριτής της διάρκειας άδειας καλύπτει **ακριβώς** το λεξιλόγιο `MEDIA_LICENSE_TERM_KINDS`·
 *  Κ3 — το σχήμα εξαργύρωσης v4 (συμβόλαιο) και το v3 (διαδρομές) κρίνουν **ίδια** κάθε παράδειγμα·
 *  Κ4 — κάθε κωδικός άρνησης έχει status, και το συμβόλαιο τον δημοσιεύει με αυτό·
 *  Κ5 — ο γεννήτορας είναι ντετερμινιστικός και τα fixtures συμφωνούν με τα σχήματά τους.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ FieldValue: {} }));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn() }));

import { z } from 'zod/v4';

import { MEDIA_LICENSE_TERM_KINDS } from '@/constants/media-rights-vocabulary';
import { STATUS_BY_TOUR_REFUSAL } from '@/lib/spatial-tour/tour-refusal-status';
import { TOUR_REFUSALS } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { INVITATION_REDEEM_BODY } from '@/server/invitations/invitation-http';
import { readCaptureDeclaration } from '@/server/spatial-tour/tour-capture-finalize';

import { InvitationRedeemBodySchema } from '../../invitation-redeem-body';
import { CAPTURE_API_SCHEMAS, buildCaptureApiDocument } from '../capture-api-document';
import { componentSchemasOf } from '../capture-api-json-schema';
import { CAPTURE_API_FIXTURES, FIXTURE_ACTOR_UID } from '../capture-api-fixtures';
import { CapturePlacementHintSchema, MediaLicenseTermSchema } from '../capture-api-schemas';

const fixturesOf = (component: string) => CAPTURE_API_FIXTURES.filter((f) => f.component === component);
/** Όπως φτάνει στο δίκτυο — τα `undefined` κλειδιά φεύγουν. */
const wire = (body: unknown): unknown => JSON.parse(JSON.stringify(body));

describe('Κ1 — συμβόλαιο ⊆ αναγνώστης του διακομιστή', () => {
  it.each(fixturesOf('CaptureDeclaration').filter((f) => f.valid).map((f) => [f.name, f.body] as const))(
    '%s: ο διακομιστής δέχεται ό,τι δέχεται το συμβόλαιο',
    (_name, body) => {
      expect(readCaptureDeclaration(wire(body), FIXTURE_ACTOR_UID)).not.toBeNull();
    },
  );

  // ADR-904 Κ8 — η πρόταση θέσης δεν έχει «ανοχή» του διακομιστή: άκυρη στο συμβόλαιο ⇒ άκυρη και στον διακομιστή.
  const hintFixtures = fixturesOf('CaptureDeclaration').filter((f) => f.name.startsWith('hint-'));

  it.each(hintFixtures.filter((f) => !f.valid).map((f) => [f.name, f.body] as const))(
    '%s: άκυρη πρόταση θέσης ⇒ ο διακομιστής αρνείται ΟΛΗ τη δήλωση (ποτέ σιωπηλό πέταγμα)',
    (_name, body) => {
      expect(readCaptureDeclaration(wire(body), FIXTURE_ACTOR_UID)).toBeNull();
    },
  );

  it.each(hintFixtures.filter((f) => f.valid).map((f) => [f.name, f.body] as const))(
    '%s: ό,τι αποθηκεύει ο διακομιστής (κανονικοποιημένο) ξανατηρεί το συμβόλαιο — επιστρέφει στην απόδειξη',
    (_name, body) => {
      const stored = readCaptureDeclaration(wire(body), FIXTURE_ACTOR_UID)?.placementHint;
      expect(stored).not.toBeNull();
      expect(CapturePlacementHintSchema.safeParse(stored).success).toBe(true);
    },
  );

  it('ο κανόνας «δημιουργός = δράστης» ζει μόνο στον διακομιστή — άλλος δράστης ⇒ άρνηση', () => {
    const [valid] = fixturesOf('CaptureDeclaration').filter((f) => f.valid);
    expect(readCaptureDeclaration(wire(valid.body), 'someone-else')).toBeNull();
  });
});

it('Κ2 — ο διακριτής της διάρκειας = το λεξιλόγιο, ούτε μορφή παραπάνω ούτε λιγότερη', () => {
  const kinds = MediaLicenseTermSchema.options.map((option) => option.shape.kind.value);
  expect([...kinds].sort()).toEqual([...MEDIA_LICENSE_TERM_KINDS].sort());
});

it.each(fixturesOf('InvitationRedeemBody').map((f) => [f.name, f.body] as const))(
  'Κ3 — %s: το σχήμα εξαργύρωσης του συμβολαίου (v4) και των διαδρομών (v3) κρίνουν ίδια',
  (_name, body) => {
    expect(InvitationRedeemBodySchema.safeParse(body).success).toBe(INVITATION_REDEEM_BODY.safeParse(body).success);
  },
);

describe('Κ4 — οι αρνήσεις', () => {
  const document = buildCaptureApiDocument();

  it('κάθε λόγος του λεξιλογίου δημοσιεύεται με το status του διακομιστή', () => {
    const published = document['x-nestor-rules'].refusals.tour;
    expect(published.map((r) => r.code)).toEqual([...TOUR_REFUSALS]);
    for (const r of published) expect(r.status).toBe(STATUS_BY_TOUR_REFUSAL[r.code as keyof typeof STATUS_BY_TOUR_REFUSAL]);
  });

  it('επαναλήψιμο = μόνο το «δεν μπόρεσα» (5xx)', () => {
    const retryable = document['x-nestor-rules'].refusals.tour.filter((r) => r.retryable).map((r) => r.code);
    expect(retryable).toEqual(TOUR_REFUSALS.filter((code) => STATUS_BY_TOUR_REFUSAL[code] >= 500));
  });
});

describe('Κ5 — ο γεννήτορας', () => {
  it('ντετερμινιστικός: δύο κλήσεις ⇒ ίδια bytes', () => {
    expect(JSON.stringify(buildCaptureApiDocument())).toBe(JSON.stringify(buildCaptureApiDocument()));
  });

  it.each(CAPTURE_API_FIXTURES.map((f) => [f.name, f] as const))('%s: η δηλωμένη ετυμηγορία = του σχήματος', (_name, f) => {
    expect(CAPTURE_API_SCHEMAS[f.component].safeParse(wire(f.body)).success).toBe(f.valid);
  });

  it('κάθε `$ref` δείχνει σε σχήμα που υπάρχει', () => {
    const text = JSON.stringify(buildCaptureApiDocument());
    const refs = [...text.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]);
    const names = Object.keys(buildCaptureApiDocument().components.schemas);
    expect(refs.filter((name) => !names.includes(name))).toEqual([]);
  });

  it('ανώνυμο εμφωλευμένο object ⇒ ο γεννήτορας ΑΡΝΕΙΤΑΙ (ο πελάτης Kotlin δεν έχει όνομα κλάσης)', () => {
    const Anonymous = z.object({ inner: z.object({ state: z.string() }) });
    const InArray = z.object({ items: z.array(z.object({ a: z.string() })) });
    expect(() => componentSchemasOf({ Anonymous })).toThrow('Anonymous.properties.inner: anonymous nested object');
    expect(() => componentSchemasOf({ InArray })).toThrow('anonymous nested object');
  });

  it('ονομασμένο εμφωλευμένο object ⇒ `$ref`, δεκτό', () => {
    const Inner = z.object({ state: z.string() });
    const Outer = z.object({ inner: Inner, list: z.array(Inner) });
    expect(componentSchemasOf({ Inner, Outer }).Outer.properties).toEqual({
      inner: { $ref: '#/components/schemas/Inner' },
      list: { type: 'array', items: { $ref: '#/components/schemas/Inner' } },
    });
  });
});
