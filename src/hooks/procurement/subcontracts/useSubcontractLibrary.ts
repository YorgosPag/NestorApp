'use client';

/**
 * Η **βιβλιοθήκη ρητρών** και τα **πρότυπα ειδικότητας** του χώρου, ζωντανά στον πελάτη (ADR-928 §5.2 · §5.3 · Φ3α-2 ·
 * Φ3γ-0).
 *
 * 🔑 Η έξοδος είναι η **ίδια** `ApprovedLibrary` που διαβάζει ο γραφέας μέσα στη συναλλαγή (`approved-library.ts`, μία
 *    προβολή): ο **ίδιος** `judgeClauseSelections` τρέχει στην οθόνη και στον διακομιστή. Ένα κουμπί «Έκδοση» που
 *    ανάβει μόνο όταν ο διακομιστής θα δεχτεί — όχι 422 μετά το κλικ.
 * 🔑 Ρήτρες και πρότυπα από το `useProcurementCatalogList` (ζωντάνια = `isArchived`, ή όλα για τη βιβλιοθήκη)· οι
 *    εκδόσεις από τη δική τους υποσυλλογή, με **έναν** αναγνώστη (`subscribeClauseVersions`, `companyId` ρητά: οι κανόνες
 *    κρίνουν το `companyId` της έκδοσης, και η υποσυλλογή δεν παίρνει φίλτρο χώρου από την υπηρεσία). Η έκδοση σε ισχύ
 *    και η ανοιχτή πρόταση είναι **ο ίδιος** μηχανισμός με άλλο κριτήριο στόχου (`currentVersion` · `openProposal`):
 *    επανεγγραφή **μόνο** όταν αλλάζει το ζεύγος (ρήτρα, έκδοση) — όχι σε κάθε στιγμιότυπο της λίστας.
 * 🔑 Fail-closed: όσο μια έκδοση δεν έχει φτάσει, η ρήτρα κρίνεται «χωρίς έκδοση σε ισχύ» (`loading` = `true`), και
 *    καμία πρόταση δεν μπαίνει στην ουρά χωρίς ορατό κείμενο (`reviewQueueOf`).
 * @module hooks/procurement/subcontracts/useSubcontractLibrary
 */

import { useEffect, useMemo, useState } from 'react';
import { where, type QueryConstraint } from 'firebase/firestore';
import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { approvedLibraryFrom } from '@/subapps/procurement/subcontracts/agreements/approved-library';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { useProcurementCatalogList, type ProcurementCatalogList, type ProcurementCatalogListConfig } from '../useProcurementCatalogList';

const logger = createModuleLogger('useSubcontractLibrary');

const byClauseKey = (a: SubcontractClause, b: SubcontractClause) => a.clauseKey.localeCompare(b.clauseKey);
const byTemplateCode = (a: SubcontractTradeTemplate, b: SubcontractTradeTemplate) => a.code.localeCompare(b.code);

// Δύο σταθερές ανά συλλογή (το `config` είναι εξάρτηση της συνδρομής): ζωντανές μόνο · όλες, για την οθόνη της βιβλιοθήκης.
const clausesList: ProcurementCatalogListConfig<SubcontractClause> = {
  collection: 'SUBCONTRACT_CLAUSES', cache: createStaleCache<SubcontractClause[]>('subcontract-clauses'),
  compare: byClauseKey, logger, label: 'Subcontract clauses', liveness: 'isArchived',
};
const allClausesList: ProcurementCatalogListConfig<SubcontractClause> = {
  collection: 'SUBCONTRACT_CLAUSES', cache: createStaleCache<SubcontractClause[]>('subcontract-clauses-all'),
  compare: byClauseKey, logger, label: 'Subcontract clauses (with archived)', liveness: null,
};
const templatesList: ProcurementCatalogListConfig<SubcontractTradeTemplate> = {
  collection: 'SUBCONTRACT_TRADE_TEMPLATES', cache: createStaleCache<SubcontractTradeTemplate[]>('subcontract-trade-templates'),
  compare: byTemplateCode, logger, label: 'Subcontract trade templates', liveness: 'isArchived',
};
const allTemplatesList: ProcurementCatalogListConfig<SubcontractTradeTemplate> = {
  collection: 'SUBCONTRACT_TRADE_TEMPLATES', cache: createStaleCache<SubcontractTradeTemplate[]>('subcontract-trade-templates-all'),
  compare: byTemplateCode, logger, label: 'Subcontract trade templates (with archived)', liveness: null,
};

export interface LibraryListOptions {
  /** Και οι αρχειοθετημένες — για τη βιβλιοθήκη (επαναφορά), ποτέ για το «Νέο». */
  readonly includeArchived?: boolean;
}

/** Τα πρότυπα ειδικότητας — το καλούπι κάθε νέου συμφωνητικού (εξ ορισμού μόνο τα ενεργά). */
export function useSubcontractTradeTemplates(options: LibraryListOptions = {}): ProcurementCatalogList<SubcontractTradeTemplate> {
  return useProcurementCatalogList(options.includeArchived ? allTemplatesList : templatesList);
}

/** Ο **ένας** αναγνώστης εκδόσεων μιας ρήτρας: ζωντανά, μέσα στον χώρο, με επιπλέον περιορισμούς ισότητας. */
export function subscribeClauseVersions(
  companyId: string,
  clauseId: string,
  constraints: readonly QueryConstraint[],
  onVersions: (versions: SubcontractClauseVersion[]) => void,
): () => void {
  return firestoreQueryService.subscribeSubcollection<Record<string, unknown>>(
    'SUBCONTRACT_CLAUSES',
    clauseId,
    SUBCOLLECTIONS.SUBCONTRACT_CLAUSE_VERSIONS,
    (result) => onVersions(result.documents as unknown as SubcontractClauseVersion[]),
    (error) => logger.warn('Clause version subscription error', { clauseId, error: error.message }),
    { constraints: [where('companyId', '==', companyId), ...constraints] },
  );
}

/** Το ζεύγος (ρήτρα, έκδοση) — το μόνο που αποφασίζει ποια έκδοση ακούμε. */
interface PinTarget {
  readonly clauseId: string;
  readonly version: number;
}

/** Ποια έκδοση μιας ρήτρας ακούμε: σε ισχύ (`currentVersion`) ή ανοιχτή πρόταση (`openProposal`). */
type PinField = 'currentVersion' | 'openProposal';

function pinTargetsOf(clauses: readonly SubcontractClause[], field: PinField): PinTarget[] {
  return clauses.flatMap((clause) => {
    const version = clause[field];
    return clause.isArchived || version === null ? [] : [{ clauseId: clause.id, version }];
  });
}

/** Η ταυτότητα ενός στόχου: ρήτρα **και** έκδοση — η απάντηση για την έκδοση 3 δεν ισχύει για την 4. */
const targetKeyOf = (target: PinTarget): string => JSON.stringify([target.clauseId, target.version]);

/** Σταθερό κλειδί του συνόλου στόχων: ίδιο σύνολο ⇒ καμία επανεγγραφή. */
function pinKeyOf(targets: readonly PinTarget[]): string {
  return JSON.stringify(targets.map((target) => [target.clauseId, target.version]));
}

function targetsOfPinKey(pinKey: string): PinTarget[] {
  return (JSON.parse(pinKey) as [string, number][]).map(([clauseId, version]) => ({ clauseId, version }));
}

/** Απάντηση ανά στόχο: η έκδοση, ή `null` = «ρωτήθηκε και δεν υπάρχει» (≠ «δεν απάντησε ακόμη»). */
type PinAnswers = ReadonlyMap<string, SubcontractClauseVersion | null>;

/** Μία συνδρομή ανά ρήτρα: η έκδοση με τον αριθμό του στόχου. */
function subscribePinnedVersions(
  companyId: string,
  targets: readonly PinTarget[],
  onAnswer: (target: PinTarget, version: SubcontractClauseVersion | null) => void,
): () => void {
  const unsubscribers = targets.map((target) =>
    subscribeClauseVersions(companyId, target.clauseId, [where('version', '==', target.version)], (versions) => onAnswer(target, versions[0] ?? null)),
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export interface PinnedVersions {
  /** Ανά id ρήτρας, μόνο οι εκδόσεις που **βρέθηκαν** για τον τρέχοντα στόχο. */
  readonly versions: ReadonlyMap<string, SubcontractClauseVersion>;
  readonly pending: boolean;
}

function pinnedVersionsOf(targets: readonly PinTarget[], answers: PinAnswers): PinnedVersions {
  const versions = new Map<string, SubcontractClauseVersion>();
  let pending = false;
  for (const target of targets) {
    const answer = answers.get(targetKeyOf(target));
    if (answer === undefined) pending = true;
    else if (answer !== null) versions.set(target.clauseId, answer);
  }
  return { versions, pending };
}

function usePinnedVersions(clauses: readonly SubcontractClause[], field: PinField): PinnedVersions {
  const companyId = useCompanyId()?.companyId;
  const pinKey = pinKeyOf(pinTargetsOf(clauses, field));
  const [answers, setAnswers] = useState<PinAnswers>(() => new Map());

  useEffect(() => {
    if (!companyId) return undefined;
    return subscribePinnedVersions(companyId, targetsOfPinKey(pinKey), (target, version) =>
      setAnswers((previous) => new Map(previous).set(targetKeyOf(target), version)),
    );
  }, [companyId, pinKey]);

  return useMemo(() => pinnedVersionsOf(targetsOfPinKey(pinKey), answers), [pinKey, answers]);
}

export interface SubcontractClauseLibrary {
  /** Οι ρήτρες — μόνο οι ζωντανές, ή και οι αρχειοθετημένες με `includeArchived`. */
  readonly clauses: readonly SubcontractClause[];
  /** Η είσοδος του κριτή — ίδια μορφή με του γραφέα (πάντα **χωρίς** τις αρχειοθετημένες). */
  readonly library: ApprovedLibrary;
  /** Οι εκδόσεις σε ισχύ ανά id ρήτρας — τα κείμενα που χρειάζεται η προεπισκόπηση εγγράφου (ADR-928 §5.17). */
  readonly versions: ReadonlyMap<string, SubcontractClauseVersion>;
  /** Ρήτρες ή εκδόσεις σε ισχύ που δεν έχουν φτάσει ακόμη. */
  readonly loading: boolean;
  readonly error: string | null;
}

/** Οι ρήτρες του χώρου και η εγκεκριμένη βιβλιοθήκη τους. */
export function useSubcontractClauseLibrary(options: LibraryListOptions = {}): SubcontractClauseLibrary {
  const { items: clauses, loading, error } = useProcurementCatalogList(options.includeArchived ? allClausesList : clausesList);
  const pinned = usePinnedVersions(clauses, 'currentVersion');
  const library = useMemo(() => approvedLibraryFrom(clauses, pinned.versions), [clauses, pinned.versions]);
  return { clauses, library, versions: pinned.versions, loading: loading || pinned.pending, error };
}

/** Οι **ανοιχτές προτάσεις** των ρητρών (ανά id ρήτρας) — η είσοδος της ουράς ελέγχου (`reviewQueueOf`). */
export function useClauseProposals(clauses: readonly SubcontractClause[]): PinnedVersions {
  return usePinnedVersions(clauses, 'openProposal');
}

export interface ClauseVersionHistory {
  /** Όλες οι εκδόσεις, νεότερη πρώτη. */
  readonly versions: readonly SubcontractClauseVersion[];
  readonly loading: boolean;
}

const NO_HISTORY: ClauseVersionHistory = { versions: [], loading: false };
const LOADING_HISTORY: ClauseVersionHistory = { versions: [], loading: true };

/**
 * Το χρονολόγιο μιας ρήτρας, ζωντανά — για ιστορικό και σύγκριση οποιωνδήποτε δύο εκδόσεων. Ταξινόμηση στον πελάτη:
 * μόνο ισότητα `companyId` στο ερώτημα (κανένας σύνθετος δείκτης), και οι εκδόσεις μιας ρήτρας είναι λίγες.
 * Αποτέλεσμα άλλης ρήτρας δεν φαίνεται ποτέ (κλειδί ανά id).
 */
export function useClauseVersions(clauseId: string | null): ClauseVersionHistory {
  const companyId = useCompanyId()?.companyId;
  const [read, setRead] = useState<{ readonly clauseId: string; readonly versions: readonly SubcontractClauseVersion[] } | null>(null);

  useEffect(() => {
    if (!companyId || clauseId === null) return undefined;
    return subscribeClauseVersions(companyId, clauseId, [], (versions) =>
      setRead({ clauseId, versions: [...versions].sort((a, b) => b.version - a.version) }),
    );
  }, [companyId, clauseId]);

  if (clauseId === null) return NO_HISTORY;
  return read !== null && read.clauseId === clauseId ? { versions: read.versions, loading: false } : LOADING_HISTORY;
}
