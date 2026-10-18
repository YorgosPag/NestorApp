/**
 * @fileoverview ADR-915 §35 — **η μόνιμη υποχρέωση του ακινήτου**: πρόταση (κλάση × φάση) · απόφαση · απαίτηση, και ότι
 *   ο ΙΔΙΟΣ πυρήνας (`documentRegistry`) λέει «λείπει» / «τι σταματά» **μόνο** μετά την επιβεβαίωση.
 * @related lib/document-validity/property-upkeep.ts · config/document-validity/document-validity.ts (`standingObligation`)
 *
 * Όλα τα δεδομένα είναι **συνθετικά**.
 */

import {
  DOCUMENT_KINDS,
  STANDING_OBLIGATION_KINDS,
  documentKindSpec,
} from '@/config/document-validity/document-validity';
import {
  documentRegistry,
  matchesRegistryFilter,
  type RegistryDocument,
  type RegistryDocumentRow,
} from '@/lib/document-validity/document-registry';
import {
  followsProposal,
  upkeepItemsOf,
  upkeepProposalOf,
  upkeepRequirementsOf,
  type UpkeepDeclaration,
  type UpkeepProposal,
} from '@/lib/document-validity/property-upkeep';
import { upkeepDeclarationBody } from '@/lib/document-validity/upkeep-declaration-request';

const YDE = 'electrical-installation' as const;
const AS_OF = '2026-10-18';

const IN_USE: UpkeepProposal = { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' };

function declaration(over: Partial<UpkeepDeclaration> = {}): UpkeepDeclaration {
  return {
    propertyId: 'prop_1', documentKind: YDE, decision: 'required', exemptionReason: null,
    proposalAtDecision: IN_USE, declaredByUid: 'user_1', declaredAt: '2026-10-18T09:00:00.000Z', ...over,
  };
}

function yde(printedValidUntil: string | null, propertyId = 'prop_1'): RegistryDocument {
  return {
    id: `file:yde_${propertyId}`, kind: YDE, propertyId, party: null, origin: { kind: 'file', fileId: `yde_${propertyId}` },
    issuedOn: '2022-01-10', printedValidUntil, classification: 'A',
    source: { kind: 'attested', via: 'registry-declaration' }, pinned: false,
  };
}

describe('Π — η πρόταση: κλάση × φάση, πάντα με λόγο', () => {
  it.each([
    ['residential', 'ready', 'proposed', 'in-use'],
    ['commercial', 'maintenance', 'proposed', 'in-use'],
    // `draft` = η ΠΡΟΕΠΙΛΟΓΗ κάθε νέας μονάδας, όχι «άκτιστο» ⇒ προτείνεται, με τον λόγο ότι η φάση δεν δηλώθηκε.
    ['residential', 'draft', 'proposed', 'phase-undeclared'],
    ['residential', null, 'proposed', 'phase-undeclared'],
    ['residential', 'σκουπίδι', 'proposed', 'phase-undeclared'],
    ['residential', 'under-construction', 'not-proposed', 'phase'],
    ['residential', 'underConstruction', 'not-proposed', 'phase'],
    ['commercial', 'inspection', 'not-proposed', 'phase'],
    ['land', 'ready', 'not-proposed', 'class'],
    [null, 'ready', 'undetermined', 'class-unknown'],
  ] as const)('%s × %s ⇒ %s (%s)', (propertyClass, phase, verdict, reason) => {
    expect(upkeepProposalOf(YDE, { propertyClass, phase })).toMatchObject({ verdict, reason, propertyClass });
  });

  it('η φάση κανονικοποιείται ΕΔΩ — το ίχνος κρατά την κανονική τιμή, ποτέ την ωμή', () => {
    expect(upkeepProposalOf(YDE, { propertyClass: 'residential', phase: 'underConstruction' }).phase).toBe('under-construction');
    expect(upkeepProposalOf(YDE, { propertyClass: 'residential', phase: 42 }).phase).toBeNull();
  });
});

describe('Ν — ο νόμος αποφασίζει ποιο είδος είναι μόνιμη υποχρέωση', () => {
  it('σήμερα ΜΟΝΟ η ΥΔΕ· το ΠΕΑ γεννιέται από πράξη (πώληση · μίσθωση · αγγελία), όχι από το ακίνητο', () => {
    expect(STANDING_OBLIGATION_KINDS).toEqual([YDE]);
    expect(documentKindSpec('energy-certificate').standingObligation).toBeNull();
    expect(upkeepProposalOf('energy-certificate', { propertyClass: 'residential', phase: 'ready' })).toMatchObject({ verdict: 'not-proposed' });
  });

  it.each(DOCUMENT_KINDS.filter((kind) => documentKindSpec(kind).standingObligation !== null))(
    'άγκυρα: η μόνιμη υποχρέωση `%s` έχει διάταξη, και ΠΟΤΕ δεν προτείνεται σε οικόπεδο',
    (kind) => {
      const obligation = documentKindSpec(kind).standingObligation;
      expect(obligation?.statute.trim().length).toBeGreaterThan(0);
      expect(obligation?.proposedFor.length).toBeGreaterThan(0);
      expect(obligation?.proposedFor).not.toContain('land');
    },
  );
});

describe('Α — μόνο η επιβεβαίωση γίνεται απαίτηση', () => {
  it('`required` ⇒ μία απαίτηση `warn`, διαρκής, `required`, με βάση τη διάταξη + ποιος/πότε', () => {
    const [requirement, ...rest] = upkeepRequirementsOf([declaration()]);
    expect(rest).toEqual([]);
    expect(requirement).toMatchObject({
      documentKind: YDE,
      subject: { propertyId: 'prop_1', party: null },
      process: { kind: 'property-upkeep', propertyId: 'prop_1' },
      neededOn: { kind: 'continuous' },
      policy: 'warn',
      presence: 'required',
      warnWindowDays: 30,
      attestation: null,
      basis: { kind: 'standing-obligation', declaredByUid: 'user_1', declaredAt: '2026-10-18T09:00:00.000Z' },
    });
  });

  it('εξαίρεση ⇒ ΚΑΜΙΑ απαίτηση', () => {
    expect(upkeepRequirementsOf([declaration({ decision: 'not-required', exemptionReason: 'no-own-supply' })])).toEqual([]);
  });

  it('απόφαση για είδος που δεν είναι πια μόνιμη υποχρέωση ⇒ καμία απαίτηση (ο κατάλογος κρίνει, όχι ο δίσκος)', () => {
    expect(upkeepRequirementsOf([declaration({ documentKind: 'energy-certificate' })])).toEqual([]);
  });
});

describe('Μ — ο ΙΔΙΟΣ πυρήνας: «λείπει» και «τι σταματά» μόνο μετά την επιβεβαίωση', () => {
  it('🔑 χωρίς απόφαση (μόνο πρόταση) ⇒ ΚΑΝΕΝΑ κενό — καμία ψευδής κόκκινη', () => {
    const registry = documentRegistry({ documents: [], requirements: upkeepRequirementsOf([]), asOf: AS_OF });
    expect(registry.rows).toEqual([]);
    expect(registry.tally.missing).toBe(0);
  });

  it('επιβεβαιωμένη χωρίς ΥΔΕ ⇒ ΕΝΑ κενό `missing`, που ΔΕΝ μπλοκάρει (ο νόμος βαραίνει τον ιδιοκτήτη, δεν σταματά πράξη)', () => {
    const registry = documentRegistry({ documents: [], requirements: upkeepRequirementsOf([declaration()]), asOf: AS_OF });
    expect(registry.rows).toHaveLength(1);
    const [gap] = registry.rows;
    expect(gap).toMatchObject({ kind: 'gap', state: 'missing', blocking: false, gap: { kind: YDE, propertyId: 'prop_1' } });
    expect(matchesRegistryFilter(gap, 'missing', AS_OF)).toBe(true);
    expect(matchesRegistryFilter(gap, 'blocking', AS_OF)).toBe(false);
  });

  it('ΥΔΕ που έληξε ⇒ η μόνιμη υποχρέωση «σταματά» από τη λήξη + 1, και πάλι ΔΕΝ μπλοκάρει', () => {
    const registry = documentRegistry({ documents: [yde('2026-09-30')], requirements: upkeepRequirementsOf([declaration()]), asOf: AS_OF });
    const row = registry.rows.find((r): r is RegistryDocumentRow => r.kind === 'document');
    expect(row?.state).toBe('expired');
    expect(row?.blocking).toBe(false);
    expect(row?.dependents).toEqual([
      expect.objectContaining({ impact: 'stops', stopsOn: '2026-10-01', requirement: expect.objectContaining({ policy: 'warn' }) }),
    ]);
  });

  it('ΥΔΕ άλλου ακινήτου ΔΕΝ καλύπτει την υποχρέωση — το κενό μένει', () => {
    const registry = documentRegistry({ documents: [yde('2030-01-01', 'prop_2')], requirements: upkeepRequirementsOf([declaration()]), asOf: AS_OF });
    expect(registry.rows.filter((row) => row.kind === 'gap')).toHaveLength(1);
  });
});

describe('Ο — η ενότητα: ό,τι περιμένει απόφαση και ό,τι αποφασίστηκε', () => {
  const subjects = [
    { propertyId: 'prop_1', propertyClass: 'residential', phase: 'ready' },
    { propertyId: 'plot_1', propertyClass: 'land', phase: null },
    { propertyId: 'unk_1', propertyClass: null, phase: null },
    { propertyId: 'site_1', propertyClass: 'residential', phase: 'under-construction' },
  ] as const;

  it('προτείνεται ⇒ περιμένει · άγνωστο είδος ⇒ περιμένει (το λέει) · οικόπεδο / υπό κατασκευή χωρίς απόφαση ⇒ σιωπή', () => {
    const items = upkeepItemsOf(subjects, []);
    expect(items.map((item) => [item.propertyId, item.proposal.verdict, item.declaration])).toEqual([
      ['prop_1', 'proposed', null],
      ['unk_1', 'undetermined', null],
    ]);
  });

  it('απόφαση σε ακίνητο που δεν προτείνεται ⇒ φαίνεται (μπορεί να αναιρεθεί), με την πρόταση ΣΗΜΕΡΑ', () => {
    const exempt = declaration({ propertyId: 'plot_1' });
    const items = upkeepItemsOf(subjects, [exempt]);
    expect(items.find((item) => item.propertyId === 'plot_1')).toMatchObject({ declaration: exempt, proposal: { verdict: 'not-proposed' } });
  });

  it('`followsProposal`: δέχτηκε · παρέκαμψε · η εφαρμογή δεν ήξερε', () => {
    expect(followsProposal(declaration())).toBe(true);
    expect(followsProposal(declaration({ decision: 'not-required', exemptionReason: 'other' }))).toBe(false);
    expect(followsProposal(declaration({ proposalAtDecision: { ...IN_USE, verdict: 'undetermined', reason: 'class-unknown' } }))).toBeNull();
  });
});

describe('Σ — το σχήμα του αιτήματος: εξαίρεση ΠΑΝΤΑ με λόγο, επιβεβαίωση ΠΟΤΕ', () => {
  const body = { propertyId: 'prop_1', documentKind: YDE };
  it.each([
    [{ decision: 'required', exemptionReason: null }, true],
    [{ decision: 'not-required', exemptionReason: 'not-connected' }, true],
    [{ decision: null, exemptionReason: null }, true],
    [{ decision: 'not-required', exemptionReason: null }, false],
    [{ decision: 'required', exemptionReason: 'other' }, false],
    [{ decision: 'maybe', exemptionReason: null }, false],
  ] as const)('%j ⇒ %s', (decision, ok) => {
    expect(upkeepDeclarationBody.safeParse({ ...body, ...decision }).success).toBe(ok);
  });
});
