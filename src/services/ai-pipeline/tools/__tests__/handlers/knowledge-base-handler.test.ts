/**
 * KNOWLEDGE BASE HANDLER TESTS
 *
 * Tests search_knowledge_base πάνω στον ΠΡΑΓΜΑΤΙΚΟ κατάλογο δικαιολογητικών (ADR-901 §2 Ε-Α):
 * αντιστοίχιση διαδικασιών, ονόματα από το i18n, διαθεσιμότητα μέσω του ίδιου συλλέκτη/matcher
 * με την υπόθεση μεταβίβασης, ορατότητα αγοραστή, σφάλμα Firestore.
 *
 * Mock ΜΟΝΟ οι αναγνώσεις (υποκείμενο + αρχεία) — ο κατάλογος και ο matcher τρέχουν αληθινά.
 *
 * @see ADR-171 (Autonomous AI Agent) · ADR-901 (κατάλογος)
 * @module __tests__/handlers/knowledge-base-handler
 */

import '../setup';

import { KnowledgeBaseHandler } from '../../handlers/knowledge-base-handler';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';
import type { EvidenceFile } from '@/types/conveyance-case';

jest.mock('@/services/conveyance/conveyance-subject.server', () => ({
  loadConveyanceSubject: jest.fn(async (_db: unknown, _companyId: string, propertyId: string) => ({
    propertyName: 'Δ3',
    projectId: 'proj_001',
    subject: { kind: 'property', propertyId, buildingId: 'bld_001', projectId: 'proj_001', appurtenances: [] },
    parties: { sellers: [{ key: 'cont_seller', contactId: 'cont_seller', kind: 'legal_entity', capacity: 'principal' }], buyers: [{ contactId: 'cont_001' }] },
    factSources: { profile: 'new_build_company', propertyType: 'apartment', appurtenanceCount: 0, landownerCount: 0 },
    legalPhase: null,
  })),
}));

jest.mock('@/services/conveyance/conveyance-evidence.server', () => {
  const actual = jest.requireActual('@/services/conveyance/conveyance-evidence.server');
  return { ...actual, collectEvidenceForTargets: jest.fn(async () => []) };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { collectEvidenceForTargets, evidenceOfFile } = require('@/services/conveyance/conveyance-evidence.server') as {
  collectEvidenceForTargets: jest.Mock;
  evidenceOfFile: (companyId: string, fileId: string, data: Record<string, unknown>, targets: unknown, audience: unknown) => EvidenceFile[];
};

type KbDoc = { name: string; source: string; sourceLabel: string; availableInSystem: boolean };
type KbData = { procedures: Array<{ id: string; title: string; requiredDocuments: KbDoc[] }> };

function evidence(overrides: Partial<EvidenceFile>): EvidenceFile {
  return {
    fileId: 'file_1', displayName: 'x.pdf', entityType: 'project', entityId: 'proj_001', purpose: 'permit',
    source: { kind: 'owned' }, level: 'project', fingerprint: 'file_1:0:', createdAt: '2026-09-01T00:00:00Z', documentFacts: null, ...overrides,
  };
}

const buyerCtx = () => createCustomerContext({
  contactMeta: {
    contactId: 'cont_001',
    displayName: 'Test User',
    firstName: 'Test',
    primaryPersona: 'tenant',
    linkedPropertyIds: ['unit_001'],
    projectRoles: [],
  },
});

function docNamed(data: KbData, name: string): KbDoc | undefined {
  return data.procedures.flatMap((p) => p.requiredDocuments).find((doc) => doc.name === name);
}

const CDE_ACT = { by: 'uid_engineer', at: '2026-09-01T00:00:00Z', revision: 1 };
const PERMIT = 'Οικοδομική άδεια και αναθεωρήσεις';

/** Ένα αρχείο άδειας του έργου σε κατάσταση CDE — κρίνεται από τον ΠΡΑΓΜΑΤΙΚΟ μετασχηματισμό/κριτή, με το ακροατήριο που πέρασε ο handler. */
function permitFileIn(cde: Record<string, unknown>): void {
  const raw = { companyId: 'comp_test_001', status: 'ready', entityType: 'project', entityId: 'proj_001', purpose: 'permit', revision: 1, ...cde };
  collectEvidenceForTargets.mockImplementation(async (_db: unknown, _companyId: string, targets: unknown, audience: unknown) =>
    evidenceOfFile('comp_test_001', 'file_cde', raw, targets, audience));
}

async function permitAvailableFor(ctx: ReturnType<typeof createCustomerContext>): Promise<boolean | undefined> {
  const result = await new KnowledgeBaseHandler().execute('search_knowledge_base', { query: 'συμβολαιογράφο' }, { ...ctx, companyId: 'comp_test_001' });
  return docNamed(result.data as KbData, PERMIT)?.availableInSystem;
}

describe('KnowledgeBaseHandler', () => {
  let handler: KnowledgeBaseHandler;

  beforeEach(() => {
    handler = new KnowledgeBaseHandler();
    collectEvidenceForTargets.mockReset();
    collectEvidenceForTargets.mockResolvedValue([]);
  });

  it('returns error for empty query', async () => {
    const result = await handler.execute('search_knowledge_base', { query: '' }, createAdminContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('returns error for unknown tool name', async () => {
    const result = await handler.execute('unknown_tool', { query: 'test' }, createAdminContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown');
  });

  it('returns suggestion when no procedures match', async () => {
    const result = await handler.execute('search_knowledge_base', { query: 'xyz' }, createAdminContext());
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    const data = result.data as Record<string, unknown>;
    expect(data.message).toContain('Δεν βρέθηκε');
    expect(data.suggestion).toBeDefined();
  });

  it('η διαδικασία και τα έγγραφά της έρχονται από τον κατάλογο + το i18n (όχι σκληροκωδικοποιημένα)', async () => {
    const result = await handler.execute('search_knowledge_base', { query: 'συμβολαιογράφο' }, buyerCtx());
    const data = result.data as KbData;
    expect(data.procedures[0].id).toBe('final_contract');
    expect(data.procedures[0].title).toBe('Οριστικό Συμβόλαιο Αγοραπωλησίας');
    expect(docNamed(data, 'Οικοδομική άδεια και αναθεωρήσεις')).toBeDefined();
  });

  it('limits results to top 2 procedures', async () => {
    const result = await handler.execute('search_knowledge_base', { query: 'συμβόλαιο μεταβίβαση δάνειο προσύμφωνο' }, createAdminContext());
    expect(result.count).toBe(2);
  });

  it('αρχείο έργου με purpose permit ⇒ η άδεια είναι «Διαθέσιμο στο σύστημα» (ο ίδιος matcher με την υπόθεση)', async () => {
    collectEvidenceForTargets.mockResolvedValue([evidence({})]);
    const result = await handler.execute('search_knowledge_base', { query: 'συμβολαιογράφο' }, buyerCtx());
    const permit = docNamed(result.data as KbData, 'Οικοδομική άδεια και αναθεωρήσεις');
    expect(permit?.availableInSystem).toBe(true);
    expect(permit?.sourceLabel).toBe('Διαθέσιμο στο σύστημα');
  });

  it('🔒 προσωπικό έγγραφο ΠΩΛΗΤΗ δεν «επιβεβαιώνεται» στον πελάτη, ακόμη κι αν υπάρχει (ADR-901 §5.10)', async () => {
    collectEvidenceForTargets.mockResolvedValue([
      evidence({ level: 'seller_contact', entityType: 'contact', entityId: 'cont_seller', purpose: 'tax-clearance' }),
    ]);
    const result = await handler.execute('search_knowledge_base', { query: 'συμβολαιογράφο' }, buyerCtx());
    expect(docNamed(result.data as KbData, 'Φορολογική ενημερότητα πωλητή')?.availableInSystem).toBe(false);
  });

  it('ψάχνει στην ιεραρχία του συνδεδεμένου ακινήτου (ακίνητο + κτίριο + έργο + επαφές)', async () => {
    await handler.execute('search_knowledge_base', { query: 'συμβολαιογράφο' }, buyerCtx());
    const targets = collectEvidenceForTargets.mock.calls[0][2] as Array<{ level: string; entityId: string }>;
    expect(targets.map((t) => `${t.level}:${t.entityId}`)).toEqual(expect.arrayContaining([
      'property:unit_001', 'building:bld_001', 'project:proj_001', 'buyer_contact:cont_001',
    ]));
  });

  describe('🔐 εμβέλεια CDE (ADR-901 Φ2): ο θεατής κρίνεται από την ταυτότητά του', () => {
    const internalCtx = () => createAdminContext({ contactMeta: buyerCtx().contactMeta });

    it.each([
      ['WIP', { cdeState: 'WIP', cdeTeamId: 'team_eng' }],
      ['SHARED', { cdeState: 'SHARED', cdeShare: CDE_ACT }],
      ['SUPERSEDED', { cdeState: 'SUPERSEDED', supersededByFileId: 'file_next' }],
      ['πλαστό PUBLISHED χωρίς πράξεις', { cdeState: 'PUBLISHED' }],
    ])('αγοραστής + %s ⇒ δεν μετρά ως «υπάρχει»', async (_name, cde) => {
      permitFileIn(cde);
      expect(await permitAvailableFor(buyerCtx())).toBe(false);
    });

    it.each([
      ['PUBLISHED', { cdeState: 'PUBLISHED', cdeSeal: CDE_ACT, cdeRelease: CDE_ACT }],
      ['pre-cde (όλα τα παλιά αρχεία — καμία παλινδρόμηση)', {}],
    ])('αγοραστής + %s ⇒ μετρά', async (_name, cde) => {
      permitFileIn(cde);
      expect(await permitAvailableFor(buyerCtx())).toBe(true);
    });

    it('εσωτερικός (isAdmin) + WIP ⇒ μετρά: βλέπει ως οικοδεσπότης', async () => {
      permitFileIn({ cdeState: 'WIP', cdeTeamId: 'team_eng' });
      expect(await permitAvailableFor(internalCtx())).toBe(true);
    });

    it('🔒 ο ρόλος επαφής «μηχανικός» δεν ανεβάζει εμβέλεια: μη διαχειριστής ⇒ client', async () => {
      const engineer = createCustomerContext({
        contactMeta: { ...buyerCtx().contactMeta!, projectRoles: [{ projectId: 'proj_001', role: 'engineer', entityType: 'project', entityId: 'proj_001' }] },
      });
      permitFileIn({ cdeState: 'SHARED', cdeShare: CDE_ACT });
      expect(await permitAvailableFor(engineer)).toBe(false);
      expect(collectEvidenceForTargets.mock.calls[0][3]).toBe('client');
    });

    it('⛔ ο συλλέκτης δεν έχει προεπιλογή ακροατηρίου: η σιωπή δεν γίνεται ξανά `host`', () => {
      const actual = jest.requireActual('@/services/conveyance/conveyance-evidence.server');
      expect(actual.collectEvidenceForTargets).toHaveLength(4);
      expect(actual.collectConveyanceEvidence).toHaveLength(5);
    });
  });

  it('handles Firestore error gracefully in file availability check', async () => {
    collectEvidenceForTargets.mockRejectedValue(new Error('Firestore down'));
    const result = await handler.execute('search_knowledge_base', { query: 'συμβολαιογράφο' }, buyerCtx());
    expect(result.success).toBe(true);
    const docs = (result.data as KbData).procedures[0].requiredDocuments;
    expect(docs.every((doc) => doc.availableInSystem === false)).toBe(true);
  });
});
