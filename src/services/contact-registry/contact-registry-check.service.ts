/**
 * @fileoverview **«ΕΛΕΓΧΟΣ ΣΤΟ ΓΕΜΗ» ΓΙΑ ΜΙΑ ΕΠΑΦΗ-ΕΤΑΙΡΕΙΑ** — ανάγνωση και πράξη (ADR-948 §8 Βήμα 4 · πρότυπο
 * `professional-registry/registry-check.service.ts`, ADR-915 §40.7 Φ2).
 * @module services/contact-registry/contact-registry-check.service
 *
 * | Είσοδος | Ρωτά ΓΕΜΗ; | Πότε |
 * |---|---|---|
 * | {@link readContactRegistryReport} | ❌ | κάθε άνοιγμα της επαφής — συγκρίνει την **τρέχουσα** επαφή με την αποθηκευμένη απάντηση |
 * | {@link verifyContactRegistry} | ✅ | **πράξη** ανθρώπου («Έλεγχος στο ΓΕΜΗ») |
 *
 * Ροή της πράξης (ADR-948 §8.4): Αρ. ΓΕΜΗ της επαφής, αλλιώς ΑΦΜ (0 ⇒ «δεν βρέθηκε» · 1 ⇒ συνέχεια · >1 ⇒ λίστα,
 * ο άνθρωπος γράφει τον σωστό αριθμό στη φόρμα) → `lookup` → φράχτης «όχι φυσικό πρόσωπο» (§8.3) →
 * **άρνηση = τίποτα δεν αποθηκεύεται** → αλλιώς εγγραφή υπό συνθήκη → σύγκριση.
 *
 * | Ετυμηγορία | Τι γράφεται |
 * |---|---|
 * | `found` + `entity` | η απάντηση **αντικαθιστά** το αντίγραφο — μόνο αν η επαφή ρωτά ακόμη το ίδιο |
 * | `found` + `refused` | **τίποτα** (`logger.warn` για `unmapped`/`catalog-drift`: ο χάρτης θέλει άνθρωπο) |
 * | `absent` (με Αρ. ΓΕΜΗ) | σβήνεται **μόνο** το αντίγραφο αυτού του αριθμού |
 * | `unavailable` · `ambiguous` | **τίποτα** — η παλιά γνώση δεν ακυρώνεται από άγνοια |
 *
 * ⛔ Κανένα cron, καμία σάρωση: κάθε κλήση = μία ανθρώπινη χειρονομία (§8.2 #1 — όριο 8/λεπτό ανά κλειδί, §5.2).
 * 🔑 Η γραμμή Ιστορικού γράφεται από τον καλούντα (route) με το `recorded` — όπως στο πρότυπο.
 * **Layering**: service — συνθέτει μητρώο, αποθήκη, καθαρό φράχτη και καθαρή σύγκριση. Ό,τι έρχεται από έξω είναι εγχεόμενο.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { compareContactWithRegistry } from '@/lib/company/contact-registry-comparison';
import { classifyRegistryLegalForm, type LegalFormRefusal } from '@/lib/company/registry-legal-person';
import {
  contactRegistryFieldsOf,
  contactRegistryQueryOf,
  type StoredContactDocument,
} from '@/lib/contacts/contact-registry-subject';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { lookupRegistryCompany, lookupRegistryNumbersByTaxId } from '@/services/company-registry/gemi-opendata.client';
import type { RegistryCompanyRecord, RegistryLookupVerdict, RegistryTaxSearchVerdict } from '@/types/company-registry';
import type {
  ContactRegistryAttempt,
  ContactRegistryCheckRecord,
  ContactRegistryQuery,
  ContactRegistryReport,
} from '@/types/contact-registry-check';

import {
  forgetAbsentContactRegistryNumber,
  readContactRegistryCheck,
  recordContactRegistryCheck,
  type ContactRegistryCheckWrite,
} from './contact-registry-check-record.service';

const logger = createModuleLogger('contact-registry-check.service');

/** Ποια επαφή, ποιου χώρου — η επαφή από τον φορτωτή ιδιοκτησίας του καλούντος (`loadOwnedContact`). */
export interface ContactRegistryTarget {
  readonly contactRef: DocumentReference;
  readonly companyId: string;
  readonly contactId: string;
}

/** Ό,τι έρχεται από έξω — εγχεόμενο, ώστε οι άγκυρες να μην αγγίζουν δίκτυο, βάση ή ρολόι. */
export interface ContactRegistryDeps {
  readonly lookup: (registrationNumber: string) => Promise<RegistryLookupVerdict>;
  readonly searchByTaxId: (taxId: string) => Promise<RegistryTaxSearchVerdict>;
  readonly readStored: (companyId: string, contactId: string) => Promise<ContactRegistryCheckRecord | null>;
  readonly record: (write: ContactRegistryCheckWrite, record: RegistryCompanyRecord) => Promise<ContactRegistryCheckRecord | null>;
  readonly forgetAbsent: (companyId: string, contactId: string, registrationNumber: string) => Promise<boolean>;
  readonly now: () => string;
}

export function liveContactRegistryDeps(adminDb: AdminFirestore): ContactRegistryDeps {
  return {
    lookup: (registrationNumber) => lookupRegistryCompany(registrationNumber),
    searchByTaxId: (taxId) => lookupRegistryNumbersByTaxId(taxId),
    readStored: (companyId, contactId) => readContactRegistryCheck(adminDb, companyId, contactId),
    record: (write, record) => recordContactRegistryCheck(adminDb, write, record),
    forgetAbsent: (companyId, contactId, number) => forgetAbsentContactRegistryNumber(adminDb, companyId, contactId, number),
    now: nowISO,
  };
}

/** Αρνήσεις που σημαίνουν «ο χάρτης θέλει άνθρωπο» — όχι «το υποκείμενο είναι φυσικό πρόσωπο». */
const MAP_MAINTENANCE_REFUSALS: ReadonlySet<LegalFormRefusal> = new Set<LegalFormRefusal>(['unmapped', 'catalog-drift']);

/**
 * Η αναφορά: η σύγκριση υπολογίζεται **κάθε φορά** πάνω στην τρέχουσα επαφή. Η αποθηκευμένη απάντηση ξαναπερνά τον
 * φράχτη — αν ο χάρτης άλλαξε από τότε και την αρνείται, **δεν** συγκρίνεται.
 */
function reportOf(
  contact: StoredContactDocument,
  stored: ContactRegistryCheckRecord | null,
  attempt: ContactRegistryAttempt,
): ContactRegistryReport {
  if (stored === null) return { attempt, check: null, comparison: null };
  const check = { record: stored.record, checkedAt: stored.checkedAt };
  const verdict = classifyRegistryLegalForm(stored.record.legalForm);
  const comparison =
    verdict.kind === 'entity' ? compareContactWithRegistry(contactRegistryFieldsOf(contact), stored.record, verdict) : null;
  return { attempt, check, comparison };
}

/** **Ανάγνωση**: η κρίση από τα αποθηκευμένα. Καμία κλήση στο ΓΕΜΗ. */
export async function readContactRegistryReport(
  target: ContactRegistryTarget,
  contact: StoredContactDocument,
  deps: ContactRegistryDeps,
): Promise<ContactRegistryReport> {
  const stored = await deps.readStored(target.companyId, target.contactId);
  return reportOf(contact, stored, { kind: 'not-asked' });
}

type NumberResolution =
  | { readonly kind: 'number'; readonly registrationNumber: string }
  | { readonly kind: 'stop'; readonly attempt: ContactRegistryAttempt };

/** Ερώτημα ⇒ **ένας** Αρ. ΓΕΜΗ, ή στάση με τον λόγο της. Το ΑΦΜ δεν γράφεται ποτέ σε log. */
async function resolveNumber(query: ContactRegistryQuery, deps: ContactRegistryDeps): Promise<NumberResolution> {
  if (query.kind === 'none') return { kind: 'stop', attempt: { kind: 'no-identifier' } };
  if (query.kind === 'gemi-number') return { kind: 'number', registrationNumber: query.registrationNumber };
  const search = await deps.searchByTaxId(query.taxId);
  if (search.kind === 'invalid-tax-id') return { kind: 'stop', attempt: { kind: 'no-identifier' } };
  if (search.kind === 'unavailable') return { kind: 'stop', attempt: { kind: 'unavailable', reason: search.reason } };
  const [only, ...rest] = search.registrationNumbers;
  if (only === undefined) return { kind: 'stop', attempt: { kind: 'not-found' } };
  if (rest.length > 0) return { kind: 'stop', attempt: { kind: 'ambiguous', registrationNumbers: search.registrationNumbers } };
  return { kind: 'number', registrationNumber: only };
}

interface VerificationAct {
  readonly target: ContactRegistryTarget;
  readonly query: ContactRegistryQuery;
  readonly actorUid: string;
  readonly deps: ContactRegistryDeps;
}

export interface ContactRegistryRun {
  readonly report: ContactRegistryReport;
  /** Ό,τι γράφτηκε — για τη γραμμή Ιστορικού του καλούντος. `null` ⇒ καμία νέα γνώση. */
  readonly recorded: ContactRegistryCheckRecord | null;
}

/** Τι έμαθε η πράξη και τι γράφτηκε. */
type Outcome = { readonly attempt: ContactRegistryAttempt; readonly recorded: ContactRegistryCheckRecord | null };

/** Απάντηση που βρέθηκε ⇒ φράχτης ⇒ εγγραφή υπό συνθήκη. Άρνηση ⇒ **τίποτα** δεν αποθηκεύεται. */
async function settleFound(act: VerificationAct, record: RegistryCompanyRecord): Promise<Outcome> {
  const verdict = classifyRegistryLegalForm(record.legalForm);
  if (verdict.kind === 'refused') {
    if (MAP_MAINTENANCE_REFUSALS.has(verdict.reason)) {
      logger.warn('Νομική μορφή ΓΕΜΗ εκτός χάρτη — τρέξε `npm run gemi:catalog-diff`', {
        data: { reason: verdict.reason, gemiId: verdict.gemiId, contactId: act.target.contactId },
      });
    }
    return { attempt: { kind: 'refused', reason: verdict.reason }, recorded: null };
  }
  const { target, query, deps } = act;
  const write: ContactRegistryCheckWrite = { ...target, query, checkedAt: deps.now(), checkedBy: act.actorUid };
  const recorded = await deps.record(write, record);
  return { attempt: recorded === null ? { kind: 'contact-changed' } : { kind: 'asked' }, recorded };
}

/** Η ετυμηγορία της ερώτησης ⇒ τι έμαθε η πράξη και τι γράφτηκε. */
async function settleLookup(
  act: VerificationAct,
  registrationNumber: string,
  verdict: RegistryLookupVerdict,
): Promise<Outcome> {
  switch (verdict.kind) {
    case 'found':
      return settleFound(act, verdict.record);
    case 'absent':
      // Σβήνεται μόνο αν ο αριθμός ήταν της επαφής — αριθμός που βρέθηκε με ΑΦΜ και λείπει δεν αφορά αντίγραφο.
      if (act.query.kind === 'gemi-number') {
        await act.deps.forgetAbsent(act.target.companyId, act.target.contactId, registrationNumber);
      }
      return { attempt: { kind: 'not-found' }, recorded: null };
    case 'invalid-number':
      return { attempt: { kind: 'no-identifier' }, recorded: null };
    case 'unavailable':
      return { attempt: { kind: 'unavailable', reason: verdict.reason }, recorded: null };
  }
}

/**
 * **Πράξη**: ρωτά το ΓΕΜΗ για ό,τι κρατά **τώρα** η αποθηκευμένη επαφή. Επαφή που δεν είναι εταιρεία ⇒ ο καλών έχει
 * ήδη αρνηθεί (φρουρός της διαδρομής, `isCompanyContact`).
 */
export async function verifyContactRegistry(
  target: ContactRegistryTarget,
  contact: StoredContactDocument,
  actorUid: string,
  deps: ContactRegistryDeps,
): Promise<ContactRegistryRun> {
  const query = contactRegistryQueryOf(contact);
  const resolution = await resolveNumber(query, deps);
  let outcome: Outcome = {
    attempt: resolution.kind === 'stop' ? resolution.attempt : { kind: 'not-asked' },
    recorded: null,
  };
  if (resolution.kind === 'number') {
    const verdict = await deps.lookup(resolution.registrationNumber);
    outcome = await settleLookup({ target, query, actorUid, deps }, resolution.registrationNumber, verdict);
  }
  const stored = outcome.recorded ?? (await deps.readStored(target.companyId, target.contactId));
  return { report: reportOf(contact, stored, outcome.attempt), recorded: outcome.recorded };
}
