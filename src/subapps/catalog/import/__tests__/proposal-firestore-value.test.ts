/**
 * Η πρόταση εισαγωγής είναι **αποθηκεύσιμη** στο Firestore (ADR-923 §5.5.2 Β10): καμία τιμή `undefined`, πουθενά.
 *
 * Περιστατικό (live 2026-11-13, req_8e1deb63): «+Φάσεις» στη σελ. 85 ⇒ κελί «1Ph» σε ιδιότητα αριθμού ⇒ εύρημα με
 * `params: undefined` ⇒ `Cannot use "undefined" as a Firestore value (rows.0.fields.4.issues.0.params)` ⇒ 500. Το Admin SDK
 * δεν έχει `ignoreUndefinedProperties` (επίτηδες), και ο τύπος δεν το βλέπει χωρίς `exactOptionalPropertyTypes`.
 */

import { schemaSnapshotOf } from '../../aggregate/edit-aggregate';
import { MFP_SETTINGS } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { issueOf } from '../../schema/catalog-issues';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { ExtractedCell, ExtractedGroup } from '../../types/catalog-import';
import { ANY_SLOT } from '../../types/product';
import { parseAttributeText } from '../../values/value-text-codec';
import { buildAttributeRows, type AttributeProposalContext } from '../build-attribute-proposal';

const text = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };

/** Κάθε διαδρομή όπου ζει `undefined` — ό,τι θα απέρριπτε το Firestore. */
function undefinedPaths(value: unknown, path = ''): string[] {
  if (value === undefined) return [path];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => undefinedPaths(item, path === '' ? key : `${path}.${key}`));
}

/** Η «Ηλεκτρική παροχή» του MFP ως **αριθμός** — το σχήμα της ιδιότητας «Φάσεις» (1..3, 0 δεκ.). */
function phasesAsNumber(): CatalogAttributeDefinition {
  const source = MFP_ATTRIBUTE_MAP.get('power_supply');
  if (!source) throw new Error('fixture: power_supply missing');
  return { ...source, type: 'number', config: { min: 1, max: 3, decimals: 0, negativeAllowed: false } };
}

const cell = (attributeId: string, value: string): ExtractedCell => ({
  target: { kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT },
  text: value,
  confidence: 1,
  anchor: null,
  unitCode: null,
  flags: [],
});

describe('ο ένας κατασκευαστής ευρήματος', () => {
  it('χωρίς παραμέτρους ⇒ κανένα κλειδί `params`', () => {
    expect(issueOf('valueNotNumber', 'phases')).toEqual({ code: 'valueNotNumber', path: 'phases' });
    expect('params' in issueOf('valueNotNumber', 'phases', undefined)).toBe(false);
  });

  it('με παραμέτρους ⇒ τις κρατά', () => {
    expect(issueOf('optionUnknown', 'phases', { code: '1Ph' })).toEqual({ code: 'optionUnknown', path: 'phases', params: { code: '1Ph' } });
  });

  it('ο κωδικοποιητής τιμών δεν γεννά `params: undefined` στην άρνηση', () => {
    const parsed = parseAttributeText(phasesAsNumber(), '1Ph', text);
    expect(parsed.ok).toBe(false);
    expect('params' in parsed).toBe(false);
  });
});

describe('🔴 η πρόταση με αδιάβαστο κελί γράφεται (live 2026-11-13)', () => {
  const attributes = new Map(MFP_ATTRIBUTE_MAP);
  attributes.set('power_supply', phasesAsNumber());
  const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
  const context: AttributeProposalContext = { schema, text, model: null, matches: new Map(), base: new Map() };
  const group: ExtractedGroup = {
    groupKey: 'model:mfp_tm:0',
    modelCode: 'mfp_tm',
    sharedCells: [],
    rows: [{ rowKey: 'r0', cells: [cell('size', '34'), cell('power_supply', '1Ph')] }],
    pages: [],
  };

  it('«1Ph» σε αριθμό ⇒ εύρημα χωρίς `params`, και καμία τιμή `undefined` σε όλες τις γραμμές', () => {
    const rows = buildAttributeRows(group, context);
    const issues = rows.flatMap((row) => row.fields).filter((field) => field.target.kind === 'attribute' && field.target.attributeId === 'power_supply').flatMap((field) => field.issues);
    expect(issues).toContainEqual({ code: 'valueNotNumber', path: 'power_supply' });
    expect(undefinedPaths(rows)).toEqual([]);
  });
});
