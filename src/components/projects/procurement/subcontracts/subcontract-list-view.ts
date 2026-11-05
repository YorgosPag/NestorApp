/**
 * @fileoverview **Η λίστα συμφωνητικών ενός έργου ως δεδομένα** — καθαρό, χωρίς React (ADR-928 §5.14 · Φ3α-2).
 * @module components/projects/procurement/subcontracts/subcontract-list-view
 *
 * 🔑 Πρότυπο Procore «Commitments»: ποσό ανά σύμβαση και **σύνολα ανά φάση** — πόσα έχουν **δεσμευτεί** (αποδεκτά, σε
 *    εκτέλεση, ολοκληρωμένα) και πόσα **εκκρεμούν** (πρόχειρα, εκδοθέντα). Πέρα από τον Procore: το ποσό λέει **ρητά**
 *    όταν είναι κατώτατο (γραμμές τιμής μονάδας χωρίς εκτίμηση ποσότητας), αντί να τις μετρά σιωπηλά ως μηδέν.
 * 🔑 Κύρια σύμβαση (`multi_project`): η γραμμή δείχνει την **εντολή εργασίας προς αυτό το έργο** (έναρξη) — το συμφωνητικό
 *    είναι κοινό, η ανάθεση είναι του έργου (AIA A421/A422).
 */

import type { MinorAmount } from '@/lib/money/money';
import type { CalendarDay } from '@/constants/platform-operator';
import { estimatedAgreementValue, type EstimatedValue } from '@/subapps/procurement/subcontracts/lines/line-amount';
import { hasUnapprovedDeviations } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import {
  SUBCONTRACT_AGREEMENT_STATUSES,
  type SubcontractAgreement,
  type SubcontractAgreementStatus,
} from '@/subapps/procurement/subcontracts/types/agreement';

/** Φάσεις για τα σύνολα — η ίδια λέξη στη σύνοψη και στον πίνακα. */
export const COMMITTED_STATUSES: readonly SubcontractAgreementStatus[] = ['accepted', 'in_execution', 'completed'];
export const PENDING_STATUSES: readonly SubcontractAgreementStatus[] = ['draft', 'issued'];

/** Το λεξιλόγιο του φίλτρου `?status=` — τα κλειδιά **είναι** οι καταστάσεις, χωρίς δεύτερη λίστα. */
export const SUBCONTRACT_STATUS_VOCABULARY: Readonly<Record<SubcontractAgreementStatus, true>> = Object.fromEntries(
  SUBCONTRACT_AGREEMENT_STATUSES.map((status) => [status, true]),
) as Record<SubcontractAgreementStatus, true>;

/** Η εντολή εργασίας **αυτού** του έργου σε κύρια σύμβαση. */
export interface ProjectAssignmentView {
  readonly startDate: CalendarDay | null;
  readonly durationDays: number | null;
}

export interface SubcontractListRow {
  readonly agreement: SubcontractAgreement;
  readonly value: EstimatedValue;
  /** Εκκρεμής ή απορριφθείσα απόκλιση — μπλοκάρει την έκδοση (§5.14 απόφαση 6). */
  readonly deviationsOpen: boolean;
  /** Μόνο σε κύρια σύμβαση: η ανάθεση σε αυτό το έργο (στη λίστα έργου). */
  readonly assignment: ProjectAssignmentView | null;
  /** Μόνο σε κύρια σύμβαση: πόσες εντολές εργασίας, σε πόσα διαφορετικά έργα (στη λίστα της εταιρείας, §5.24). */
  readonly workOrders: { readonly count: number; readonly projects: number } | null;
}

function assignmentOf(agreement: SubcontractAgreement, projectId: string | null): ProjectAssignmentView | null {
  if (agreement.scope.kind !== 'multi_project' || projectId === null) return null;
  const own = agreement.scope.assignments.find((assignment) => assignment.project.projectId === projectId);
  return own ? { startDate: own.startDate, durationDays: own.durationDays } : null;
}

function workOrdersOf(agreement: SubcontractAgreement): SubcontractListRow['workOrders'] {
  if (agreement.scope.kind !== 'multi_project') return null;
  const { assignments } = agreement.scope;
  return { count: assignments.length, projects: new Set(assignments.map((assignment) => assignment.project.projectId)).size };
}

/** `projectId`: το έργο της λίστας· `null` στη λίστα κύριων συμβάσεων της εταιρείας. */
export function toListRows(agreements: readonly SubcontractAgreement[], projectId: string | null): SubcontractListRow[] {
  return agreements.map((agreement) => ({
    agreement,
    value: estimatedAgreementValue(agreement.lines),
    deviationsOpen: hasUnapprovedDeviations(agreement.clauses),
    assignment: assignmentOf(agreement, projectId),
    workOrders: workOrdersOf(agreement),
  }));
}

/** Ό,τι αναζητείται: αριθμός εγγράφου, υπεργολάβος, ΑΦΜ, τίτλος σε **κάθε** γλώσσα (όχι μόνο της οθόνης). */
function searchableText({ agreement }: SubcontractListRow): string {
  const { subcontractor } = agreement.parties;
  return [agreement.documentNumber, subcontractor.name, subcontractor.vatNumber ?? '', ...Object.values(agreement.title)]
    .join(' ')
    .toLocaleLowerCase();
}

export function filterListRows(
  rows: readonly SubcontractListRow[],
  statuses: readonly SubcontractAgreementStatus[],
  search: string,
): SubcontractListRow[] {
  const needle = search.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (statuses.length === 0 || statuses.includes(row.agreement.status)) &&
      (needle === '' || searchableText(row).includes(needle)),
  );
}

export interface PhaseTotal {
  readonly count: number;
  readonly amount: MinorAmount;
  /** Πόσα από αυτά έχουν μόνο κατώτατο ποσό. */
  readonly partial: number;
}

export type StatusTotals = Readonly<Record<SubcontractAgreementStatus, PhaseTotal>>;

const EMPTY_TOTAL: PhaseTotal = { count: 0, amount: 0, partial: 0 };

function add(total: PhaseTotal, value: EstimatedValue): PhaseTotal {
  return { count: total.count + 1, amount: total.amount + value.amount, partial: total.partial + (value.unpricedLines > 0 ? 1 : 0) };
}

export function statusTotals(rows: readonly SubcontractListRow[]): StatusTotals {
  const totals = Object.fromEntries(SUBCONTRACT_AGREEMENT_STATUSES.map((status) => [status, EMPTY_TOTAL])) as Record<
    SubcontractAgreementStatus,
    PhaseTotal
  >;
  for (const row of rows) totals[row.agreement.status] = add(totals[row.agreement.status], row.value);
  return totals;
}

/** Το άθροισμα μιας φάσης (π.χ. δεσμευμένα) από τα σύνολα ανά κατάσταση. */
export function phaseTotal(totals: StatusTotals, statuses: readonly SubcontractAgreementStatus[]): PhaseTotal {
  return statuses.reduce(
    (sum, status) => ({
      count: sum.count + totals[status].count,
      amount: sum.amount + totals[status].amount,
      partial: sum.partial + totals[status].partial,
    }),
    EMPTY_TOTAL,
  );
}
