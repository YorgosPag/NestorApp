'use client';

/**
 * @fileoverview **«ΔΕΝ ΥΠΑΡΧΕΙ — ΦΤΙΑΞΕ ΤΟ»** — η μία ενέργεια του combobox που **δεν είναι επιλογή**.
 * @related ADR-841 §7 Α19.4 · ADR-ACC-013 · components/ui/searchable-combobox.tsx
 * @module components/ui/searchable-combobox-add-new
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — **ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΟΧΙ ΜΙΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `searchable-combobox` ρωτά *«**ποια** από αυτές;»*. Αυτό εδώ ρωτά *«**ποια νέα**;»* —
 * και η δεύτερη ερώτηση κουβαλά **δική της κατάσταση** *(«γράφω τώρα;», «τι έγραψα;»)*, δικό
 * της πεδίο, δική της εστίαση. Ζούσαν στο ίδιο σώμα: **τρεις** μεταβλητές κατάστασης και
 * **ένα** effect εστίασης που ο επιλογέας **δεν διαβάζει ποτέ**.
 *
 * ⚠️ **Η αφορμή ήταν το όριο των 500 γραμμών (N.7.1) — ο διαχωρισμός ΔΕΝ είναι λογιστικός.**
 * Ίδιο ακριβώς σκεπτικό με το `searchable-combobox-matching.ts`: εκείνο έβγαλε την
 * **ταύτιση**, αυτό βγάζει τη **δημιουργία**. Ό,τι μένει είναι **μόνο** επιλογή.
 * ⛔ **ΜΗΝ το ξαναχώσεις μέσα** επειδή «είναι μικρό»: η κατάσταση που θα ξανάμπαινε είναι
 * κατάσταση που ο **καταναλωτής χωρίς `onAddNew`** πληρώνει χωρίς να τη χρησιμοποιεί.
 *
 * **Layering**: leaf UI — καμία γνώση για επιλογές, φιλτράρισμα ή τιμές.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDropdownTokens } from '@/hooks/useDropdownTokens';
import '@/lib/design-system';

export interface SearchableComboboxAddNewProps {
  /** Η ετικέτα που πληκτρολόγησε ο άνθρωπος. Ο **γονέας** την προσθέτει στις επιλογές. */
  readonly onAddNew: (label: string) => void;
  /** Κλείσιμο του popover — **μετά** την υποβολή, ποτέ πριν. */
  readonly onSubmitted: () => void;
  readonly placeholder: string;
  readonly buttonLabel: string;
}

/** Η καθυστέρηση εστίασης — το πεδίο μπαίνει στο DOM **αφού** κλείσει το τρέχον frame. */
const FOCUS_DELAY_MS = 50;

export function SearchableComboboxAddNew({
  onAddNew,
  onSubmitted,
  placeholder,
  buttonLabel,
}: SearchableComboboxAddNewProps) {
  const dropdown = useDropdownTokens();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemInput, setNewItemInput] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  // Focus new item input when add-new mode is activated
  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      setTimeout(() => newInputRef.current?.focus(), FOCUS_DELAY_MS);
    }
  }, [isAddingNew]);

  const handleAddNewSubmit = useCallback(() => {
    const trimmed = newItemInput.trim();
    if (!trimmed) return;

    onAddNew(trimmed);
    setNewItemInput('');
    setIsAddingNew(false);
    onSubmitted();
  }, [newItemInput, onAddNew, onSubmitted]);

  return (
    <div className={dropdown.combobox.addNewSection}>
      {isAddingNew ? (
        <div className={`flex items-center ${dropdown.combobox.addNewRow}`}>
          <Input
            ref={newInputRef}
            type="text"
            value={newItemInput}
            onChange={e => setNewItemInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAddNewSubmit();
              }
              if (e.key === 'Escape') {
                setIsAddingNew(false);
                setNewItemInput('');
              }
            }}
            onMouseDown={e => e.stopPropagation()}
            placeholder={placeholder}
            className={dropdown.combobox.addNewInput}
          />
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              handleAddNewSubmit();
            }}
            disabled={!newItemInput.trim()}
            className={`${dropdown.combobox.addNewButton} rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}
          >
            OK
          </button>
        </div>
      ) : (
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsAddingNew(true);
          }}
          className={cn(
            `flex w-full items-center ${dropdown.item.gap} rounded-sm ${dropdown.item.combobox} ${dropdown.item.fontSize} cursor-pointer`,
            // 🔴 **ΗΤΑΝ `text-primary`, ΚΑΙ Η ΜΕΤΑΚΟΜΙΣΗ ΤΟ ΕΚΑΝΕ ΟΡΑΤΟ** *(CHECK 3.38, ADR-770)*.
            //    Στο σκοτεινό θέμα το `--primary` λύνεται **ταυτόσημα με το `--card`** ⇒ **1,00:1**,
            //    δηλαδή η μόνη πρόσκληση *«δεν υπάρχει — φτιάξ’ το»* ήταν **αόρατη**.
            //    ⚠️ Το ελάττωμα ζούσε ήδη στη baseline του `searchable-combobox.tsx` — η εξαγωγή
            //    δεν το γέννησε, το **έβγαλε από τη σιωπή**: νέο αρχείο = μηδενική ανοχή.
            //    Το `--text-info` είναι token **σκοπού** με ξεχωριστή τιμή ανά θέμα ⇒ κρατά την
            //    οπτική πρόθεση *(ενέργεια, μπλε)* χωρίς να βάφει μελάνι με token επιφάνειας.
            'hover:bg-accent hover:text-accent-foreground text-[hsl(var(--text-info))]'
          )}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
