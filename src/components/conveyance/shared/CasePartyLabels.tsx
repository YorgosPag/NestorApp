'use client';

/**
 * ADR-915 §23.10 — «ποιος;» στη διεπαφή: η ΜΙΑ απόδοση ετικέτας γραμμής και ονόματος προσώπου, για τον οικοδεσπότη
 * **και** τον επαγγελματία (ίδια components καταλόγου, ίδιος πάροχος).
 *
 * Πριν από εδώ η ετικέτα γραμμής ήταν `t(row.item.labelKey)` γραμμένο σε πέντε σημεία — και με δύο πωλητές έδινε δύο
 * ίδιες γραμμές «ΕΝΦΙΑ». Τώρα κάθε σημείο ρωτά το `useChecklistRowLabel` / `useRowKeyLabel`: «ΕΝΦΙΑ · <όνομα>» όταν
 * χρειάζεται «ποιος», αλλιώς
 * όπως πριν. Όνομα που λείπει ⇒ «Πωλητής N» (N.11)· η απόφαση «πότε» ζει στο `lib/conveyance/party-labels`.
 *
 * Τις ετικέτες τις δίνει ο server (`view.parties`) — για τον επαγγελματία **ήδη** κομμένες στα πρόσωπα των γραμμών του.
 *
 * @module components/conveyance/shared/CasePartyLabels
 */

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { checklistItemOfRowKey } from '@/config/conveyance-checklist/row-key';
import { casePartyLabels, partyLabelOf, partyLabelOfRowKey, partyNamesOf } from '@/lib/conveyance/party-labels';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import type { CasePartyLabel, ChecklistRow, ConveyanceSellerParty } from '@/types/conveyance-case';

const NO_LABELS: readonly CasePartyLabel[] = [];

const CasePartyLabelsContext = createContext<readonly CasePartyLabel[]>(NO_LABELS);

export function CasePartyLabelsProvider({ labels, children }: { readonly labels: readonly CasePartyLabel[]; readonly children: React.ReactNode }) {
  return <CasePartyLabelsContext.Provider value={labels}>{children}</CasePartyLabelsContext.Provider>;
}

interface HostCasePartyLabelsProviderProps {
  /** Τα πρόσωπα της **τρέχουσας** υπόθεσης — μετά από optimistic εντολή μπορεί να είναι νεότερα από την όψη. */
  readonly sellers: readonly ConveyanceSellerParty[];
  /** Οι ετικέτες της τελευταίας όψης του server (μόνο τα ονόματά τους ξαναχρησιμοποιούνται). */
  readonly labels: readonly CasePartyLabel[];
  readonly children: React.ReactNode;
}

/**
 * Ο οικοδεσπότης: η σειρά ξαναμετριέται από την **τρέχουσα** λίστα προσώπων με τον ΙΔΙΟ κανόνα του server
 * (`casePartyLabels`) — πρόσωπο που μόλις μπήκε δείχνει «Πωλητής N» ώσπου η απάντηση να φέρει το όνομα.
 */
export function HostCasePartyLabelsProvider({ sellers, labels, children }: HostCasePartyLabelsProviderProps) {
  const current = useMemo(() => casePartyLabels(sellers, partyNamesOf(labels)), [sellers, labels]);
  return <CasePartyLabelsProvider labels={current}>{children}</CasePartyLabelsProvider>;
}

type Translate =(key: string, params?: Record<string, string | number>) => string;

function displayOf(label: CasePartyLabel, t: Translate): string {
  return label.name !== '' ? label.name : t('parties.sellerOrdinal', { index: label.ordinal });
}

/** Το όνομα ενός προσώπου — `null` για την υπόθεση ή όταν δεν χρειάζεται «ποιος» (≤ 1 ορατό πρόσωπο). */
export function usePartyName(): (partyKey: string | null) => string | null {
  const labels = useContext(CasePartyLabelsContext);
  const { t } = useTranslation(['conveyance']);
  return useCallback((partyKey) => {
    const label = partyLabelOf(labels, partyKey);
    return label === null ? null : displayOf(label, t);
  }, [labels, t]);
}

/** Ο ΕΝΑΣ τύπος της ετικέτας: το έγγραφο, και το πρόσωπο μόνο όταν χρειάζεται «ποιος». */
function rowLabelOf(labels: readonly CasePartyLabel[], t: Translate, item: Pick<ChecklistItem, 'labelKey'>, rowKey: string): string {
  const label = partyLabelOfRowKey(labels, rowKey);
  return label === null ? t(item.labelKey) : t('parties.rowLabel', { item: t(item.labelKey), party: displayOf(label, t) });
}

/** Η ετικέτα μιας γραμμής που ήδη κρατάς (κατάλογος · διάλογοι). */
export function useChecklistRowLabel(): (row: Pick<ChecklistRow, 'itemId' | 'item'>) => string {
  const labels = useContext(CasePartyLabelsContext);
  const { t } = useTranslation(['conveyance']);
  return useCallback((row) => rowLabelOf(labels, t, row.item, row.itemId), [labels, t]);
}

/** Η ετικέτα από **σκέτο κλειδί** γραμμής (ίχνος) — `null` όταν το κλειδί δεν αντιστοιχεί σε γραμμή του καταλόγου. */
export function useRowKeyLabel(): (rowKey: string) => string | null {
  const labels = useContext(CasePartyLabelsContext);
  const { t } = useTranslation(['conveyance']);
  return useCallback((rowKey) => {
    const item = checklistItemOfRowKey(rowKey);
    return item === undefined ? null : rowLabelOf(labels, t, item, rowKey);
  }, [labels, t]);
}
