/**
 * @jest-environment node
 *
 * 🔒 ΑΓΚΥΡΕΣ Β3 · Β4 · Β6 — ADR-864 Φ1β · **ΠΟΙΟΣ ΔΙΑΒΑΖΕΙ ΠΟΙΟ ΒΙΒΛΙΟ**
 *
 * Καθαρές συναρτήσεις — ό,τι αποφασίζει ποιο βιβλίο, ποιο φίλτρο και ποια εγγραφή αποδίδεται.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το προσωπικό φίλτρο παίρνει τιμή από **αλλού** από το `ctx.uid` | Β3 ⇒ 🔴 |
 * | απουσία παραμέτρου ⇒ `personal` | Β4 ⇒ 🔴 |
 * | άγνωστη παράμετρος ⇒ προεπιλογή αντί άρνησης | Β4.γ ⇒ 🔴 |
 * | το σύνορο αποδίδει εγγραφή χωρίς ή με δύο εμβέλειες | Β6 ⇒ 🔴 |
 */

import {
  AUDIT_LEDGER_COLLECTION,
  auditLedgerKindFromParam,
  auditLedgerKindOf,
  auditLedgerKindOfScope,
  auditLedgerScopeOf,
} from '@/lib/audit/audit-ledger';
import { auditLedgerFilter } from '@/lib/audit/audit-ledger-query';
import { entityAuditEntryFromData } from '@/lib/audit/audit-entry-from-document';
import type { ApiActor } from '@/lib/auth/personal-scope-middleware';
import type { AuthContext, PersonalIdentityContext } from '@/lib/auth/types';

const citizen = { scope: 'personal', ctx: { uid: 'citizen-1' } as PersonalIdentityContext } as const;
const member = {
  scope: 'organization',
  ctx: { uid: 'member-1', companyId: 'comp_1' } as AuthContext,
} as const satisfies ApiActor;

describe('Β3 — το προσωπικό βιβλίο φιλτράρεται ΠΑΝΤΑ με το uid του δρώντος', () => {
  it('🔴 πολίτης ⇒ `userId == ctx.uid`', () => {
    expect(auditLedgerFilter(citizen, 'personal')).toEqual({ field: 'userId', value: 'citizen-1' });
  });

  it('🔴 μέλος εταιρείας ζητά ΤΟ ΔΙΚΟ ΤΟΥ προσωπικό ⇒ `userId == ctx.uid`, όχι `companyId`', () => {
    expect(auditLedgerFilter(member, 'personal')).toEqual({ field: 'userId', value: 'member-1' });
  });

  it('πολίτης ζητά ΕΤΑΙΡΙΚΟ βιβλίο ⇒ άρνηση (`null`)', () => {
    expect(auditLedgerFilter(citizen, 'company')).toBeNull();
  });
});

describe('Β4 — το εταιρικό βιβλίο μένει ΤΑΥΤΟΣΗΜΟ με πριν (παρονομαστής)', () => {
  it('απουσία παραμέτρου ⇒ `company`', () => {
    expect(auditLedgerKindFromParam(null)).toBe('company');
  });

  it('μέλος εταιρείας, εταιρικό ⇒ `companyId == ctx.companyId`, στη ΙΔΙΑ συλλογή με πριν', () => {
    expect(auditLedgerFilter(member, 'company')).toEqual({ field: 'companyId', value: 'comp_1' });
    expect(AUDIT_LEDGER_COLLECTION.company).toBe('ENTITY_AUDIT_TRAIL');
  });

  it('Β4.γ 🔴 άγνωστη τιμή ⇒ άρνηση, ΠΟΤΕ προεπιλογή (fail closed)', () => {
    expect(auditLedgerKindFromParam('Personal')).toBeNull();
    expect(auditLedgerKindFromParam('')).toBeNull();
  });
});

describe('μεταφράσεις χώρου ⇒ βιβλίου (μία φορά)', () => {
  it('οργανισμός ⇒ `{ companyId }` · προσωπικός ⇒ `{ userId }`, αποκλειστικά', () => {
    expect(auditLedgerScopeOf({ kind: 'org', companyId: 'comp_1' })).toEqual({ companyId: 'comp_1' });
    expect(auditLedgerScopeOf({ kind: 'personal', userId: 'u1' })).toEqual({ userId: 'u1' });
    expect(auditLedgerKindOf({ kind: 'personal', userId: 'u1' })).toBe('personal');
    expect(auditLedgerKindOfScope({ userId: 'u1' })).toBe('personal');
    expect(auditLedgerKindOfScope({ companyId: 'c' })).toBe('company');
  });
});

describe('Β6 — το σύνορο ανάγνωσης αποδίδει ΜΟΝΟ εγγραφή με ακριβώς ένα βιβλίο', () => {
  const base = { entityType: 'owner_property', entityId: 'ownp_a', action: 'updated', performedBy: 'u1' };

  it('προσωπική εγγραφή ⇒ `userId`, κανένα `companyId`', () => {
    const entry = entityAuditEntryFromData('a1', { ...base, userId: 'u1' });
    expect(entry).toMatchObject({ id: 'a1', userId: 'u1' });
    expect(entry).not.toHaveProperty('companyId');
  });

  it('🔴 χωρίς εμβέλεια ⇒ `null`', () => {
    expect(entityAuditEntryFromData('a2', base)).toBeNull();
  });

  it('🔴 ΚΑΙ με τα δύο ⇒ `null` (δεν ξέρουμε ποιος δικαιούται να τη δει)', () => {
    expect(entityAuditEntryFromData('a3', { ...base, companyId: 'c', userId: 'u1' })).toBeNull();
  });

  it('CDC αντικείμενο αντί ονόματος ⇒ συμβολοσειρά (φρουρός React #31)· Timestamp ⇒ ISO', () => {
    const when = new Date('2026-09-16T10:00:00.000Z');
    const entry = entityAuditEntryFromData('a4', {
      ...base,
      companyId: 'c',
      entityName: { name: 'Όροφος 1', number: 1 },
      timestamp: { toDate: () => when },
      changes: 'not-an-array',
    });
    expect(entry).toMatchObject({ entityName: 'Όροφος 1', timestamp: when.toISOString(), changes: [] });
  });
});
