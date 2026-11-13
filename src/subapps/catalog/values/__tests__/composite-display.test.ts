/**
 * ADR-923 §21.6 — η σύνθετη ένδειξη «Ηλεκτρική παροχή» = «1~ 230 V 50 Hz» (IEC 61293 §4.2.5 · §4.3.1), από τρεις δομημένες ιδιότητες.
 */
import { FULL_SUPPLY as FULL, SUPPLY, SUPPLY_ATTRIBUTES, VOLTAGE as voltage, supplyCodec as codec } from '../../__tests__/fixtures/power-supply.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CompositeDisplay } from '../../types/family';
import type { AttributeValue } from '../../types/product';
import { displayUnitSymbol } from '../measurement-in-unit';
import { COMPOSITE_MISSING_MARK, composeDisplay, composeDisplayPieces, compositeTemplate, type CompositeSource } from '../composite-display';

const attributeById: ReadonlyMap<string, CatalogAttributeDefinition> = SUPPLY_ATTRIBUTES;

const source = (values: Readonly<Record<string, AttributeValue>>, language: 'el' | 'en' = 'el'): CompositeSource =>
  ({ attributeById, valueOf: (id) => values[id], codec: codec(language) });
const dash = () => COMPOSITE_MISSING_MARK;

describe('§21.6 σύνθετη ένδειξη', () => {
  it('IEC 61293: «1~ 230 V 50 Hz» — σύστημα παροχής πρώτα, αριθμός ␣ σύμβολο μονάδας', () => {
    expect(composeDisplay(SUPPLY, source(FULL), dash)).toEqual({ text: '1~ 230 V 50 Hz', missingAttributeIds: [] });
  });

  it('μονάδα προβολής: 0,4 kV, με υποδιαστολή της γλώσσας (el «,» · en «.»)', () => {
    const kv: CompositeDisplay = { ...SUPPLY, parts: [{ attributeId: 'voltage', displayUnitCode: 'kV', affix: { before: '', after: '' } }] };
    const values = { voltage: { type: 'measurement', amount: '400', unitCode: 'V' } as AttributeValue };
    const decimalVoltage = new Map(attributeById).set('voltage', { ...voltage, config: { ...voltage.config, decimals: 1 } } as CatalogAttributeDefinition);
    expect(composeDisplay(kv, { ...source(values), attributeById: decimalVoltage }, dash).text).toBe('0,4 kV');
    expect(composeDisplay(kv, { ...source(values, 'en'), attributeById: decimalVoltage }, dash).text).toBe('0.4 kV');
  });

  it('🔑 μέρος που λείπει ΔΕΝ συμπτύσσεται: «1~ 230 V —», και ο καλών μαθαίνει ποιο λείπει', () => {
    const { frequency: _omit, ...partial } = FULL;
    expect(composeDisplay(SUPPLY, source(partial), dash)).toEqual({ text: '1~ 230 V —', missingAttributeIds: ['frequency'] });
  });

  it('ο επεξεργαστής ονομάζει την ιδιότητα που λείπει — χωρίς τα σύμβολα του μέρους («~» δεν κολλά σε κενό)', () => {
    const { phases: _omit, ...partial } = FULL;
    expect(composeDisplay(SUPPLY, source(partial), (id) => `[${id}]`).text).toBe('[phases] 230 V 50 Hz');
  });

  it('λείπουν όλα ⇒ κενή ένδειξη, όπως κάθε κενό κελί (όχι «— — —»)', () => {
    expect(composeDisplay(SUPPLY, source({}), dash)).toEqual({ text: '', missingAttributeIds: ['phases', 'voltage', 'frequency'] });
  });

  it('ιδιότητα που δεν υπάρχει στη βιβλιοθήκη μετρά ως κενό, ποτέ επινοημένο κείμενο', () => {
    const ghost: CompositeDisplay = { ...SUPPLY, parts: [...SUPPLY.parts, { attributeId: 'ghost', displayUnitCode: null, affix: { before: '', after: '' } }] };
    expect(composeDisplay(ghost, source(FULL), dash)).toEqual({ text: '1~ 230 V 50 Hz —', missingAttributeIds: ['ghost'] });
  });

  it('διαχωριστής της δήλωσης (Revit «Electrical Connector Separator»): «230 V / 50 Hz»', () => {
    const slash: CompositeDisplay = { ...SUPPLY, separator: ' / ', parts: SUPPLY.parts.slice(1) };
    expect(composeDisplay(slash, source(FULL), dash).text).toBe('230 V / 50 Hz');
  });
});

describe('§21.6 κομμάτια (επεξεργαστής προϊόντος) και πρότυπο (επεξεργαστής οικογένειας)', () => {
  it('το μέρος που λείπει είναι κομμάτι «missing» με την ιδιότητά του — ο επεξεργαστής το κάνει κουμπί', () => {
    const { voltage: _omit, ...partial } = FULL;
    expect(composeDisplayPieces(SUPPLY, source(partial)).pieces).toEqual([
      { kind: 'value', text: '1~' },
      { kind: 'missing', attributeId: 'voltage' },
      { kind: 'value', text: '50 Hz' },
    ]);
  });

  it('ίδια κομμάτια με τη σύνθεση: λείπουν όλα ⇒ κανένα κομμάτι (κενή ένδειξη)', () => {
    expect(composeDisplayPieces(SUPPLY, source({})).pieces).toEqual([]);
  });

  it('πρότυπο: «[Φάσεις]~ [Τάση] V [Συχνότητα]» — σειρά, σύμβολα και μονάδα της δήλωσης, χωρίς προϊόν', () => {
    const names = {
      nameOf: (id: string) => { const attribute = attributeById.get(id); return attribute?.labels.el ?? id; },
      unitSymbolOf: (part: CompositeDisplay['parts'][number]) => {
        const attribute = attributeById.get(part.attributeId);
        return attribute ? displayUnitSymbol(attribute, part.displayUnitCode, PLATFORM_MEASUREMENT_REGISTRY) : null;
      },
    };
    expect(compositeTemplate(SUPPLY, names)).toBe('[Φάσεις]~ [Τάση] V [Συχνότητα]');
    const kv: CompositeDisplay = { ...SUPPLY, separator: ' / ', parts: [{ ...SUPPLY.parts[1], displayUnitCode: 'kV' }] };
    expect(compositeTemplate(kv, names)).toBe('[Τάση] kV');
  });
});
