/**
 * @fileoverview **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΑΠΕΝΑΝΤΙ ΣΤΟ ΓΕΜΗ** — ανάγνωση και πράξη (ADR-841 §7 Α23).
 * @module services/company-registry/company-registry-verification.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΙΣΟΔΟΙ, ΚΑΙ ΜΟΝΟ Η ΜΙΑ ΡΩΤΑ ΤΟ ΜΗΤΡΩΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Είσοδος | Ρωτά ΓΕΜΗ; | Πότε |
 * |---|---|---|
 * | {@link readRegistryIdentityReport} | ❌ | κάθε άνοιγμα οθόνης — κρίνει το **αποθηκευμένο** ζεύγος |
 * | {@link verifyRegistryIdentity} | ✅ | **πράξη** ανθρώπου («Επαλήθευση», δημοσίευση βιτρίνας) |
 *
 * ⛔ Κανένα cron, κανένα trigger (Α1.6 — *η πράξη κατέχει τη συνέπεια*): κάθε κλήση στο ΓΕΜΗ
 * αντιστοιχεί σε μία ανθρώπινη χειρονομία — είναι και η νομική βάση που γράφτηκε (6(1)(στ)).
 *
 * | Ετυμηγορία μητρώου | Τι γράφεται | Κρίση |
 * |---|---|---|
 * | `found` | η απάντηση **αντικαθιστά** το αντίγραφο | ζεύγος προφίλ ⇄ νέα απάντηση |
 * | `absent` | το αντίγραφο **σβήνεται** (αφορούσε αριθμό που δεν υπάρχει) | `not-in-registry` |
 * | `unavailable` | **τίποτα** — η παλιά γνώση δεν ακυρώνεται από άγνοια | ζεύγος προφίλ ⇄ παλιό αντίγραφο, **και** η οθόνη μαθαίνει ότι η φρέσκια ερώτηση απέτυχε |
 *
 * **Layering**: service — συνθέτει αναγνώστη προφίλ, αναγνώστη ΓΕΜΗ, αποθήκη αντιγράφου, καθαρή κρίση.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { judgeRegistryIdentity } from '@/lib/company/registry-identity-judgment';
import { nowISO } from '@/lib/date-local';
import {
  readCompanyRegistryDeclaration,
  type CompanyRegistryDeclarationRead,
} from '@/services/company/company-legal-identity';
import type {
  CompanyRegistryDeclaration,
  DeclaredRegistryIdentity,
  RegistryFreshness,
  RegistryIdentityJudgment,
  RegistryIdentityReport,
  RegistryLookupVerdict,
} from '@/types/company-registry';

import { forgetRegistryCheck, readRegistryCheck, recordRegistryCheck } from './company-registry-record.service';
import { lookupRegistryCompany } from './gemi-opendata.client';

// Οι τύποι της αναφοράς ζουν στο `types/company-registry.ts` — τους βλέπει και η οθόνη.
export type { RegistryFreshness, RegistryIdentityReport };

export type RegistryReportOutcome =
  | { readonly kind: 'report'; readonly report: RegistryIdentityReport }
  /** Το προφίλ **δεν διαβάστηκε** — καμία κρίση: θα έλεγε «χωρίς αριθμό» για οργανισμό που τον έχει. */
  | { readonly kind: 'profile-unavailable' };

/** Ό,τι έρχεται από έξω — εγχεόμενο, ώστε οι άγκυρες να μην αγγίζουν δίκτυο ή ρολόι. */
export interface RegistryVerificationDeps {
  readonly readDeclaration: (companyId: string) => Promise<CompanyRegistryDeclarationRead>;
  readonly lookup: (registrationNumber: string) => Promise<RegistryLookupVerdict>;
  readonly now: () => string;
}

const LIVE_DEPS: RegistryVerificationDeps = {
  readDeclaration: readCompanyRegistryDeclaration,
  lookup: (registrationNumber) => lookupRegistryCompany(registrationNumber),
  now: nowISO,
};

const NO_DECLARATION: CompanyRegistryDeclaration = { entityType: null, businessName: null, gemiNumber: null };
const ASKED: RegistryFreshness = { kind: 'asked' };
const NOT_ASKED: RegistryFreshness = { kind: 'not-asked' };

function identityOf(declaration: CompanyRegistryDeclaration): DeclaredRegistryIdentity {
  return { registrationNumber: declaration.gemiNumber, legalName: declaration.businessName };
}

function reportOf(
  declaration: CompanyRegistryDeclaration,
  judgment: RegistryIdentityJudgment,
  freshness: RegistryFreshness,
): RegistryReportOutcome {
  return { kind: 'report', report: { declaration, judgment, freshness } };
}

/**
 * Η δήλωση του προφίλ — **`null` μόνο όταν δεν διαβάστηκε**. Προφίλ που δεν υπάρχει είναι
 * κενή δήλωση (η κρίση θα πει `no-registration-number`), όχι άγνοια.
 */
async function declarationFor(
  deps: RegistryVerificationDeps,
  companyId: string,
): Promise<CompanyRegistryDeclaration | null> {
  const profile = await deps.readDeclaration(companyId);
  if (profile.kind === 'unavailable') return null;
  return profile.kind === 'present' ? profile.declaration : NO_DECLARATION;
}

const PROFILE_UNAVAILABLE: RegistryReportOutcome = { kind: 'profile-unavailable' };

/** Κρίση από τα αποθηκευμένα — **καμία** κλήση στο ΓΕΜΗ. */
export async function readRegistryIdentityReport(
  adminDb: AdminFirestore,
  companyId: string,
  deps: RegistryVerificationDeps = LIVE_DEPS,
): Promise<RegistryReportOutcome> {
  const declaration = await declarationFor(deps, companyId);
  if (declaration === null) return PROFILE_UNAVAILABLE;
  const stored = await readRegistryCheck(adminDb, companyId);
  return reportOf(declaration, judgeRegistryIdentity(identityOf(declaration), stored), NOT_ASKED);
}

async function settleVerdict(
  adminDb: AdminFirestore,
  companyId: string,
  declaration: CompanyRegistryDeclaration,
  verdict: RegistryLookupVerdict,
  now: () => string,
): Promise<RegistryReportOutcome> {
  const identity = identityOf(declaration);
  switch (verdict.kind) {
    case 'found': {
      const check = await recordRegistryCheck(adminDb, companyId, verdict.record, now());
      return reportOf(declaration, judgeRegistryIdentity(identity, { kind: 'present', check }), ASKED);
    }
    case 'absent':
      await forgetRegistryCheck(adminDb, companyId);
      return reportOf(declaration, { state: 'declared', gap: 'not-in-registry', check: null }, ASKED);
    case 'invalid-number':
      return reportOf(declaration, judgeRegistryIdentity(identity, { kind: 'absent' }), NOT_ASKED);
    case 'unavailable': {
      const stored = await readRegistryCheck(adminDb, companyId);
      const freshness: RegistryFreshness = { kind: 'unavailable', reason: verdict.reason };
      return reportOf(declaration, judgeRegistryIdentity(identity, stored), freshness);
    }
  }
}

/** **Η πράξη**: ρωτά το ΓΕΜΗ για τον αριθμό του προφίλ, αποθηκεύει, κρίνει. */
export async function verifyRegistryIdentity(
  adminDb: AdminFirestore,
  companyId: string,
  deps: RegistryVerificationDeps = LIVE_DEPS,
): Promise<RegistryReportOutcome> {
  const declaration = await declarationFor(deps, companyId);
  if (declaration === null) return PROFILE_UNAVAILABLE;
  const canonical = canonicalGemiNumber(declaration.gemiNumber);
  if (canonical === null) {
    // Χωρίς έγκυρο αριθμό **δεν** ρωτάμε: η κρίση ονομάζει ήδη το κενό (χωρίς/άκυρος αριθμός).
    return reportOf(declaration, judgeRegistryIdentity(identityOf(declaration), { kind: 'absent' }), NOT_ASKED);
  }
  const verdict = await deps.lookup(canonical);
  return settleVerdict(adminDb, companyId, declaration, verdict, deps.now);
}
