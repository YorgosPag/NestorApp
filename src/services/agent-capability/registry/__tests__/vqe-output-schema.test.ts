/**
 * Το σχήμα εξόδου είναι χειρόγραφος καθρέφτης του `types/vqe/envelope.ts`.
 * Εδώ δένεται με **πραγματικό** φάκελο που παράγει το `buildEnvelope()`: αν
 * προστεθεί ή αφαιρεθεί πεδίο στον φάκελο και ξεχαστεί το σχήμα, σπάει εδώ.
 *
 * ⚠️ Όριο: συγκρίνονται **κλειδιά**, όχι τύποι. Δηλώνεται ρητά αντί να
 * υπονοείται πληρότητα που δεν υπάρχει (ADR-734 §6.6, «ειλικρίνεια ορίων»).
 *
 * @module services/agent-capability/registry/__tests__/vqe-output-schema
 * @see ADR-734 §6.2
 */

import { PROVENANCE_ACTIVITIES } from '@/types/vqe';
import { buildEnvelope } from '../../vqe';
import { makeItem } from '../../vqe/__tests__/vqe-test-fixtures';
import { type JsonSchema, vqeOutputSchema } from '../index';

const VALUE_SCHEMA: JsonSchema = { type: 'number', description: 'δοκιμαστικό φορτίο' };
const SCHEMA = vqeOutputSchema(VALUE_SCHEMA);

/** Ένας φάκελος με ΟΛΑ τα προαιρετικά μέρη γεμάτα (drift + ανάμεικτες καταστάσεις). */
const ENVELOPE = buildEnvelope({
  value: 42,
  sourceItems: [
    makeItem({ id: 'a', status: 'certified', liveQuantity: 120, liveQuantitySyncedAt: '2026-07-01T00:00:00.000Z' }),
    makeItem({ id: 'b', status: 'draft' }),
  ],
  computedBy: 'cost-engine.computeBuildingSummary',
  params: { probe: true },
});

function propertyKeys(schema: JsonSchema | undefined): string[] {
  return Object.keys(schema?.properties ?? {});
}

describe('vqeOutputSchema — τα κλειδιά ταιριάζουν με πραγματικό φάκελο', () => {
  it('ρίζα', () => {
    expect(propertyKeys(SCHEMA)).toEqual(Object.keys(ENVELOPE));
  });

  it.each(['basis', 'provenance', 'governance', 'integrity'])('%s', (section) => {
    const sub = SCHEMA.properties?.[section];
    const actual = ENVELOPE[section as 'basis' | 'provenance' | 'governance' | 'integrity'];
    expect(propertyKeys(sub)).toEqual(Object.keys(actual));
  });

  it('statusBreakdown — και τα πέντε κλειδιά κύκλου ζωής', () => {
    const breakdown = SCHEMA.properties?.governance.properties?.statusBreakdown;
    expect(propertyKeys(breakdown)).toEqual(Object.keys(ENVELOPE.governance.statusBreakdown));
  });

  it('baselineDrift — nullable αντικείμενο με τα ίδια πεδία', () => {
    const drift = SCHEMA.properties?.governance.properties?.baselineDrift;
    expect(drift?.type).toEqual(['object', 'null']);
    expect(ENVELOPE.governance.baselineDrift).not.toBeNull();
    expect(propertyKeys(drift)).toEqual(Object.keys(ENVELOPE.governance.baselineDrift ?? {}));
  });

  it('το ωφέλιμο φορτίο μπαίνει αυτούσιο στη θέση `value`', () => {
    expect(SCHEMA.properties?.value).toBe(VALUE_SCHEMA);
  });

  it('το enum της δραστηριότητας καλύπτει την πραγματική τιμή του φακέλου', () => {
    const computedBy = SCHEMA.properties?.provenance.properties?.computedBy;
    expect(computedBy?.enum).toEqual([...PROVENANCE_ACTIVITIES]);
    expect(computedBy?.enum).toContain(ENVELOPE.provenance.computedBy);
  });

  it('οι προειδοποιήσεις που ΟΝΤΩΣ παρήχθησαν καλύπτονται από κάποιο κλάδο του anyOf', () => {
    const branches = SCHEMA.properties?.provenance.properties?.warnings.items?.anyOf ?? [];
    expect(ENVELOPE.provenance.warnings.length).toBeGreaterThan(0);

    for (const warning of ENVELOPE.provenance.warnings) {
      const covered = branches.some((branch) =>
        Object.keys(warning).every((key) => propertyKeys(branch).includes(key)));
      expect(covered).toBe(true);
    }
  });
});
