/**
 * ADR-901 §15 (Γ1) — άγκυρες του «για λογαριασμό ποιου γραφείου»: ο κριτής της ιδιότητας, η ΜΙΑ ερμηνεία της
 * απουσίας, το σχήμα του πεδίου και ο γραφέας. Κάθε `it` ονομάζει την άγκυρα του §15.8 και τη μετάλλαξη που
 * πρέπει να την κοκκινίσει.
 *
 * Το «ανήκει ≠ επιτρέπεται» (Α42) έχει και δεύτερη άγκυρα, πάνω στην ανάγνωση: `workspace-membership.test.ts` §Ε.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

import {
  ACTING_WORKSPACE_REQUEST_SCHEMA,
  actingWorkspaceOf,
  decideActingWorkspace,
  type ActingWorkspaceRequest,
  type BelongingOffices,
} from '../acting-workspace';
import { decideEngagement } from '../engagement-judge';
import { parseEngagement } from '../engagement-schema';
import { planTransition, type EngagementTransition } from '../engagement-write';
import type { DeclaredCredential, Engagement } from '@/types/engagement';
import { orgWorkspace, personalWorkspace, type WorkspaceRef } from '@/types/workspace-membership';

jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));

const NOW = Date.parse('2026-10-05T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const UID = 'u_georgiou';
const OFFICE = 'comp_georgiou';
const SECOND = 'comp_partners';
const FOREIGN = 'comp_foreign';
const CREDENTIAL: DeclaredCredential = { authority: 'bar-association', number: '4321', chapter: 'ΔΣΑ', assurance: 'declared', declaredAt: new Date(NOW).toISOString() };

function engagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: 'eng_1', hostCompanyId: 'comp_host', projectId: 'proj_1', uid: UID, email: 'g@example.gr',
    template: 'legal', role: 'buyer_lawyer', subject: { kind: 'conveyance_case', caseId: 'cvc_A' },
    scopes: ['conveyance:case:view'], state: 'active', expiresAt: new Date(NOW + 30 * DAY).toISOString(),
    origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [],
    offeredBy: 'u_host', offeredAt: new Date(NOW - DAY).toISOString(), respondedAt: null,
    revokedBy: null, closedAt: null, updatedAt: new Date(NOW - DAY).toISOString(),
    ...overrides,
  };
}

const offices = (...companyIds: string[]): BelongingOffices => ({ outcome: 'ok', companyIds });
const decide = (mine: BelongingOffices, requested: ActingWorkspaceRequest | null = null) =>
  decideActingWorkspace({ uid: UID, offices: mine, requested });

describe('ADR-901 §15.6.2 — ο κριτής της ιδιότητας (`decideActingWorkspace`)', () => {
  it('Α1 — κανένα γραφείο ⇒ προσωρινά ο ΔΙΚΟΣ του προσωπικός χώρος', () => {
    expect(decide(offices())).toEqual({ verdict: 'personal-provisional', workspace: personalWorkspace(UID) });
    expect(decide(offices(), { kind: 'personal' })).toEqual({ verdict: 'personal-provisional', workspace: personalWorkspace(UID) });
  });

  it('Α1 — ένα γραφείο ⇒ εκεί, αυτόματα, χωρίς αίτημα', () => {
    expect(decide(offices(OFFICE))).toEqual({ verdict: 'office', workspace: orgWorkspace(OFFICE) });
    expect(decide(offices(OFFICE), { kind: 'org', companyId: OFFICE })).toEqual({ verdict: 'office', workspace: orgWorkspace(OFFICE) });
  });

  it('Α40 — με γραφείο, «προσωπικά» ΑΡΝΕΙΤΑΙ (Α1γ)', () => {
    // Μετάλλαξη: ο κριτής δέχεται `personal` με 1+ γραφεία ⇒ ο προσωπικός χώρος γίνεται μόνιμο σπίτι.
    expect(decide(offices(OFFICE), { kind: 'personal' })).toEqual({ verdict: 'refused', reason: 'personal-with-office' });
    expect(decide(offices(OFFICE, SECOND), { kind: 'personal' })).toEqual({ verdict: 'refused', reason: 'personal-with-office' });
  });

  it('Α41 — 2+ γραφεία χωρίς επιλογή ⇒ `choice-required`, ΚΑΝΕΝΑΣ χώρος προς γραφή', () => {
    // Μετάλλαξη: προεπιλογή «το πρώτο της λίστας» ⇒ η υπόθεση γράφεται σε γραφείο που ο άνθρωπος δεν διάλεξε.
    const decision = decide(offices(OFFICE, SECOND));
    expect(decision).toEqual({ verdict: 'choice-required', offices: [OFFICE, SECOND] });
    expect(decision).not.toHaveProperty('workspace');
  });

  it('Α41 — 2+ γραφεία ΜΕ επιλογή ⇒ το γραφείο που διάλεξε, όχι το πρώτο', () => {
    expect(decide(offices(OFFICE, SECOND), { kind: 'org', companyId: SECOND })).toEqual({ verdict: 'office', workspace: orgWorkspace(SECOND) });
  });

  it('Α42 — γραφείο όπου ΔΕΝ ανήκει ⇒ άρνηση, όσα γραφεία κι αν έχει (ποτέ σιωπηλά «το δικό του»)', () => {
    // Μετάλλαξη: με ένα γραφείο το αίτημα «αγνοείται» ⇒ γράφεται άλλος χώρος από αυτόν που ονόμασε ο άνθρωπος.
    for (const mine of [offices(), offices(OFFICE), offices(OFFICE, SECOND)]) {
      expect(decide(mine, { kind: 'org', companyId: FOREIGN })).toEqual({ verdict: 'refused', reason: 'not-a-member' });
    }
  });

  it('Α43 — «δεν μπόρεσα να ρωτήσω τα γραφεία» ⇒ `unknown`, ΠΟΤΕ προσωπικός χώρος', () => {
    // Μετάλλαξη: `unknown` → `personal-provisional` ⇒ άνθρωπος με γραφείο γράφεται σιωπηλά στον προσωπικό του.
    const unknown: BelongingOffices = { outcome: 'unknown' };
    expect(decide(unknown)).toEqual({ verdict: 'unknown' });
    expect(decide(unknown, { kind: 'personal' })).toEqual({ verdict: 'unknown' });
    expect(decide(unknown, { kind: 'org', companyId: OFFICE })).toEqual({ verdict: 'unknown' });
  });

  it('διπλή εγγραφή του ίδιου γραφείου (token ΚΑΙ βιβλίο) ΔΕΝ γίνεται «2 γραφεία»', () => {
    expect(decide(offices(OFFICE, OFFICE))).toEqual({ verdict: 'office', workspace: orgWorkspace(OFFICE) });
  });

  it('σύρμα — το αίτημα ΔΕΝ δέχεται `userId` (ξένος προσωπικός χώρος δεν εκφράζεται) ούτε `default`', () => {
    expect(ACTING_WORKSPACE_REQUEST_SCHEMA.safeParse({ kind: 'personal', userId: 'u_other' }).success).toBe(false);
    expect(ACTING_WORKSPACE_REQUEST_SCHEMA.safeParse({ kind: 'default' }).success).toBe(false);
    expect(ACTING_WORKSPACE_REQUEST_SCHEMA.safeParse({ kind: 'org', companyId: '' }).success).toBe(false);
    expect(ACTING_WORKSPACE_REQUEST_SCHEMA.safeParse({ kind: 'org', companyId: OFFICE }).success).toBe(true);
  });
});

describe('ADR-901 §15.7 — η ΜΙΑ ερμηνεία της απουσίας (`actingWorkspaceOf`)', () => {
  it('Α48 — απόν `actingFor` ⇒ ο προσωπικός χώρος ΤΟΥ ΙΔΙΟΥ (οι υπάρχουσες συμμετοχές, χωρίς backfill)', () => {
    // Μετάλλαξη: η απουσία διαβάζεται ως γραφείο / ως `null` ⇒ οι δύο υπάρχουσες συμμετοχές χάνουν τον χώρο τους.
    expect(actingWorkspaceOf(engagement())).toEqual(personalWorkspace(UID));
    expect(actingWorkspaceOf(engagement({ actingFor: orgWorkspace(OFFICE) }))).toEqual(orgWorkspace(OFFICE));
  });

  it('Α48 — η απουσία ερμηνεύεται σε ΕΝΑ σημείο· κανείς άλλος στον διακομιστή δεν διαβάζει το πεδίο', () => {
    // Μετάλλαξη: δεύτερο `x.actingFor ?? …` οπουδήποτε ⇒ δεύτερη ερμηνεία της απουσίας.
    const SRC = join(process.cwd(), 'src');
    const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : files(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
    const matching = (pattern: RegExp, within: (path: string) => boolean = () => true): string[] => files(SRC)
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file).replace(/\\/g, '/'))
      .filter(within)
      .sort();

    // (α) Η εφεδρεία της απουσίας (`?? …` · `|| …`) γράφεται ΜΙΑ φορά σε όλο το `src/`.
    expect(matching(/\bactingFor\s*(\?\?|\|\|)/)).toEqual(['src/lib/auth/acting-workspace.ts']);

    // (β) Κλειστό σύνολο όσων αγγίζουν `.actingFor` εκτός οθόνης (η οθόνη διαβάζει το `card.actingFor`, άλλο πεδίο —
    //     έτοιμη όψη, ποτέ το έγγραφο): η ΜΙΑ ερμηνεία · το σχήμα · ο γραφέας και οι δύο πόρτες που του το δίνουν.
    const offScreen = (path: string) => !path.startsWith('src/components/') && !path.startsWith('src/hooks/');
    expect(matching(/\.actingFor\b/, offScreen)).toEqual([
      'src/lib/auth/acting-workspace.ts',
      'src/lib/auth/engagement-schema.ts',
      'src/lib/auth/engagement-write.ts',
      'src/server/engagement-invitations/engagement-invitation-redeem.ts',
      'src/services/conveyance/conveyance-engagement-access.service.ts',
    ]);
  });
});

describe('ADR-901 §15.6.1 — ο κριτής ΠΡΟΣΒΑΣΗΣ δεν διαβάζει το πεδίο', () => {
  const ask = (e: Engagement, uid: string) =>
    decideEngagement({ engagement: e, uid, subject: e.subject, scope: 'conveyance:case:view', nowMs: NOW }).verdict;

  it('Α39 — ο διαχειριστής του γραφείου ΔΕΝ ανοίγει την υπόθεση του συναδέλφου του', () => {
    // Μετάλλαξη: `decideEngagement` δέχεται όποιον ανήκει στο `actingFor` ⇒ όλο το γραφείο βλέπει τα έγγραφα.
    const forOffice = engagement({ actingFor: orgWorkspace(OFFICE) });
    expect(ask(forOffice, UID)).toBe('engaged');
    expect(ask(forOffice, 'u_office_admin')).toBe('not-engaged');
    // Και το αντίστροφο: το πεδίο ούτε **αφαιρεί** πρόσβαση — ίδια ετυμηγορία με ή χωρίς αυτό.
    expect(ask(engagement(), UID)).toBe(ask(forOffice, UID));
  });

  it('Α39 — δομικά: ο κριτής πρόσβασης δεν αναφέρει καν το πεδίο', () => {
    const judge = readFileSync(join(process.cwd(), 'src/lib/auth/engagement-judge.ts'), 'utf8');
    expect(judge).not.toMatch(/actingFor|acting-workspace/);
  });
});

describe('ADR-901 §15.6.6 — ο ΕΝΑΣ γραφέας γράφει τον χώρο ΜΙΑ φορά, στην αποδοχή', () => {
  const offered = engagement({ state: 'offered', expiresAt: new Date(NOW + DAY).toISOString() });
  const accept = (actingFor: WorkspaceRef = orgWorkspace(OFFICE)): EngagementTransition =>
    ({ kind: 'accept', byUid: UID, declaredCredential: CREDENTIAL, actingFor });

  it('η αποδοχή ΓΡΑΦΕΙ `actingFor` μαζί με το `active`· η άρνηση όχι', () => {
    // Μετάλλαξη: ο γραφέας πετά το `actingFor` της αποδοχής ⇒ ενεργή συμμετοχή χωρίς χώρο.
    const planned = planTransition(offered, accept(), NOW);
    expect(planned.outcome === 'changed' && planned.after).toMatchObject({ state: 'active', actingFor: orgWorkspace(OFFICE) });
    const declined = planTransition(offered, { kind: 'decline', byUid: UID }, NOW);
    expect(declined.outcome === 'changed' && declined.after.actingFor).toBeUndefined();
  });

  it('η πρόταση ΔΕΝ έχει χώρο — ο οικοδεσπότης δεν διαλέγει γραφείο για τον καλεσμένο', () => {
    expect(offered).not.toHaveProperty('actingFor');
  });

  it('Α44 — δεύτερη αποδοχή σε ήδη ενεργή = `noop`: το `actingFor` ΔΕΝ ξαναγράφεται (Α1δ)', () => {
    // Μετάλλαξη: ιδεμποτή αποδοχή που ξαναγράφει το πεδίο ⇒ ο χώρος αλλάζει σιωπηλά με ένα δεύτερο κλικ.
    const active = engagement({ actingFor: orgWorkspace(OFFICE) });
    const again = planTransition(active, accept(orgWorkspace(SECOND)), NOW);
    expect(again.outcome).toBe('noop');
    expect(again.outcome === 'noop' && again.engagement.actingFor).toEqual(orgWorkspace(OFFICE));
  });

  it('Α44 — η ανάκληση από τον οικοδεσπότη ΔΕΝ αγγίζει το `actingFor`', () => {
    const active = engagement({ actingFor: orgWorkspace(OFFICE) });
    const ended = planTransition(active, { kind: 'end', byUid: 'u_host' }, NOW);
    expect(ended.outcome === 'changed' && ended.after).toMatchObject({ state: 'revoked', actingFor: orgWorkspace(OFFICE) });
  });

  it('ζώνη του γραφέα — «για λογαριασμό» ΞΕΝΟΥ προσωπικού χώρου δεν γράφεται', () => {
    // Μετάλλαξη: αφαίρεση του `isOwnActingWorkspace` ⇒ συμμετοχή του Χ δείχνει στον προσωπικό χώρο του Ψ.
    expect(planTransition(offered, accept(personalWorkspace('u_other')), NOW).outcome).toBe('not-allowed');
    expect(planTransition(offered, accept(personalWorkspace(UID)), NOW).outcome).toBe('changed');
  });
});

describe('ADR-901 §15.6.1 — το σχήμα του πεδίου (δίσκος → τύπος)', () => {
  it('προαιρετικό: συμμετοχή χωρίς `actingFor` διαβάζεται όπως πριν (μηδέν backfill)', () => {
    expect(parseEngagement(engagement())).not.toBeNull();
    expect(parseEngagement(engagement({ actingFor: orgWorkspace(OFFICE) }))?.actingFor).toEqual(orgWorkspace(OFFICE));
    expect(parseEngagement(engagement({ actingFor: personalWorkspace(UID) }))?.actingFor).toEqual(personalWorkspace(UID));
  });

  it('fail-closed — προσωπικός χώρος ΜΕ `companyId`, ή ξένου ανθρώπου, ή άγνωστο είδος ⇒ μη αναγνώσιμο', () => {
    // Μετάλλαξη: χαλαρό σχήμα ⇒ ένα `companyId` «επιπλέει» στον προσωπικό κλάδο (ADR-787 Ε-3 §3).
    expect(parseEngagement({ ...engagement(), actingFor: { kind: 'personal', userId: UID, companyId: OFFICE } })).toBeNull();
    expect(parseEngagement({ ...engagement(), actingFor: personalWorkspace('u_other') })).toBeNull();
    expect(parseEngagement({ ...engagement(), actingFor: { kind: 'team', teamId: 't1' } })).toBeNull();
    expect(parseEngagement({ ...engagement(), actingFor: { kind: 'org', companyId: '' } })).toBeNull();
  });

  it('το πεδίο είναι ΕΜΦΩΛΕΥΜΕΝΟ — κανένα επίπεδο `companyId` πάνω στη συμμετοχή', () => {
    const parsed = parseEngagement({ ...engagement({ actingFor: orgWorkspace(OFFICE) }), companyId: OFFICE });
    expect(parsed).not.toHaveProperty('companyId');
    expect(parsed?.hostCompanyId).toBe('comp_host');
  });
});
