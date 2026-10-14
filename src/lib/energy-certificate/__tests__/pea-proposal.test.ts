/**
 * ⚓ ADR-777 §8.96 — από το διαβασμένο ΠΕΑ στην πρόταση: σημαίες αντί για σιωπή, ολόκληρη αντικατάσταση, προέλευση.
 */

import { UNDECLARED_ENERGY_CERTIFICATE, applyEnergyCertificatePatch, type EnergyCertificate } from '../energy-certificate';
import { peaPatchOf, peaProposalOf, settledClassOf, type PeaProposalContext } from '../pea-proposal';
import { readPeaText, type PeaReading } from '../pea-text';
import { SYNTHETIC_PEA, peaPagesJoined, type SyntheticPea } from './pea-text.fixture';

function readingOf(pea: SyntheticPea = SYNTHETIC_PEA): PeaReading {
  const result = readPeaText(peaPagesJoined(pea));
  if (result.kind !== 'read') throw new Error('αναμενόταν ανάγνωση');
  return result.reading;
}

const CONTEXT: PeaProposalContext = {
  fileId: 'file_pea_new',
  current: UNDECLARED_ENERGY_CERTIFICATE,
  propertyArea: 80,
  today: '2026-10-14',
};

describe('Π1 — η κλάση: από τον λόγο, ή από τον άνθρωπο', () => {
  it('84,0 / 120,0 = 0,70 ⇒ Β+ χωρίς ερώτηση', () => {
    const proposal = peaProposalOf(readingOf(), CONTEXT);
    expect(settledClassOf(proposal)).toBe('B+');
    expect(proposal.flags).not.toContain('class-ambiguous');
  });

  it('🔴 λόγος πάνω σε όριο ⇒ καμία προεπιλογή + σημαία', () => {
    const proposal = peaProposalOf(readingOf({ ...SYNTHETIC_PEA, primary: '60.0' }), CONTEXT);
    expect(settledClassOf(proposal)).toBeNull();
    expect(proposal.flags).toContain('class-ambiguous');
  });

  it('χωρίς RR ⇒ «δεν διαβάζεται» + σημαία', () => {
    const proposal = peaProposalOf(readingOf({ ...SYNTHETIC_PEA, reference: '' }), CONTEXT);
    expect(proposal.classResult).toEqual({ kind: 'invalid' });
    expect(proposal.flags).toEqual(expect.arrayContaining(['class-unreadable', 'incomplete']));
  });
});

describe('Π2 — η εμβέλεια: μόνο από μέτρηση εμβαδού, και ο άνθρωπος επιβεβαιώνει', () => {
  it.each([
    [80, 'unit', []],
    [40, 'building', ['building-suspected']],
    [60, null, ['area-mismatch']],
    [null, null, []],
  ] as const)('εμβαδόν ακινήτου %s ⇒ %s', (propertyArea, scope, flags) => {
    const proposal = peaProposalOf(readingOf(), { ...CONTEXT, propertyArea });
    expect(proposal.suggestedScope).toBe(scope);
    expect(proposal.flags).toEqual(flags);
  });
});

describe('Π3 — προειδοποιήσεις για «ίσως λάθος έγγραφο»', () => {
  it('ληγμένο', () => {
    expect(peaProposalOf(readingOf(), { ...CONTEXT, today: '2036-03-02' }).flags).toContain('expired');
  });

  it('🔴 παλαιότερο από το τρέχον (Α ΠΕΑ πάνω από Β ΠΕΑ)', () => {
    const current: EnergyCertificate = { ...UNDECLARED_ENERGY_CERTIFICATE, class: 'B', issuedOn: '2026-07-16' };
    expect(peaProposalOf(readingOf(), { ...CONTEXT, current }).flags).toContain('older-than-current');
  });
});

describe('Π4 — η διόρθωση που εφαρμόζεται', () => {
  const proposal = peaProposalOf(readingOf(), CONTEXT);

  it('ολόκληρο μπλοκ, με προέλευση, περασμένο από το σχήμα', () => {
    expect(peaPatchOf(proposal, { class: 'B+', scope: 'unit' })).toEqual({
      class: 'B+',
      primaryEnergy: 84,
      co2Emissions: 21.5,
      issuedOn: '2026-03-01',
      usefulArea: 84,
      finalEnergy: [
        { source: 'electricity', perSqm: 21 },
        { source: 'solar', perSqm: 9.5 },
      ],
      scope: 'unit',
      sourceFileId: 'file_pea_new',
      absence: null,
    });
  });

  it('🔴 ένα ΠΕΑ αντικαθιστά ΟΛΟΚΛΗΡΟ το μπλοκ: ό,τι δεν διάβασε σβήνει τα παλιά (καμία ανάμειξη πιστοποιητικών)', () => {
    const old: EnergyCertificate = {
      ...UNDECLARED_ENERGY_CERTIFICATE,
      class: 'D',
      finalEnergy: [{ source: 'oil', perSqm: 120 }],
      sourceFileId: 'file_pea_old',
    };
    const noTable = peaProposalOf(readingOf({ ...SYNTHETIC_PEA, rows: {} }), { ...CONTEXT, current: old });
    const patch = peaPatchOf(noTable, { class: 'B+', scope: 'unit' });
    expect(patch).not.toBeNull();
    expect(applyEnergyCertificatePatch(old, patch!)).toMatchObject({ finalEnergy: null, sourceFileId: 'file_pea_new' });
  });
});
