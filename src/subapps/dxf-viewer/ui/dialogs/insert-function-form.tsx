'use client';

/**
 * ADR-763 §9 — **η όψη** του διαλόγου «Εισαγωγή συνάρτησης»: αναζήτηση, κατηγορία, λίστα,
 * υπογραφή, περιγραφή, κουμπιά. Χωρίς store και χωρίς i18n — όλα τα κείμενα φτάνουν έτοιμα.
 *
 * ## Η σειρά των στοιχείων ΕΙΝΑΙ η προδιαγραφή
 * Είναι η σειρά του Excel, από πάνω προς τα κάτω, και δεν είναι αισθητική: ο χρήστης που
 * **ξέρει** το όνομα το πληκτρολογεί στο πρώτο πεδίο και τελειώνει· ο χρήστης που **δεν** το
 * ξέρει κατεβαίνει στην κατηγορία. Ανάποδα, ο πρώτος θα έπρεπε κάθε φορά να προσπερνά ένα
 * μενού που δεν τον αφορά.
 *
 * ## Γιατί `<ul role="listbox">` και όχι `<select multiple>` ή κουμπιά
 * Το εγγενές `<select>` δεν επιτρέπει τη **σταθερού ύψους** λίστα των επτά σειρών με τη δική
 * της τυπογραφία (τα ονόματα είναι κώδικας, θέλουν μονοδιάστημη γραμματοσειρά) και δεν
 * στιλίζεται αξιόπιστα σε όλες τις πλατφόρμες. Κουμπιά θα ήταν χειρότερα: **κάθε** στοιχείο θα
 * έμπαινε στη σειρά του `Tab`, δηλαδή 375 στάσεις. Το `listbox` του WAI-ARIA APG είναι ακριβώς
 * αυτή η περίπτωση — μία στάση, τα βέλη κινούν την επιλογή.
 *
 * @module subapps/dxf-viewer/ui/dialogs/insert-function-form
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §9
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import type {
  FormulaCatalogEntry,
  FormulaCategoryFilter,
} from '../../bim/table/formula/catalog/formula-catalog-taxonomy';

export interface InsertFunctionFormLabels {
  readonly title: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly go: string;
  readonly categoryLabel: string;
  readonly listLabel: string;
  readonly listAriaLabel: string;
  readonly ok: string;
  readonly cancel: string;
  readonly close: string;
  readonly empty: string;
}

export interface InsertFunctionFormProps {
  readonly labels: InsertFunctionFormLabels;
  readonly categories: readonly FormulaCategoryFilter[];
  /** Το μεταφρασμένο όνομα μιας κατηγορίας — ο γονέας κατέχει το i18n. */
  readonly categoryLabelOf: (category: FormulaCategoryFilter) => string;
  readonly category: FormulaCategoryFilter;
  readonly onCategoryChange: (category: FormulaCategoryFilter) => void;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly entries: readonly FormulaCatalogEntry[];
  readonly selected: string | null;
  readonly onSelect: (name: string) => void;
  /** Διπλό κλικ ή `Enter` πάνω στη λίστα — δηλαδή «διάλεξα, προχώρα». */
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** `CONCATENATE(κείμενο1;κείμενο2;...)`, έτοιμο. */
  readonly signature: string;
  readonly help: string;
}

export function InsertFunctionForm(props: InsertFunctionFormProps): React.ReactElement {
  const {
    labels, categories, categoryLabelOf, category, onCategoryChange,
    query, onQueryChange, entries, selected, onSelect, onConfirm, onCancel,
    signature, help,
  } = props;

  const listRef = useRef<HTMLUListElement | null>(null);

  /**
   * Η επιλεγμένη σειρά μένει **ορατή** όταν την κινούν τα βέλη.
   *
   * `block: 'nearest'` και όχι `'center'`: το `center` κάνει τη λίστα να «πηδά» σε κάθε βήμα
   * ακόμα κι όταν η σειρά ήταν ήδη ορατή — κίνηση που ο χρήστης διαβάζει ως σφάλμα.
   * Η αναζήτηση γίνεται με `data-*` γνώρισμα και όχι με πίνακα από refs: η λίστα ξαναχτίζεται
   * σε κάθε πληκτρολόγηση στο πεδίο αναζήτησης, οπότε ένας πίνακας refs θα ήταν μια δεύτερη
   * δομή που πρέπει να μένει συγχρονισμένη με τα παιδιά — χωρίς κανένα κέρδος εδώ.
   */
  useEffect(() => {
    if (selected === null) return;
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-fn="${CSS.escape(selected)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (entries.length === 0) return;
      const current = entries.findIndex((entry) => entry.name === selected);
      const next = Math.min(Math.max((current < 0 ? 0 : current) + delta, 0), entries.length - 1);
      onSelect(entries[next].name);
    },
    [entries, selected, onSelect],
  );

  const handleListKeys = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 7, PageUp: -7 }[event.key];
      if (step !== undefined) {
        event.preventDefault();
        moveSelection(step);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        moveSelection(event.key === 'Home' ? -entries.length : entries.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      }
    },
    [moveSelection, entries.length, onConfirm],
  );

  /**
   * `Enter` στο πεδίο αναζήτησης = **«Μετάβαση»**, όχι νέα γραμμή.
   *
   * Το πεδίο είναι `<textarea>` για να χωρέσει η δίστιχη οδηγία του Excel· χωρίς αυτόν τον
   * φρουρό, το πρώτο αντανακλαστικό `Enter` θα έγραφε αλλαγή γραμμής μέσα σε έναν όρο
   * αναζήτησης — δηλαδή θα μηδένιζε τα αποτελέσματα χωρίς ορατή αιτία.
   */
  const handleSearchKeys = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    listRef.current?.focus();
  }, []);

  return (
    <section
      className="dxf-insert-fn-card"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <header className="dxf-insert-fn-header">
        <h2 className="dxf-insert-fn-title">{labels.title}</h2>
        <button
          type="button"
          className="dxf-insert-fn-close"
          aria-label={labels.close}
          onClick={onCancel}
        >
          ✕
        </button>
      </header>

      <label className="dxf-insert-fn-label" htmlFor="dxf-insert-fn-search">
        {labels.searchLabel}
      </label>
      <div className="dxf-insert-fn-search-row">
        <textarea
          id="dxf-insert-fn-search"
          className="dxf-insert-fn-search"
          value={query}
          placeholder={labels.searchPlaceholder}
          spellCheck={false}
          autoFocus
          // 🔴 ADR-763 §10 — το σημάδι συνεδρίας: χωρίς αυτό, η μεταφορά εστίασης εδώ κάνει
          // τη γραμμή τύπων να δει «έφυγα» και να κλείσει τον δρομέα του κελιού.
          {...TABLE_CELL_SESSION_MARKER}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleSearchKeys}
        />
        <button
          type="button"
          className="dxf-modal-button"
          onClick={() => listRef.current?.focus()}
        >
          {labels.go}
        </button>
      </div>

      <div className="dxf-insert-fn-category-row">
        <label className="dxf-insert-fn-label" htmlFor="dxf-insert-fn-category">
          {labels.categoryLabel}
        </label>
        <select
          id="dxf-insert-fn-category"
          className="dxf-insert-fn-select"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as FormulaCategoryFilter)}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {categoryLabelOf(item)}
            </option>
          ))}
        </select>
      </div>

      <label className="dxf-insert-fn-label" htmlFor="dxf-insert-fn-list">
        {labels.listLabel}
      </label>
      <ul
        id="dxf-insert-fn-list"
        ref={listRef}
        className="dxf-insert-fn-list"
        role="listbox"
        tabIndex={0}
        aria-label={labels.listAriaLabel}
        aria-activedescendant={selected === null ? undefined : `dxf-fn-${selected}`}
        onKeyDown={handleListKeys}
      >
        {entries.length === 0 ? (
          <li className="dxf-insert-fn-empty" role="presentation">
            {labels.empty}
          </li>
        ) : (
          entries.map((entry) => (
            <li
              key={entry.name}
              id={`dxf-fn-${entry.name}`}
              data-fn={entry.name}
              className="dxf-insert-fn-item"
              role="option"
              aria-selected={entry.name === selected}
              onClick={() => onSelect(entry.name)}
              onDoubleClick={onConfirm}
            >
              {entry.name}
            </li>
          ))
        )}
      </ul>

      <p className="dxf-insert-fn-signature">{signature}</p>
      <p className="dxf-insert-fn-help">{help}</p>

      <footer className="dxf-insert-fn-actions">
        <button
          type="button"
          className="dxf-modal-button dxf-modal-button-primary"
          disabled={selected === null}
          onClick={onConfirm}
        >
          {labels.ok}
        </button>
        <button type="button" className="dxf-modal-button" onClick={onCancel}>
          {labels.cancel}
        </button>
      </footer>
    </section>
  );
}
