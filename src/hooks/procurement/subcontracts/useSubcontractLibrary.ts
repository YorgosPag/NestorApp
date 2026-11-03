'use client';

/**
 * Η **βιβλιοθήκη ρητρών** και τα **πρότυπα ειδικότητας** του χώρου, ζωντανά στον πελάτη (ADR-928 §5.2 · §5.3 · Φ3α-2).
 *
 * 🔑 Η έξοδος είναι η **ίδια** `ApprovedLibrary` που διαβάζει ο γραφέας μέσα στη συναλλαγή (`approved-library.ts`, μία
 *    προβολή): ο **ίδιος** `judgeClauseSelections` τρέχει στην οθόνη και στον διακομιστή. Ένα κουμπί «Έκδοση» που
 *    ανάβει μόνο όταν ο διακομιστής θα δεχτεί — όχι 422 μετά το κλικ.
 * 🔑 Ρήτρες και πρότυπα από το `useProcurementCatalogList` (ζωντάνια = `isArchived`)· η έκδοση **σε ισχύ** κάθε ρήτρας
 *    από τη δική της υποσυλλογή, ένα ερώτημα ισοτήτων ανά ρήτρα (`companyId` ρητά: οι κανόνες κρίνουν το `companyId` της
 *    έκδοσης, και η υποσυλλογή δεν παίρνει φίλτρο χώρου από την υπηρεσία). Επανεγγραφή **μόνο** όταν αλλάζει το ζεύγος
 *    (ρήτρα, έκδοση σε ισχύ) — όχι σε κάθε στιγμιότυπο της λίστας.
 * 🔑 Fail-closed: όσο μια έκδοση δεν έχει φτάσει, η ρήτρα κρίνεται «χωρίς έκδοση σε ισχύ» (`loading` = `true`).
 * @module hooks/procurement/subcontracts/useSubcontractLibrary
 */

import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
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

const clausesList: ProcurementCatalogListConfig<SubcontractClause> = {
  collection: 'SUBCONTRACT_CLAUSES',
  cache: createStaleCache<SubcontractClause[]>('subcontract-clauses'),
  compare: (a, b) => a.clauseKey.localeCompare(b.clauseKey),
  logger,
  label: 'Subcontract clauses',
  liveness: 'isArchived',
};

const templatesList: ProcurementCatalogListConfig<SubcontractTradeTemplate> = {
  collection: 'SUBCONTRACT_TRADE_TEMPLATES',
  cache: createStaleCache<SubcontractTradeTemplate[]>('subcontract-trade-templates'),
  compare: (a, b) => a.code.localeCompare(b.code),
  logger,
  label: 'Subcontract trade templates',
  liveness: 'isArchived',
};

/** Τα ενεργά πρότυπα ειδικότητας — το καλούπι κάθε νέου συμφωνητικού. */
export function useSubcontractTradeTemplates(): ProcurementCatalogList<SubcontractTradeTemplate> {
  return useProcurementCatalogList(templatesList);
}

/** Το ζεύγος (ρήτρα, έκδοση σε ισχύ) — το μόνο που αποφασίζει ποια έκδοση ακούμε. */
interface PinTarget {
  readonly clauseId: string;
  readonly version: number;
}

function pinTargetsOf(clauses: readonly SubcontractClause[]): PinTarget[] {
  return clauses.flatMap((clause) =>
    clause.isArchived || clause.currentVersion === null ? [] : [{ clauseId: clause.id, version: clause.currentVersion }],
  );
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

/** Μία συνδρομή ανά ρήτρα: η έκδοση με τον αριθμό που λέει το `currentVersion`. */
function subscribePinnedVersions(
  companyId: string,
  targets: readonly PinTarget[],
  onAnswer: (target: PinTarget, version: SubcontractClauseVersion | null) => void,
): () => void {
  const unsubscribers = targets.map((target) =>
    firestoreQueryService.subscribeSubcollection<Record<string, unknown>>(
      'SUBCONTRACT_CLAUSES',
      target.clauseId,
      SUBCOLLECTIONS.SUBCONTRACT_CLAUSE_VERSIONS,
      (result) => onAnswer(target, (result.documents[0] as unknown as SubcontractClauseVersion | undefined) ?? null),
      (error) => logger.warn('Clause version subscription error', { clauseId: target.clauseId, error: error.message }),
      { constraints: [where('companyId', '==', companyId), where('version', '==', target.version)] },
    ),
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

interface PinnedVersions {
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

function usePinnedVersions(clauses: readonly SubcontractClause[]): PinnedVersions {
  const companyId = useCompanyId()?.companyId;
  const pinKey = pinKeyOf(pinTargetsOf(clauses));
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
  readonly clauses: readonly SubcontractClause[];
  /** Η είσοδος του κριτή — ίδια μορφή με του γραφέα. */
  readonly library: ApprovedLibrary;
  /** Ρήτρες ή εκδόσεις σε ισχύ που δεν έχουν φτάσει ακόμη. */
  readonly loading: boolean;
  readonly error: string | null;
}

/** Οι ζωντανές ρήτρες του χώρου και η εγκεκριμένη βιβλιοθήκη τους. */
export function useSubcontractClauseLibrary(): SubcontractClauseLibrary {
  const { items: clauses, loading, error } = useProcurementCatalogList(clausesList);
  const pinned = usePinnedVersions(clauses);
  const library = useMemo(() => approvedLibraryFrom(clauses, pinned.versions), [clauses, pinned.versions]);
  return { clauses, library, loading: loading || pinned.pending, error };
}
