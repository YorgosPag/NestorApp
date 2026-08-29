'use client';

/**
 * 🔴 ADR-828 Φ4β — **Ο ΔΙΑΧΕΙΡΙΣΤΗΣ ΤΩΝ ΛΙΣΤΩΝ: ΜΙΑ ΥΛΟΠΟΙΗΣΗ, ΔΥΟ ΠΟΡΤΕΣ.**
 *
 * Αποδίδεται (α) ως **καρτέλα** μέσα στο πάνελ ρυθμίσεων — parity με το *Edit Custom Lists*
 * του Excel και τα *Sort Lists* του LibreOffice — και (β) μέσα στον **διάλογο** που ανοίγει
 * το «Σειρά…» του μενού συμπλήρωσης, δηλαδή τη στιγμή που ο άνθρωπος το χρειάζεται.
 *
 * Δύο υλοποιήσεις θα ήταν δύο απαντήσεις στο «πώς ορίζεται μια λίστα», και η μία θα έμενε
 * πίσω την ημέρα που η άλλη μάθαινε φρουρό — το ίδιο σχήμα που το ADR-739 §61 έσβησε για τη
 * «Μορφοποίηση κελιών».
 *
 * ## 🔑 ΤΙ ΞΕΠΕΡΝΑΕΙ ΤΟΥΣ ΜΕΓΑΛΟΥΣ, ΚΑΙ ΚΟΣΤΙΖΕΙ ΣΧΕΔΟΝ ΤΙΠΟΤΑ
 * - Οι λίστες ζουν στο `UserSettings` (Firestore) ⇒ **ακολουθούν τον άνθρωπο** σε κάθε
 *   υπολογιστή. Του Excel ζουν στο μητρώο του μηχανήματος: αλλάζεις PC, τις έχασες.
 * - Καμία **σιωπηλή αποκοπή** (δες {@link AutoFillListEditor}).
 * - Το Google Sheets **δεν έχει καθόλου** τη λειτουργία — η «λύση» του είναι βοηθητική στήλη
 *   με `VLOOKUP`, δηλαδή ο άνθρωπος χτίζει μηχανισμό αντί να δηλώσει δεδομένα.
 *
 * @module subapps/dxf-viewer/ui/components/auto-fill-lists/AutoFillListsManager
 * @see hooks/common/useAutoFillLists.ts — η αποθήκευση και οι λόγοι απόρριψης
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { AUTO_FILL_LIST_LIMITS, type AutoFillList } from '@/services/user-settings';
import { useAutoFillLists } from '../../../hooks/common/useAutoFillLists';
import { AutoFillListEditor } from './AutoFillListEditor';
import { AUTO_FILL_LISTS_KEYS } from './auto-fill-lists-labels';

export interface AutoFillListsManagerProps {
  /**
   * Πρόταση εγγραφών από τα κελιά που μόλις μαρκαρίστηκαν.
   *
   * 🔑 Η **παρουσία** της ανοίγει τη φόρμα κατευθείαν: ο άνθρωπος που πάτησε «Σειρά…» πάνω σε
   * μαρκαρισμένα κελιά έχει ήδη δηλώσει πρόθεση. Ένα ενδιάμεσο «πάτα Νέα λίστα» θα ήταν κλικ
   * που δεν ρωτά τίποτα.
   */
  readonly seeds?: readonly string[];
  readonly className?: string;
}

/** Τι δείχνει η επιφάνεια αυτή τη στιγμή: τον κατάλογο, ή τη φόρμα μιας λίστας. */
type Editing = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly list: AutoFillList };

export function AutoFillListsManager({
  seeds = [], className = '',
}: AutoFillListsManagerProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer-settings']);
  const { lists, save, remove } = useAutoFillLists();
  const [editing, setEditing] = useState<Editing | null>(
    seeds.length > 0 ? { kind: 'new' } : null,
  );

  if (editing !== null) {
    return (
      <section className={`flex flex-col gap-3 p-3 ${className}`}>
        <AutoFillListEditor
          initial={editing.kind === 'edit' ? editing.list : undefined}
          seeds={editing.kind === 'new' ? seeds : undefined}
          onSave={(list) => {
            const rejection = save(
              list,
              editing.kind === 'edit' ? editing.list.name : undefined,
            );
            // Η φόρμα μένει ανοιχτή όσο υπάρχει λόγος: ο άνθρωπος πρέπει να δει τι φταίει
            // **δίπλα σε ό,τι πληκτρολόγησε**, όχι αφού χαθεί.
            if (rejection === null) setEditing(null);
            return rejection;
          }}
          onCancel={() => setEditing(null)}
        />
      </section>
    );
  }

  return (
    <section className={`flex flex-col gap-3 p-3 ${className}`}>
      <p className="text-xs text-muted-foreground">{t(AUTO_FILL_LISTS_KEYS.intro)}</p>

      {lists.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t(AUTO_FILL_LISTS_KEYS.empty)}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lists.map((list) => (
            <li
              key={list.name}
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{list.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t(AUTO_FILL_LISTS_KEYS.entryCount, { count: list.entries.length })}
                </span>
              </span>
              <span className="ml-auto flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t(AUTO_FILL_LISTS_KEYS.edit)}
                  onClick={() => setEditing({ kind: 'edit', list })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t(AUTO_FILL_LISTS_KEYS.delete)}
                  onClick={() => remove(list.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setEditing({ kind: 'new' })}
        disabled={lists.length >= AUTO_FILL_LIST_LIMITS.maxLists}
      >
        <Plus className="mr-1 h-4 w-4" />
        {t(AUTO_FILL_LISTS_KEYS.add)}
      </Button>

      <footer className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>{t(AUTO_FILL_LISTS_KEYS.limits, AUTO_FILL_LIST_LIMITS)}</p>
        <p>{t(AUTO_FILL_LISTS_KEYS.builtIn)}</p>
        <p>{t(AUTO_FILL_LISTS_KEYS.priority)}</p>
      </footer>
    </section>
  );
}

export default AutoFillListsManager;
