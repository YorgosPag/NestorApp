/**
 * @fileoverview **Το στιγμιότυπο που παγώνει στο `issue`** — έγγραφο χωρίς κύκλο ζωής + κείμενα ρητρών στην ακριβή
 *   τους έκδοση + αποτύπωμα (ADR-928 §5.6 · Φ2 απόφαση 13).
 * @module subapps/procurement/subcontracts/agreements/agreement-snapshot
 *
 * 🔑 Το αποτύπωμα είναι `sha256(canonicalJson(snapshot))` — το **ίδιο** μοτίβο με τα αμετάβλητα νομικά κείμενα
 * (ADR-861) και με το `contentHash` των εκδόσεων ρήτρας: κανένας δεύτερος ορισμός του «ίδιο περιεχόμενο».
 * 🔑 Δίγλωσσο έγγραφο (§5.2.2): η δεύτερη γλώσσα τυπώνεται μόνο αν **κάθε** ρήτρα έχει **εγκεκριμένη** μετάφραση πάνω
 * στο **τρέχον** ελληνικό της καρφωμένης έκδοσης — αλλιώς η έκδοση μπλοκάρεται, όχι μισό δίγλωσσο χαρτί.
 */

import { sha256HexOfText } from '@/lib/hash/sha256';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import type {
  FrozenClause,
  SubcontractAgreement,
  SubcontractAgreementContent,
  SubcontractAgreementLifecycleField,
  SubcontractAgreementSnapshot,
} from '../types/agreement';
import type { SubcontractClause, SubcontractClauseVersion } from '../types/clause';
import type { ClauseLanguage, ClauseParameterValue } from '../types/clause-parameter';
import type { ClauseSelection, CommercialTerms } from '../types/commercial-terms';
import { resolveParameterValue } from './judge-deviations';

/** Η ρήτρα και η καρφωμένη της έκδοση, όπως τις διάβασε ο γραφέας. */
export interface PinnedClause {
  readonly clause: SubcontractClause;
  readonly version: SubcontractClauseVersion;
}

/** Οι μεταφράσεις που **ισχύουν**: εγκεκριμένες και γραμμένες πάνω στο τρέχον ελληνικό. */
function liveTranslations(version: SubcontractClauseVersion): Record<ClauseLanguage, SubcontractClauseVersion['translations'][string]> {
  return Object.fromEntries(
    Object.entries(version.translations).filter(([, translation]) => translation.status === 'approved' && translation.sourceHash === version.sourceHash),
  );
}

export function frozenClauseOf(selection: ClauseSelection, pinned: PinnedClause, terms: CommercialTerms): FrozenClause {
  const values: Record<string, ClauseParameterValue> = {};
  for (const definition of pinned.version.parameters) {
    const value = resolveParameterValue(definition, selection.parameterValues, terms);
    if (value !== null) values[definition.key] = value;
  }
  return {
    clauseId: selection.clauseId,
    clauseKey: selection.clauseKey,
    version: selection.version,
    contentHash: pinned.version.contentHash,
    title: pinned.clause.title,
    body: pinned.version.body,
    parameters: pinned.version.parameters,
    translations: liveTranslations(pinned.version),
    values,
  };
}

/** Δίγλωσσο: κάθε παγωμένη ρήτρα πρέπει να έχει τη δεύτερη γλώσσα — αλλιώς ένα εύρημα ανά ρήτρα που λείπει. */
export function bilingualIssues(frozen: readonly FrozenClause[], secondary: ClauseLanguage | null): SubcontractIssue[] {
  if (secondary === null) return [];
  return frozen.flatMap((clause, index) =>
    clause.translations[secondary] ? [] : [{ code: 'translationMissing' as const, path: joinPath('clauses', index, 'translations', secondary) }],
  );
}

/**
 * Το **περιεχόμενο** ενός εγγράφου χωρίς περίβλημα — η **μία** απαρίθμηση, για το στιγμιότυπο και για τη γέννηση του
 * συμφωνητικού του Τρόπου Β. 🔑 **Ρητή**, όχι φίλτρο: νέο πεδίο στο `SubcontractAgreement` σπάει τη μεταγλώττιση εδώ ⇒
 * κάποιος αποφασίζει **αν είναι περιεχόμενο** (παγώνει, αντιγράφεται), αντί να μπει σιωπηλά.
 */
export function agreementContentOf(agreement: SubcontractAgreement): SubcontractAgreementContent {
  return {
    documentMode: agreement.documentMode,
    origin: agreement.origin,
    trade: agreement.trade,
    templateId: agreement.templateId,
    title: agreement.title,
    parties: agreement.parties,
    scope: agreement.scope,
    projectIds: agreement.projectIds,
    lines: agreement.lines,
    terms: agreement.terms,
    clauses: agreement.clauses,
    languages: agreement.languages,
    validUntil: agreement.validUntil,
  };
}

/** Το έγγραφο χωρίς τα πεδία κύκλου ζωής (ταυτότητα + περιεχόμενο), με τα κείμενα των ρητρών. */
export function buildAgreementSnapshot(agreement: SubcontractAgreement, frozenClauses: readonly FrozenClause[]): SubcontractAgreementSnapshot {
  const frozen: Omit<SubcontractAgreement, SubcontractAgreementLifecycleField> = {
    ...agreementContentOf(agreement),
    id: agreement.id,
    companyId: agreement.companyId,
    documentNumber: agreement.documentNumber,
    role: agreement.role,
    sourceOfferId: agreement.sourceOfferId,
    agreementId: agreement.agreementId,
    mobilizedOn: agreement.mobilizedOn,
    createdBy: agreement.createdBy,
  };
  return { ...frozen, frozenClauses };
}

/** sha256 του canonical JSON — ίδια είσοδος ⇒ ίδιο αποτύπωμα, ανεξάρτητα από τη σειρά των κλειδιών. */
export function agreementSnapshotHash(snapshot: SubcontractAgreementSnapshot): Promise<string> {
  return sha256HexOfText(canonicalJson(snapshot));
}
