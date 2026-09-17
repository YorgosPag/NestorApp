/**
 * ADR-867 §7 — ΑΓΚΥΡΕΣ του **κριτή ακμής** (Β2).
 *
 *   Α1  Άγνωστος (χωρίς ακμή) ⇒ `none` — ο κριτής **δεν** λέει πάντα «ναι»
 *   Α2  🔴 Ο πυρήνας **δεν ξέρει** για εντολές: **ψεύτικη** δεύτερη πηγή ανοίγει ακμή χωρίς
 *       αλλαγή στον κριτή· και το αρχείο του κριτή **δεν εισάγει** τίποτα από πράξεις
 *   Ε1  «Αποδεκτή» = `confirmed` — `pending`/`declined` ⇒ καμία ακμή
 *   Ε2  Τρέχουσα **ή παλιά** (α) ①: ληγμένη **και** ανακληθείσας άδειας ⇒ ακμή μένει
 *   Ε3  Ιδιοκτήτης χωρίς λογαριασμό · έγγραφο χωρίς γραφείο ⇒ καμία ακμή, ποτέ μαντεψιά
 *   Ε4  Ζωντανό σχήμα: ενικό `mandate` διαβάζεται
 *   Ε5  Ίδια πράξη δύο φορές ⇒ **μία** ακμή · κενά άκρα ⇒ `none`
 *   Ε6  Το μητρώο καλύπτει **ακριβώς** το `NETWORK_ACT_KINDS`
 */

import * as fs from 'fs';
import * as path from 'path';

import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { judgeEdge, type EdgeProjectors, type NetworkEdge } from '@/lib/network-edge/edge-judge';
import {
  EDGE_SOURCES,
  judgeNetworkEdge,
  mandateEdgesOf,
  type NetworkEdgeEvidence,
} from '@/lib/network-edge/edge-sources';
import { NETWORK_ACT_KINDS } from '@/types/network-thread';

const OWNER = 'uid_owner';
const AGENCY = 'comp_alfa';
const ENDS = { personUid: OWNER, companyId: AGENCY };

function mandateEvidence(
  mandate: Parameters<typeof brokeredMandate>[0],
  propertyId = 'ownp_1',
): NetworkEdgeEvidence {
  return { kind: 'mandate', payload: { propertyId, mandates: [brokeredMandate(mandate)] } };
}

const ACCEPTED = { confirmation: 'confirmed', confirmedByUserId: OWNER } as const;

// ============================================================================
describe('Α1 — άγνωστος δεν έχει ακμή', () => {
  it('χωρίς τεκμήρια ⇒ none', () => {
    expect(judgeNetworkEdge([], ENDS)).toEqual({ kind: 'none' });
  });

  it('ακμή υπάρχει, αλλά για ΑΛΛΟ πρόσωπο ή ΑΛΛΟ χώρο ⇒ none', () => {
    const evidence = [mandateEvidence(ACCEPTED)];
    expect(judgeNetworkEdge(evidence, { personUid: 'uid_stranger', companyId: AGENCY }).kind).toBe('none');
    expect(judgeNetworkEdge(evidence, { personUid: OWNER, companyId: 'comp_beta' }).kind).toBe('none');
  });

  it('αποδεκτή εντολή ⇒ connected, με το θέμα της πράξης', () => {
    expect(judgeNetworkEdge([mandateEvidence(ACCEPTED)], ENDS)).toEqual({
      kind: 'connected',
      edges: [{ actKind: 'mandate', actSeed: 'ownp_1:comp_alfa', hostCompanyId: AGENCY, counterpartUid: OWNER }],
    });
  });
});

// ============================================================================
describe('Α2 🔴 ο πυρήνας δεν ξέρει τι είναι εντολή', () => {
  interface FakeParticipation {
    readonly caseId: string;
    readonly hostCompanyId: string;
    readonly guestUid: string;
  }
  interface FakeEvidenceByKind {
    readonly participation: FakeParticipation;
  }
  const FAKE_SOURCES: EdgeProjectors<FakeEvidenceByKind> = {
    participation: (p): readonly NetworkEdge<'participation'>[] => [
      { actKind: 'participation', actSeed: p.caseId, hostCompanyId: p.hostCompanyId, counterpartUid: p.guestUid },
    ],
  };

  it('ψεύτικη δεύτερη πηγή ανοίγει ακμή ΧΩΡΙΣ καμία αλλαγή στον κριτή', () => {
    const verdict = judgeEdge(
      [{ kind: 'participation', payload: { caseId: 'case_9', hostCompanyId: AGENCY, guestUid: OWNER } }],
      ENDS,
      FAKE_SOURCES,
    );
    expect(verdict).toEqual({
      kind: 'connected',
      edges: [{ actKind: 'participation', actSeed: 'case_9', hostCompanyId: AGENCY, counterpartUid: OWNER }],
    });
  });

  it('το αρχείο του κριτή δεν εισάγει τίποτα — ούτε εντολές, ούτε μητρώο, ούτε υπηρεσίες', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'edge-judge.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });

  it('πηγή που αφήνει κενό άκρο ΔΕΝ ταιριάζει με κενή ερώτηση — ο κριτής φυλάει μόνος του', () => {
    const verdict = judgeEdge(
      [{ kind: 'participation', payload: { caseId: 'case_9', hostCompanyId: '', guestUid: '' } }],
      { personUid: '', companyId: '' },
      FAKE_SOURCES,
    );
    expect(verdict.kind).toBe('none');
  });
});

// ============================================================================
describe('Ε — η πηγή «εντολή»', () => {
  it('Ε1 pending / declined ⇒ καμία ακμή', () => {
    expect(mandateEdgesOf({ propertyId: 'ownp_1', mandates: [brokeredMandate({ confirmedByUserId: OWNER })] })).toEqual([]);
    expect(
      mandateEdgesOf({
        propertyId: 'ownp_1',
        mandates: [brokeredMandate({ confirmation: 'declined', confirmedByUserId: OWNER })],
      }),
    ).toEqual([]);
  });

  it('Ε2 ληγμένη ΚΑΙ ανακληθείσας άδειας ⇒ η ακμή ΜΕΝΕΙ (α) ①', () => {
    const evidence = [
      mandateEvidence({ ...ACCEPTED, expiresAt: '2020-01-01T00:00:00.000Z', agencyRevokedAt: '2021-01-01T00:00:00.000Z' }),
    ];
    expect(judgeNetworkEdge(evidence, ENDS).kind).toBe('connected');
  });

  it('Ε3 ιδιοκτήτης χωρίς λογαριασμό · εντολή χωρίς γραφείο ⇒ καμία ακμή', () => {
    expect(mandateEdgesOf({ propertyId: 'ownp_1', mandates: [brokeredMandate({ confirmation: 'confirmed' })] })).toEqual([]);
    expect(
      mandateEdgesOf({ propertyId: 'ownp_1', mandates: [brokeredMandate({ ...ACCEPTED, agencyCompanyId: '  ' })] }),
    ).toEqual([]);
    expect(mandateEdgesOf({ propertyId: '', mandates: [brokeredMandate(ACCEPTED)] })).toEqual([]);
  });

  it('Ε4 ζωντανό σχήμα: ενικό `mandate` · `self` ⇒ καμία ακμή', () => {
    expect(mandateEdgesOf({ propertyId: 'ownp_1', mandate: brokeredMandate(ACCEPTED) })).toHaveLength(1);
    expect(mandateEdgesOf({ propertyId: 'ownp_1', mandate: { kind: 'self' } })).toEqual([]);
  });

  it('Ε4β δύο γραφεία στην ίδια αγγελία ⇒ δύο ακμές, δύο σπόροι', () => {
    const edges = mandateEdgesOf({
      propertyId: 'ownp_1',
      mandates: [brokeredMandate(ACCEPTED), brokeredMandate({ ...ACCEPTED, agencyCompanyId: 'comp_beta' })],
    });
    expect(edges.map((edge) => edge.actSeed)).toEqual(['ownp_1:comp_alfa', 'ownp_1:comp_beta']);
  });
});

// ============================================================================
describe('Ε5 — ιδεμποτησία και κενά άκρα', () => {
  it('η ίδια πράξη από δύο τεκμήρια ⇒ ΜΙΑ ακμή', () => {
    const verdict = judgeNetworkEdge([mandateEvidence(ACCEPTED), mandateEvidence(ACCEPTED)], ENDS);
    expect(verdict.kind === 'connected' && verdict.edges).toHaveLength(1);
  });

  it('κενό πρόσωπο ή κενός χώρος ΔΕΝ ταιριάζει με κενό πεδίο ⇒ none', () => {
    const evidence = [mandateEvidence(ACCEPTED)];
    expect(judgeNetworkEdge(evidence, { personUid: ' ', companyId: AGENCY }).kind).toBe('none');
    expect(judgeNetworkEdge(evidence, { personUid: OWNER, companyId: '' }).kind).toBe('none');
  });
});

// ============================================================================
describe('Ε6 — το μητρώο είναι το κλειστό σύνολο', () => {
  it('κλειδιά EDGE_SOURCES === NETWORK_ACT_KINDS', () => {
    expect(Object.keys(EDGE_SOURCES).sort()).toEqual([...NETWORK_ACT_KINDS].sort());
  });
});
