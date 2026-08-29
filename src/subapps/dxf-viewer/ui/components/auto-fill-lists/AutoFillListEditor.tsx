'use client';

/**
 * 🔴 ADR-828 Φ4β — **Η ΦΟΡΜΑ ΜΙΑΣ ΛΙΣΤΑΣ**: όνομα + εγγραφές, μία ανά γραμμή.
 *
 * ## Γιατί `<textarea>` και όχι λίστα με «+» ανά γραμμή
 * Ο άνθρωπος που ορίζει ορόφους ή φάσεις έργου **τις έχει ήδη γραμμένες** κάπου — σε Excel,
 * σε σημειώσεις, στο ίδιο το σχέδιο. Ένα πεδίο ανά γραμμή τον αναγκάζει σε ένα κλικ ανά
 * γραμμή· ένα `<textarea>` δέχεται επικόλληση ολόκληρης στήλης με μία κίνηση. Είναι και η
 * επιλογή του LibreOffice («*Entries*», πολυγραμμικό), και ο λόγος που το Excel φαίνεται
 * παλιό εκεί: το δικό του πεδίο δέχεται κόμματα και **κόβει στους 255 χαρακτήρες**.
 *
 * ## 🔑 Ο ΛΟΓΟΣ ΑΠΟΡΡΙΨΗΣ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΦΟΡΜΑΣ, ΟΧΙ ΠΑΡΕΝΕΡΓΕΙΑ
 * Το Excel αποθηκεύει *«probably the first 255 entries»* **χωρίς να το πει σε κανέναν**: ο
 * άνθρωπος μαθαίνει ότι κόπηκε την ημέρα που λείπει μια εγγραφή. Εδώ ό,τι δεν χωρά δεν
 * γράφεται σιωπηλά — ή χωρά, ή εμφανίζεται ο λόγος, δίπλα στο κουμπί που τον προκάλεσε.
 *
 * @module subapps/dxf-viewer/ui/components/auto-fill-lists/AutoFillListEditor
 * @see hooks/common/useAutoFillLists.ts — η επικύρωση που γεννά αυτούς τους λόγους
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AUTO_FILL_LIST_LIMITS, type AutoFillList } from '@/services/user-settings';
import type { AutoFillListRejection } from '../../../hooks/common/useAutoFillLists';
import { AUTO_FILL_LISTS_KEYS } from './auto-fill-lists-labels';

export interface AutoFillListEditorProps {
  /** Η λίστα υπό επεξεργασία· **απούσα** = νέα λίστα. */
  readonly initial?: AutoFillList;
  /** Πρόταση εγγραφών από μαρκαρισμένα κελιά — μόνο για νέα λίστα. */
  readonly seeds?: readonly string[];
  readonly onSave: (list: AutoFillList) => AutoFillListRejection | null;
  readonly onCancel: () => void;
}

/**
 * Οι γραμμές του κειμένου → εγγραφές.
 *
 * ⚠️ Τα κενά **δεν** αφαιρούνται εδώ πέρα από το `trim`: η αφαίρεση των κενών γραμμών είναι
 * κανόνας **αποθήκευσης** και ζει στο `useAutoFillLists`. Δύο καθαρισμοί σε δύο στάθμες θα
 * ήταν δύο ορισμοί του «τι είναι εγγραφή».
 */
function toEntries(text: string): readonly string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

export function AutoFillListEditor({
  initial, seeds = [], onSave, onCancel,
}: AutoFillListEditorProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer-settings']);
  const [name, setName] = useState(initial?.name ?? '');
  const [text, setText] = useState(
    (initial?.entries ?? seeds).join('\n'),
  );
  const [rejection, setRejection] = useState<AutoFillListRejection | null>(null);

  const entries = toEntries(text);

  const handleSave = (): void => {
    setRejection(onSave({ name, entries }));
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium">
        {t(AUTO_FILL_LISTS_KEYS.nameLabel)}
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t(AUTO_FILL_LISTS_KEYS.namePlaceholder)}
          maxLength={AUTO_FILL_LIST_LIMITS.maxNameLength}
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium">
        {t(AUTO_FILL_LISTS_KEYS.entriesLabel)}
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t(AUTO_FILL_LISTS_KEYS.entriesPlaceholder)}
          rows={8}
          className="font-mono text-xs"
        />
      </label>

      <p className="text-xs text-muted-foreground">
        {t(AUTO_FILL_LISTS_KEYS.entryCount, { count: entries.length })}
      </p>

      {/*
        🔑 `role="alert"` και όχι σκέτο κείμενο: ο λόγος απόρριψης εμφανίζεται **μετά** από
        πάτημα, δηλαδή τη στιγμή που ο αναγνώστης οθόνης έχει ήδη προχωρήσει. Χωρίς αυτό, ο
        άνθρωπος που δεν βλέπει την οθόνη θα βίωνε ακριβώς τη σιωπηλή αποτυχία του Excel.
      */}
      {rejection !== null && (
        <p role="alert" className="text-xs text-destructive">
          {t(`${AUTO_FILL_LISTS_KEYS.rejection}.${rejection}`, AUTO_FILL_LIST_LIMITS)}
        </p>
      )}

      <footer className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t(AUTO_FILL_LISTS_KEYS.cancel)}
        </Button>
        <Button type="submit" size="sm">
          {t(AUTO_FILL_LISTS_KEYS.save)}
        </Button>
      </footer>
    </form>
  );
}
