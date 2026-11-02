/**
 * 🔐 ΠΟΛΙΤΙΚΗ ΕΡΓΑΛΕΙΩΝ (ADR-257 · OWASP LLM06) — με τον ΠΡΑΓΜΑΤΙΚΟ πίνακα ρόλων, χωρίς το `setup`.
 *
 * @module __tests__/tool-access
 */

import { AI_ROLE_ACCESS_MATRIX, UNKNOWN_USER_ACCESS, UNLINKED_ACCESS } from '@/config/ai-role-access-matrix';
import { enforceRoleAccess, getAccessConfig, type AgenticContext } from '../executor-shared';
import { AGENTIC_TOOL_DEFINITIONS } from '../agentic-tool-definitions';
import { isToolAllowed, toolsForViewer } from '../tool-access';

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

type Role = NonNullable<AgenticContext['contactMeta']>['projectRoles'][number];

function viewer(projectRoles: Role[], overrides: Partial<AgenticContext> = {}): AgenticContext {
  return {
    companyId: 'c', isAdmin: false, channel: 'telegram', channelSenderId: 'telegram_1', requestId: 'r',
    contactMeta: {
      contactId: 'k', displayName: 'Τ', firstName: 'Τ', primaryPersona: null, projectRoles,
      linkedPropertyIds: projectRoles.filter((r) => r.entityType === 'property').map((r) => r.entityId),
    },
    ...overrides,
  };
}

/** Όπως τα χτίζει το `contact-linker`. */
const onProperty = (role: string): Role => ({ projectId: '', role, entityType: 'property', entityId: 'unit_1' });
const onProject = (role: string): Role => ({ projectId: 'proj_1', role, entityType: 'project', entityId: 'proj_1' });

const ADMIN_ONLY = [
  'firestore_write', 'send_email_to_contact', 'send_telegram_message', 'manage_bank_account', 'manage_relationship',
  'create_contact', 'update_contact_field', 'create_purchase_order', 'get_portfolio_summary', 'discard_pending_file',
];

describe('🔐 πολιτική εργαλείων', () => {
  it('🧷 κάθε δηλωμένο εργαλείο υπάρχει: τυπογραφικό στον πίνακα θα ήταν σιωπηλή άρνηση', () => {
    const known = new Set(AGENTIC_TOOL_DEFINITIONS.map((tool) => tool.function.name));
    const configs = [...Object.values(AI_ROLE_ACCESS_MATRIX), AI_ROLE_ACCESS_MATRIX.engineer, UNLINKED_ACCESS, UNKNOWN_USER_ACCESS];
    for (const { allowedTools } of configs) {
      if (allowedTools !== 'all') expect(allowedTools.filter((name) => !known.has(name))).toEqual([]);
    }
  });

  it('🧷 ο κατάλογος ADMIN_ONLY αυτού του test είναι πραγματικά εργαλεία', () => {
    const known = new Set(AGENTIC_TOOL_DEFINITIONS.map((tool) => tool.function.name));
    expect(ADMIN_ONLY.filter((name) => !known.has(name))).toEqual([]);
  });

  it.each(['buyer', 'owner', 'tenant'])('πελάτης %s: έχει τα δικά του, κανένα διαχειριστικό', (role) => {
    const ctx = viewer([onProperty(role)]);
    expect(isToolAllowed('search_knowledge_base', ctx)).toBe(true);
    expect(isToolAllowed('deliver_file_to_chat', ctx)).toBe(true);
    expect(ADMIN_ONLY.filter((name) => isToolAllowed(name, ctx))).toEqual([]);
  });

  it.each(['supervisor', 'contractor', 'architect', 'engineer'])('επαγγελματίας %s: μόνο ανάγνωση', (role) => {
    const ctx = viewer([onProject(role)]);
    expect(isToolAllowed('firestore_query', ctx)).toBe(true);
    expect(ADMIN_ONLY.filter((name) => isToolAllowed(name, ctx))).toEqual([]);
  });

  it('άγνωστο εργαλείο ⇒ άρνηση (deny-by-default): νέο εργαλείο είναι διαχειριστικό μέχρι να το δηλώσει ρόλος', () => {
    expect(isToolAllowed('brand_new_tool', viewer([onProperty('buyer')]))).toBe(false);
  });

  it('διαχειριστής: όλα, και το μοντέλο τα βλέπει όλα', () => {
    const ctx = viewer([], { isAdmin: true });
    expect(isToolAllowed('firestore_write', ctx)).toBe(true);
    expect(toolsForViewer(AGENTIC_TOOL_DEFINITIONS, ctx)).toHaveLength(AGENTIC_TOOL_DEFINITIONS.length);
  });

  it('το μοντέλο του πελάτη δεν βλέπει καν τα διαχειριστικά', () => {
    const names = toolsForViewer(AGENTIC_TOOL_DEFINITIONS, viewer([onProperty('buyer')])).map((tool) => tool.function.name);
    expect(names).toContain('search_knowledge_base');
    expect(names.filter((name) => ADMIN_ONLY.includes(name))).toEqual([]);
  });

  it('📁 τα αρχεία πελάτη φιλτράρονται στο ερώτημα (`entityType`/`entityId`), όχι μόνο μετά: αλλιώς το όριο τα κόβει', () => {
    const access = enforceRoleAccess('files', [], viewer([onProperty('buyer')]));
    expect(access).toMatchObject({
      allowed: true,
      filters: [
        { field: 'entityType', operator: '==', value: 'property' },
        { field: 'entityId', operator: 'in', value: ['unit_1'] },
      ],
    });
  });

  describe('ο ρόλος του executor ίδιος με της προτροπής', () => {
    it('🏠 αγοραστής με σύνδεση ΜΟΝΟ σε ακίνητο (`projectId: \'\'`) ⇒ αγοραστής, όχι `UNLINKED`', () => {
      expect(getAccessConfig(viewer([onProperty('buyer')])).label).toBe(AI_ROLE_ACCESS_MATRIX.buyer.label);
    });

    it('🔒 ρόλος ΕΡΓΟΥ χωρίς έργο ⇒ `UNLINKED`: αλλιώς τα φίλτρα έργου δεν θα είχαν τιμές και θα διεύρυνε', () => {
      expect(getAccessConfig(viewer([onProperty('contractor')]))).toBe(UNLINKED_ACCESS);
    });

    it('ρόλος έργου με έργο ⇒ ο ρόλος του', () => {
      expect(getAccessConfig(viewer([onProject('contractor')])).label).toBe(AI_ROLE_ACCESS_MATRIX.contractor.label);
    });

    it('καμία σύνδεση ⇒ `UNLINKED`', () => {
      expect(getAccessConfig(viewer([]))).toBe(UNLINKED_ACCESS);
    });
  });
});
