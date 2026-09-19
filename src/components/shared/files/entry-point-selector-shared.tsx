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
import * as LucideIcons from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { getStudyGroupMeta } from '@/config/study-groups-config';
import type { EntityType, FileCategory } from '@/config/domain-constants';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import '@/lib/design-system';

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

/** Εικονίδιο lucide από το όνομα του καταλόγου — ασφαλής δυναμική αναζήτηση, `File` ως εφεδρεία. */
export const getIcon = (iconName?: string): LucideIcons.LucideIcon => {
  if (!iconName) return LucideIcons.File;
  const icons: Record<string, LucideIcons.LucideIcon | undefined> =
    LucideIcons as unknown as Record<string, LucideIcons.LucideIcon | undefined>;
  return icons[iconName] ?? LucideIcons.File;
};

/**
 * 🔑 **Η επιλεγμένη κατάσταση ΕΙΝΑΙ ρόλος χειριστηρίου επιλογής** (ADR-770 §17 · ADR-866 §2.10.8 Β4): η κάρτα είναι
 * `role="radio"`. Ήταν `border-primary` · `bg-primary` · `text-primary` — και στο σκοτεινό θέμα `--primary` ≡ `--card`,
 * οπότε μόλις επέλεγες τύπο **χανόταν η ετικέτα του** (μετρημένο στην παραγωγή: `rgb(29,40,58)` πάνω σε `rgb(29,40,58)`).
 * Η ετικέτα μένει `text-foreground` και στις δύο καταστάσεις· την επιλογή τη λένε περίγραμμα · γεμάτο εικονίδιο ·
 * κουκκίδα · `aria-checked` (WCAG 1.4.1 — όχι μόνο χρώμα).
 */
const control = COLOR_BRIDGE.selectionControl;
const WARNING_CARD = 'border-dashed border-[hsl(var(--text-warning))] bg-[hsl(var(--bg-warning))]/40 hover:border-[hsl(var(--text-warning))]';
const WARNING_ICON = 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]';
const WARNING_INK = 'text-[hsl(var(--text-warning))]';

interface EntryCardClasses {
  readonly card: string;
  readonly icon: string;
  readonly label: string;
}

/** Οι κλάσεις της κάρτας ανά κατάσταση — επιλεγμένη · ελεύθερος τίτλος · απλή. */
function entryCardClasses(isSelected: boolean, isCustomTitle: boolean, mutedText: string): EntryCardClasses {
  if (isSelected) {
    return { card: `${control.accentOutline} shadow-md scale-105`, icon: `${control.fill} ${control.fillInk}`, label: 'text-foreground' };
  }
  if (isCustomTitle) return { card: WARNING_CARD, icon: WARNING_ICON, label: WARNING_INK };
  return { card: `${control.outline} bg-card hover:border-control-accent/50`, icon: `bg-muted ${mutedText}`, label: 'text-foreground' };
}

export interface EntryCardProps {
  entryPoint: UploadEntryPoint;
  isSelected: boolean;
  currentLanguage: 'el' | 'en';
  showGroupBadge?: boolean;
  onSelect: (entryPoint: UploadEntryPoint) => void;
  freeTitleLabel: string;
}

/** **Η ΜΙΑ κάρτα τύπου εγγράφου** — κοινή για τον επίπεδο και τον ιεραρχικό επιλογέα (ήταν δύο χειρόγραφα αντίγραφα). */
export function EntryCard({
  entryPoint, isSelected, currentLanguage, showGroupBadge = false, onSelect, freeTitleLabel,
}: EntryCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const Icon = getIcon(entryPoint.icon);
  const isCustomTitle = entryPoint.requiresCustomTitle === true;
  const classes = entryCardClasses(isSelected, isCustomTitle, colors.text.muted);
  const groupMeta = entryPoint.group ? getStudyGroupMeta(entryPoint.group) : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(entryPoint)}
          className={cn(
            'relative flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all hover:shadow-md hover:scale-105',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            classes.card,
          )}
          role="radio"
          aria-checked={isSelected}
          aria-label={entryPoint.label[currentLanguage]}
        >
          <span className={cn('flex items-center justify-center w-10 h-10 rounded-full', classes.icon)}>
            <Icon className={iconSizes.md} aria-hidden="true" />
          </span>
          <span className={cn('text-xs font-medium text-center leading-tight', classes.label)}>
            {entryPoint.label[currentLanguage]}
          </span>
          {isCustomTitle && <span className={cn('text-[10px] leading-tight', WARNING_INK)}>{freeTitleLabel}</span>}
          {showGroupBadge && groupMeta && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', groupMeta.bgClass, groupMeta.colorClass)}>
              {groupMeta.label[currentLanguage]}
            </span>
          )}
          {isSelected && <span className={cn('absolute top-1 right-1 w-2 h-2 rounded-full', control.fill)} aria-hidden="true" />}
        </button>
      </TooltipTrigger>
      {entryPoint.description?.[currentLanguage] && (
        <TooltipContent>{entryPoint.description[currentLanguage]}</TooltipContent>
      )}
    </Tooltip>
  );
}
