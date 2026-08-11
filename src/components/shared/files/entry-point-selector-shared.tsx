'use client';

/**
 * =============================================================================
 * FILES — Ό,τι μοιράζονται οι δύο επιλογείς σημείου εισόδου (ADR-784 §10.7 · CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ:** ο `UploadEntryPointSelector` και ο `HierarchicalEntryPointSelector` είναι
 * **δύο παρουσιάσεις της ίδιας απόφασης** («ποιο είδος εγγράφου ανεβάζω;»). Είχαν αντιγράψει
 * **δύο** πράγματα: το **δημόσιο συμβόλαιό** τους (δέκα ταυτόσημα props) και το **πεδίο
 * ελεύθερου τίτλου** — είκοσι γραμμές με τις ίδιες κλάσεις εστίασης και τα ίδια `aria-*`. Το
 * ονόμασε το **CHECK 3.28** (jscpd, ADR-584).
 *
 * ⚠️ **Το πεδίο τίτλου ΔΕΝ είναι διακοσμητικό**: είναι το **μόνο υποχρεωτικό** πεδίο της ροής
 * μεταφόρτωσης. Δύο αντίγραφα σήμαιναν ότι μια διόρθωση προσβασιμότητας στο ένα άφηνε το άλλο
 * πίσω — και **ακριβώς αυτό είχε ήδη συμβεί**: μόνο η μία εκδοχή έδενε την υπόδειξη με
 * `aria-describedby`. Η ενοποίηση κρατά τη **σωστότερη** από τις δύο.
 *
 * @module components/shared/files/entry-point-selector-shared
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EntityType, FileCategory } from '@/config/domain-constants';
import type { UploadEntryPoint } from '@/config/upload-entry-points';

/**
 * Το **κοινό** συμβόλαιο κάθε επιλογέα σημείου εισόδου.
 *
 * ⚠️ Ό,τι είναι **ειδικό** για μία παρουσίαση (πρόσωπα επαφής · όροφοι · πλοήγηση) μένει στη
 * δική της διεπαφή — η κοινή βάση περιγράφει **την απόφαση**, όχι την οθόνη.
 */
export interface EntryPointSelectorBaseProps {
  entityType: EntityType;
  /** Το τρέχον επιλεγμένο σημείο εισόδου. */
  selectedEntryPointId?: string;
  onSelect: (entryPoint: UploadEntryPoint) => void;
  className?: string;
  language?: 'el' | 'en';
  /** Ο ελεύθερος τίτλος για τα σημεία εισόδου που απαιτούν «Άλλο Έγγραφο». */
  customTitle?: string;
  onCustomTitleChange?: (title: string) => void;
  /** Δείξε **μόνο** αυτή την κατηγορία (π.χ. `photos` για την καρτέλα φωτογραφιών). */
  categoryFilter?: FileCategory;
  /** Απόκρυψη συγκεκριμένων κατηγοριών. */
  excludeCategories?: FileCategory[];
  /** Λευκή λίστα σημείων εισόδου — δείχνει **ΜΟΝΟ** αυτά. */
  allowedEntryPointIds?: string[];
}

export interface EntryPointCustomTitleInputProps {
  /** Το `id` του πεδίου — διαφέρει ανά επιλογέα, γι' αυτό δεν είναι σταθερά. */
  htmlId: string;
  customTitle: string;
  onCustomTitleChange?: (title: string) => void;
}

/**
 * Το υποχρεωτικό πεδίο ελεύθερου τίτλου.
 *
 * ⚠️ Το κενό κείμενο **βάφει** το περίγραμμα και δηλώνει `aria-invalid` — η ένδειξη δεν είναι
 * μόνο χρωματική (WCAG 1.4.1), γι' αυτό συνοδεύεται από την υπόδειξη που δένεται με
 * `aria-describedby`.
 */
export function EntryPointCustomTitleInput({
  htmlId,
  customTitle,
  onCustomTitleChange,
}: EntryPointCustomTitleInputProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const hintId = `${htmlId}-hint`;
  const isEmpty = customTitle.trim() === '';

  return (
    <div className="space-y-2">
      <label htmlFor={htmlId} className="block text-sm font-medium text-foreground">
        {t('upload.documentTitle')} <span className="text-destructive">*</span>
      </label>
      <input
        id={htmlId}
        type="text"
        value={customTitle}
        onChange={(e) => onCustomTitleChange?.(e.target.value)}
        placeholder={t('upload.customTitlePlaceholder')}
        required
        className={cn(
          'w-full px-2 py-2 rounded-md border bg-background text-foreground',
          `placeholder:${colors.text.muted}`,
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'transition-colors',
          isEmpty ? 'border-destructive/50 focus:ring-destructive' : 'border-border',
        )}
        aria-required="true"
        aria-invalid={isEmpty}
        aria-describedby={hintId}
      />
      <p id={hintId} className={cn('text-xs', colors.text.muted)}>
        {t('upload.customTitleHint')}
      </p>
    </div>
  );
}
