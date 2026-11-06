/**
 * Το κριτήριο εξόδου της Φάσης 7 (ADR-923 §9): εξαγωγή που περνά το **επίσημο** σχήμα ETIM xChange 2.0, εκτελεσμένο από
 * ανεξάρτητο validator. Τα αρχεία του `fixtures/` είναι τα επίσημα του ETIM International (Apache-2.0), αυτούσια.
 */

import Ajv2020 from 'ajv/dist/2020';

import { PLATFORM_MEASUREMENT_REGISTRY } from '../../../measurement/measurement-registry';
import { validateAttribute } from '../../../schema/validate-attribute';
import { validateFamily } from '../../../schema/validate-family';
import type { CatalogAttributeDefinition } from '../../../types/attribute';
import { ANY_SLOT, type AttributeValue, type NoValueReason, type ValueSlots } from '../../../types/product';
import { buildXChangeDocument, type XChangeExportInput, type XChangeProductSource } from '../catalog-to-xchange';
import { readXChangeProducts } from '../xchange-document';
import { extractGroupsFromXChange, type XChangeAttribute, type XChangeImportSchema } from '../xchange-to-groups';
import sample11 from './fixtures/xchange-1.1.sample.json';
import sample20 from './fixtures/xchange-2.0.sample.json';
import schema20 from './fixtures/xchange-2.0.schema.json';
import { ETIM_XCHANGE_UNITS } from '../../../vocabulary/etim';

const validator = new Ajv2020({ strict: false, validateFormats: false, allErrors: true }).compile(schema20);
const errorsOf = (document: unknown) => (validator(document) ? [] : (validator.errors ?? []).map((error) => `${error.instancePath} ${error.message}`));

const MAPPINGS = { etimFeature: null, bsddUri: null, ifc: null, atoeCode: null, platformTerm: { status: 'unbound' } } as const;
const BASE = { groupId: 'g', labels: {}, description: {}, localizable: false, scopable: false, unique: false, orderKey: 'a' };

const measurement = (id: string, feature: string, etimUnitCode: string | null): XChangeAttribute => ({
  ...BASE, id, code: id, type: 'measurement', mappings: { ...MAPPINGS, etimFeature: feature, etimUnitCode },
  config: { measurementFamilyCode: 'power', defaultUnitCode: 'W', allowedUnitCodes: null, min: null, max: null, decimals: 2 },
} as unknown as XChangeAttribute);

const select = (id: string, feature: string): XChangeAttribute => ({
  ...BASE, id, code: id, type: 'select', mappings: { ...MAPPINGS, etimFeature: feature },
  config: { options: [{ code: 'white', labels: {}, etimValue: 'EV000138' }, { code: 'free', labels: {} }] },
} as unknown as XChangeAttribute);

const logical = (id: string, feature: string): XChangeAttribute => ({ ...BASE, id, code: id, type: 'boolean', mappings: { ...MAPPINGS, etimFeature: feature }, config: {} } as unknown as XChangeAttribute);
const sku: XChangeAttribute = { ...BASE, id: 'sku', code: 'sku', type: 'text', unique: true, mappings: MAPPINGS, config: { maxLength: null, pattern: null } } as unknown as XChangeAttribute;
const name: XChangeAttribute = { ...BASE, id: 'name', code: 'name', type: 'text', localizable: true, mappings: MAPPINGS, config: { maxLength: null, pattern: null } } as unknown as XChangeAttribute;

const POWER = measurement('power', 'EF000001', 'kW');
const COLOR = select('color', 'EF000002');
const DIMMABLE = logical('dimmable', 'EF000003');
const ATTRIBUTES = [sku, name, POWER, COLOR, DIMMABLE];

const slots = (value: AttributeValue): ValueSlots => ({ [ANY_SLOT]: { [ANY_SLOT]: value } });

function source(overrides: Partial<XChangeProductSource> = {}): XChangeProductSource {
  return {
    identifier: '016-15-001',
    label: 'Fan coil MFP-15',
    familyId: 'fan',
    values: new Map([
      ['power', slots({ type: 'measurement', amount: '1800', unitCode: 'W' })],
      ['color', slots({ type: 'select', optionCode: 'white' })],
      ['dimmable', slots({ type: 'boolean', value: true })],
    ]),
    noValueReasons: new Map<string, NoValueReason>(),
    price: { unit: 'C62', quantity: 1, grossList: '120.50', net: null },
    ...overrides,
  };
}

function exportInput(overrides: Partial<XChangeExportInput> = {}): XChangeExportInput {
  return {
    catalogueId: 'cat-2026',
    language: 'el',
    validFrom: '2026-10-29',
    generatedOn: '2026-11-02',
    priceValidityDate: '2026-10-29',
    currency: 'EUR',
    supplier: { name: 'Aries', vatNumber: 'EL094014201' },
    families: new Map([['fan', { etimClass: 'EC011533', attributes: ATTRIBUTES.map((attribute) => ({ attributeId: attribute.id, requiredChannels: [] })) }]]),
    attributes: new Map(ATTRIBUTES.map((attribute) => [attribute.id, attribute as CatalogAttributeDefinition])),
    registry: PLATFORM_MEASUREMENT_REGISTRY,
    products: [source()],
    ...overrides,
  };
}

const importSchema = (overrides: Partial<XChangeImportSchema> = {}): XChangeImportSchema => ({
  etimClass: 'EC011533', attributes: ATTRIBUTES, labelAttributeId: 'name', hasVariants: false, language: 'el', ...overrides,
});

const cellsOf = (document: unknown, schema = importSchema()) => {
  const products = readXChangeProducts(JSON.stringify(document));
  if (products === null) throw new Error('not an xChange document');
  const { groups, report } = extractGroupsFromXChange(products, schema);
  const cells = groups.flatMap((group) => group.rows.flatMap((row) => row.cells));
  return { groups, report, byAttribute: new Map(cells.map((cell) => [cell.target.kind === 'attribute' ? cell.target.attributeId : '', cell])) };
};

describe('ο μάρτυρας: ο validator δουλεύει πάνω στα επίσημα αρχεία', () => {
  it('το επίσημο δείγμα περνά', () => expect(errorsOf(sample20)).toEqual([]));
  it('χαλασμένο έγγραφο κοκκινίζει, άρα το πράσινο σημαίνει κάτι', () => {
    expect(errorsOf({ ...sample20, CatalogueType: 'PARTIAL' }).length).toBeGreaterThan(0);
  });
});

describe('ανάγνωση', () => {
  it('διαβάζει τα επίσημα δείγματα 2.0 και 1.1', () => {
    expect(readXChangeProducts(JSON.stringify(sample20))?.length).toBeGreaterThan(0);
    expect(readXChangeProducts(JSON.stringify(sample11))?.length).toBeGreaterThan(0);
  });
  it('απορρίπτει ό,τι δεν είναι xChange, άγνωστη έκδοση και σπασμένο JSON', () => {
    expect(readXChangeProducts('{"a":1}')).toBeNull();
    expect(readXChangeProducts(JSON.stringify({ ...sample20, SchemaVersion: '9.9' }))).toBeNull();
    expect(readXChangeProducts('{')).toBeNull();
  });
  it('αντέχει BOM', () => expect(readXChangeProducts(`﻿${JSON.stringify(sample20)}`)).not.toBeNull());
});

describe('εξαγωγή', () => {
  it('περνά το επίσημο σχήμα', () => expect(errorsOf(buildXChangeDocument(exportInput()).document)).toEqual([]));
  it('περνά και χωρίς ΑΦΜ, χωρίς τιμή και χωρίς κλάση', () => {
    const { document, report } = buildXChangeDocument(exportInput({
      supplier: { name: 'Aries', vatNumber: null },
      products: [source({ price: null, familyId: 'other' })],
    }));
    expect(errorsOf(document)).toEqual([]);
    expect(report.withoutClass).toBe(1);
    expect(document.Supplier[0].Product[0].TradeItem[0].Pricing[0]).toEqual({ PriceUnit: 'C62', PriceQuantity: '1', PriceOnRequest: true });
  });
  it('ο αριθμός γράφεται στη μονάδα του ETIM: 1800 W = 1,8 kW', () => {
    const { document } = buildXChangeDocument(exportInput());
    expect(JSON.stringify(document)).toContain('"EtimFeatureCode":"EF000001","EtimValueNumeric":"1.8"');
  });
  it('χωρίς δηλωμένη μονάδα παραλείπεται και μετριέται, δεν γράφεται γυμνός αριθμός', () => {
    const attribute = measurement('power', 'EF000001', null);
    const { document, report } = buildXChangeDocument(exportInput({ attributes: new Map([...exportInput().attributes, ['power', attribute]]) }));
    expect(JSON.stringify(document)).not.toContain('EF000001');
    expect(report.unitUndeclared).toEqual(['EF000001']);
  });
  it('επιλογή χωρίς κωδικό ETIM παραλείπεται και μετριέται', () => {
    const values = new Map(source().values).set('color', slots({ type: 'select', optionCode: 'free' }));
    const { document, report } = buildXChangeDocument(exportInput({ products: [source({ values })] }));
    expect(JSON.stringify(document)).not.toContain('EF000002');
    expect(report.optionUnmapped).toEqual(['EF000002']);
  });
  it('η ρητή απουσία γίνεται ReasonNoValue και νικά την τιμή', () => {
    const { document } = buildXChangeDocument(exportInput({ products: [source({ noValueReasons: new Map<string, NoValueReason>([['dimmable', 'notApplicable']]) })] }));
    expect(errorsOf(document)).toEqual([]);
    expect(JSON.stringify(document)).toContain('"EtimFeatureCode":"EF000003","ReasonNoValue":"NA"');
  });
  it('§23.2 K4 🔴 η ρητή απουσία ΓΥΡΙΖΕΙ ως κελί λόγου, όχι μόνο ως μέτρηση', () => {
    const reasons = new Map<string, NoValueReason>([['dimmable', 'notApplicable'], ['color', 'unknown']]);
    const { document } = buildXChangeDocument(exportInput({ products: [source({ noValueReasons: reasons })] }));
    const { groups, report } = cellsOf(document);
    const reasonCells = groups.flatMap((group) => group.rows.flatMap((row) => row.cells)).filter((cell) => cell.target.kind === 'noValueReason');
    expect(reasonCells.map((cell) => [cell.target.kind === 'noValueReason' ? cell.target.attributeId : '', cell.text]).sort()).toEqual([
      ['color', 'unknown'],
      ['dimmable', 'notApplicable'],
    ]);
    expect(report.declaredNoValue).toBe(2);
  });
  it('§23.2 K4: το MV δεν είναι λόγος απουσίας του προϊόντος (κωδικολόγιο 5.20) — μένει κενό', () => {
    const { document } = buildXChangeDocument(exportInput());
    const text = JSON.stringify(document).replace('"EtimFeatureCode":"EF000003","EtimValueLogical":true', '"EtimFeatureCode":"EF000003","ReasonNoValue":"MV"');
    expect(text).toContain('"ReasonNoValue":"MV"');
    const { groups } = cellsOf(JSON.parse(text));
    expect(groups.flatMap((group) => group.rows.flatMap((row) => row.cells)).some((cell) => cell.target.kind === 'noValueReason')).toBe(false);
  });
});

describe('τιμές στο εμπορεύσιμο είδος', () => {
  const pricingOf = (document: ReturnType<typeof buildXChangeDocument>['document']) => document.Supplier[0].Product[0].TradeItem[0];

  it('οι μονάδες του λεξιλογίου είναι ακριβώς του σχήματος, για τιμή ΚΑΙ παραγγελία', () => {
    const tradeItem = schema20.properties.Supplier.items.properties.Product.items.properties.TradeItem.items.properties;
    expect([...ETIM_XCHANGE_UNITS]).toEqual(tradeItem.Pricing.items.properties.PriceUnit.enum);
    expect([...ETIM_XCHANGE_UNITS]).toEqual(tradeItem.Ordering.properties.OrderUnit.enum);
  });
  it('τιμή λίστας με έκπτωση κοινού, ανά 100 μέτρα: περνά το σχήμα, και η μονάδα παραγγελίας είναι η μονάδα της τιμής', () => {
    const price = { unit: 'MTR', quantity: 100, grossList: '250.00', net: '225.00' } as const;
    const { document } = buildXChangeDocument(exportInput({ products: [source({ price })] }));
    expect(errorsOf(document)).toEqual([]);
    expect(pricingOf(document)).toMatchObject({
      Ordering: { OrderUnit: 'MTR' },
      Pricing: [{ PriceUnit: 'MTR', PriceQuantity: '100', GrossListPrice: '250.00', NetPrice: '225.00', PriceValidityDate: '2026-10-29' }],
    });
  });
  it('τιμή πελάτη: μόνο NetPrice · χωρίς ημερομηνία ισχύος δεν γράφεται PriceValidityDate', () => {
    const price = { unit: 'C62', quantity: 1, grossList: null, net: '99.90' } as const;
    const { document } = buildXChangeDocument(exportInput({ priceValidityDate: null, products: [source({ price })] }));
    expect(errorsOf(document)).toEqual([]);
    expect(pricingOf(document).Pricing).toEqual([{ PriceUnit: 'C62', PriceQuantity: '1', NetPrice: '99.90' }]);
  });
});

describe('επικύρωση αντιστοιχίσεων', () => {
  const base = { code: 'ok', labels: { el: 'Χ' }, description: {}, groupId: 'g', localizable: false, scopable: false, unique: false, orderKey: 'a' };
  const codesOf = (attribute: unknown) => validateAttribute(attribute as CatalogAttributeDefinition, PLATFORM_MEASUREMENT_REGISTRY).map((issue) => `${issue.code}:${issue.path}`);

  it('κακός κωδικός χαρακτηριστικού, ξένη μονάδα, κακή και διπλή τιμή επιλογής', () => {
    const power = measurement('power', 'EF1', 'mm');
    expect(codesOf({ ...base, type: power.type, config: power.config, mappings: power.mappings })).toEqual(expect.arrayContaining(['invalidEtimCode:mappings.etimFeature', 'invalidEtimCode:mappings.etimUnitCode']));
    const options = [{ code: 'a', labels: { el: 'Α' }, etimValue: 'EV1' }, { code: 'b', labels: { el: 'Β' }, etimValue: 'EV000001' }, { code: 'c', labels: { el: 'Γ' }, etimValue: 'EV000001' }];
    const issues = codesOf({ ...base, type: 'select', config: { options }, mappings: MAPPINGS });
    expect(issues).toContain('invalidEtimCode:config.options[0].etimValue');
    expect(issues.some((issue) => issue.endsWith('config.options[2].etimValue'))).toBe(true);
  });
  it('οι σωστές τιμές και οι αδέσμευτες επιλογές περνούν', () => {
    const power = measurement('power', 'EF000001', 'kW');
    expect(codesOf({ ...base, type: power.type, config: power.config, mappings: power.mappings }).filter((code) => code.includes('etim'))).toEqual([]);
    const options = [{ code: 'a', labels: { el: 'Α' } }, { code: 'b', labels: { el: 'Β' } }];
    expect(codesOf({ ...base, type: 'select', config: { options }, mappings: MAPPINGS })).toEqual([]);
  });
  it('κλάση οικογένειας: μόνο η μορφή του σχήματος', () => {
    const family = { code: 'fan', labels: { el: 'Χ' }, description: {}, attributes: [], labelAttributeId: null, imageAttributeId: null, variantSchemes: [], tableSpec: null, consistencyRules: [] };
    const codes = (etimClass: string) => validateFamily({ ...family, etimClass }, new Map(), PLATFORM_MEASUREMENT_REGISTRY).map((issue) => issue.code);
    expect(codes('EC1')).toContain('invalidEtimCode');
    expect(codes('EC011533')).not.toContain('invalidEtimCode');
  });
});

describe('εισαγωγή', () => {
  const exported = buildXChangeDocument(exportInput()).document;

  it('μετ\' επιστροφής: ό,τι βγήκε ξαναμπαίνει, στη μονάδα της κλάσης', () => {
    const { byAttribute, report } = cellsOf(exported);
    expect(byAttribute.get('sku')?.text).toBe('016-15-001');
    expect(byAttribute.get('name')?.text).toBe('Fan coil MFP-15');
    expect(byAttribute.get('name')?.target).toMatchObject({ locale: 'el' });
    expect(byAttribute.get('power')).toMatchObject({ text: '1.8', unitCode: 'kW', confidence: 1 });
    expect(byAttribute.get('color')?.text).toBe('white');
    expect(byAttribute.get('dimmable')?.text).toBe('true');
    expect(report).toMatchObject({ products: 1, imported: 1, otherClassProducts: 0, unmappedFeatures: [] });
  });
  it('χωρίς δηλωμένη μονάδα: `null`, δηλαδή απόφαση ανθρώπου', () => {
    const attributes = ATTRIBUTES.map((attribute) => (attribute.id === 'power' ? measurement('power', 'EF000001', null) : attribute));
    expect(cellsOf(exported, importSchema({ attributes })).byAttribute.get('power')?.unitCode).toBeNull();
  });
  it('άλλη κλάση μένει εκτός και μετριέται', () => {
    const { groups, report } = cellsOf(exported, importSchema({ etimClass: 'EC000000' }));
    expect(groups).toEqual([]);
    expect(report).toMatchObject({ imported: 0, otherClassProducts: 1, otherClasses: ['EC011533'] });
  });
  it('οικογένεια χωρίς κλάση δέχεται την πρώτη κλάση του προϊόντος', () => {
    expect(cellsOf(exported, importSchema({ etimClass: null })).byAttribute.get('power')?.text).toBe('1.8');
  });
  it('στο επίσημο δείγμα οι ιντσικοί δίδυμοι δεν μετρούν ως αδέσμευτοι', () => {
    const { report } = cellsOf(sample20, importSchema({ etimClass: null, attributes: [sku] }));
    expect(report.unmappedFeatures.length).toBeGreaterThan(0);
    expect(report.unmappedFeatures.filter((code) => code.startsWith('EFI'))).toEqual([]);
  });
  it('εύρος με διαφορετικά άκρα δεν μαντεύεται· με ίσα άκρα είναι τιμή', () => {
    const withFeature = (extra: object) => ({
      SchemaVersion: '2.0',
      CatalogueId: 'c',
      Supplier: [{ Product: [{ ProductIdentification: { ManufacturerProductNumber: 'A' }, EtimClassification: [{ EtimClassCode: 'EC011533', EtimFeatures: [{ EtimFeatureCode: 'EF000001', ...extra }] }] }] }],
    });
    const open = cellsOf(withFeature({ EtimValueRangeLower: '1', EtimValueRangeUpper: '2' }));
    expect(open.byAttribute.has('power')).toBe(false);
    expect(open.report.rangeFeatures).toEqual(['EF000001']);
    expect(cellsOf(withFeature({ EtimValueRangeLower: '2', EtimValueRangeUpper: '2' })).byAttribute.get('power')?.text).toBe('2');
  });
  it('η σειρά της μάρκας ομαδοποιεί μόνο σε οικογένεια με παραλλαγές', () => {
    const document = {
      SchemaVersion: '2.0',
      CatalogueId: 'c',
      Supplier: [{ Product: ['A', 'B'].map((code) => ({
        ProductIdentification: { ManufacturerProductNumber: code, BrandDetails: [{ BrandSeries: [{ BrandSeries: 'MFP' }] }] },
        EtimClassification: [{ EtimClassCode: 'EC011533' }],
      })) }],
    };
    expect(cellsOf(document, importSchema({ hasVariants: true })).groups.map((group) => group.modelCode)).toEqual(['MFP']);
    expect(cellsOf(document).groups.map((group) => group.modelCode)).toEqual([null, null]);
  });
});
