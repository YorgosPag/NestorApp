/**
 * ADR-930 «Εξουσία κατόχου» — ο κριτής πόρου `decideOpportunityAccess`.
 *
 * Ο πίνακας είναι ο ΙΔΙΟΣ με το `match /opportunities` του `firestore.rules` (σουίτα `opportunities.rules.test.ts` +
 * `_harness/crm-owner-contract.ts`). Εδώ: κάθε σχέση (διαχειριστής · δημιουργός · ανατεθειμένος · τρίτος · ξένος ·
 * legacy · bypass) × κάθε πρόθεση (`edit` · `delete`).
 */

import {
  canEditOpportunity,
  decideOpportunityAccess,
  isOpportunityAccessGranted,
  opportunityOwnerOf,
  type OpportunityAccessFacts,
  type OpportunityAccessIntent,
  type OpportunityAccessSubject,
  type OpportunityAccessVerdict,
} from '../opportunity-access';

const COMPANY = 'comp-a';
const FOREIGN = 'comp-b';

const admin: OpportunityAccessSubject = { uid: 'u-admin', globalRole: 'company_admin', companyId: COMPANY };
const superAdmin: OpportunityAccessSubject = { uid: 'u-root', globalRole: 'super_admin', companyId: 'comp-root' };
const seller: OpportunityAccessSubject = { uid: 'u-seller', globalRole: 'sales_agent', companyId: COMPANY };
const author: OpportunityAccessSubject = { uid: 'u-author', globalRole: 'internal_user', companyId: COMPANY };
const bystander: OpportunityAccessSubject = { uid: 'u-other', globalRole: 'internal_user', companyId: COMPANY };
const foreignAdmin: OpportunityAccessSubject = { uid: 'u-admin-b', globalRole: 'company_admin', companyId: FOREIGN };
const explicitClaim: OpportunityAccessSubject = {
  uid: 'u-claim', globalRole: 'internal_user', companyId: COMPANY, permissions: ['crm:opportunities:update'],
};

const owned: OpportunityAccessFacts = { companyId: COMPANY, createdBy: author.uid, assignedTo: seller.uid };
const legacy: OpportunityAccessFacts = { createdBy: author.uid, assignedTo: seller.uid };
const foreignAssigned: OpportunityAccessFacts = { companyId: FOREIGN, createdBy: 'x', assignedTo: seller.uid };

const verdict = (subject: OpportunityAccessSubject, opportunity: OpportunityAccessFacts, intent: OpportunityAccessIntent) =>
  decideOpportunityAccess({ subject, opportunity, intent }).verdict;

describe('decideOpportunityAccess — ο πίνακας', () => {
  const CASES: ReadonlyArray<readonly [string, OpportunityAccessSubject, OpportunityAccessFacts, OpportunityAccessVerdict, OpportunityAccessVerdict]> = [
    //  περιγραφή                                 ποιος           τι              edit                       delete
    ['διαχειριστής εταιρείας',                    admin,          owned,          'granted-capability',      'granted-capability'],
    ['ρητό claim ικανότητας',                     explicitClaim,  owned,          'granted-capability',      'granted-capability'],
    ['υπερδιαχειριστής, ξένη εταιρεία (bypass)',  superAdmin,     owned,          'granted-capability',      'granted-capability'],
    ['δημιουργός',                                author,         owned,          'granted-creator',         'granted-creator'],
    ['ανατεθειμένος',                             seller,         owned,          'granted-assignee',        'denied-not-owner'],
    ['τρίτος της εταιρείας',                      bystander,      owned,          'denied-not-owner',        'denied-not-owner'],
    ['διαχειριστής ΞΕΝΗΣ εταιρείας',              foreignAdmin,   owned,          'denied-foreign-tenant',   'denied-foreign-tenant'],
    ['ανατεθειμένος σε έγγραφο ξένου tenant',     seller,         foreignAssigned,'denied-foreign-tenant',   'denied-foreign-tenant'],
    ['legacy: ανατεθειμένος',                     seller,         legacy,         'granted-assignee',        'denied-not-owner'],
    ['legacy: δημιουργός',                        author,         legacy,         'granted-creator',         'granted-creator'],
    // Όπως το `crmIsCompanyAdmin` των κανόνων (ζητά `companyId`): ικανότητα εταιρείας δεν πιάνει έγγραφο χωρίς εταιρεία.
    ['legacy: διαχειριστής (ούτε δημιουργός)',    admin,          legacy,         'denied-not-owner',        'denied-not-owner'],
  ];

  it.each(CASES)('%s', (_label, subject, opportunity, edit, remove) => {
    expect(verdict(subject, opportunity, 'edit')).toBe(edit);
    expect(verdict(subject, opportunity, 'delete')).toBe(remove);
  });
});

describe('decideOpportunityAccess — η άρνηση ΟΝΟΜΑΖΕΙ ποιος μπορεί', () => {
  it('ο κάτοχος = ο ανατεθειμένος· αν λείπει, ο δημιουργός', () => {
    expect(opportunityOwnerOf(owned)).toBe(seller.uid);
    expect(opportunityOwnerOf({ companyId: COMPANY, createdBy: author.uid, assignedTo: '' })).toBe(author.uid);
    expect(opportunityOwnerOf({ companyId: COMPANY })).toBeNull();
  });

  it('η απόφαση κουβαλά πρόθεση και κάτοχο', () => {
    expect(decideOpportunityAccess({ subject: bystander, opportunity: owned, intent: 'edit' }))
      .toEqual({ verdict: 'denied-not-owner', intent: 'edit', ownerUid: seller.uid });
  });
});

describe('decideOpportunityAccess — ακραίες ταυτότητες', () => {
  it('κενό uid δεν ταιριάζει με κενό `createdBy`/`assignedTo`', () => {
    const nobody: OpportunityAccessSubject = { uid: '', globalRole: 'internal_user', companyId: COMPANY };
    expect(verdict(nobody, { companyId: COMPANY, createdBy: '', assignedTo: '' }, 'edit')).toBe('denied-not-owner');
  });

  it('άγνωστος ρόλος (fail-closed του ADR-801) δεν δίνει ικανότητα — μένει μόνο η σχέση με το έγγραφο', () => {
    const odd: OpportunityAccessSubject = { uid: seller.uid, globalRole: 'admin', companyId: COMPANY };
    expect(verdict(odd, owned, 'edit')).toBe('granted-assignee');
    expect(verdict({ ...odd, uid: 'u-x' }, owned, 'edit')).toBe('denied-not-owner');
  });

  it('`canEditOpportunity` = η πρόθεση `edit`', () => {
    expect(canEditOpportunity(seller, owned)).toBe(true);
    expect(canEditOpportunity(bystander, owned)).toBe(false);
    expect(isOpportunityAccessGranted('denied-foreign-tenant')).toBe(false);
  });
});
