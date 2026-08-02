'use client';

/**
 * ADR-748 Φάση 2 — Ο ΟΡΑΤΟΣ ΔΙΑΚΟΠΤΗΣ ΕΙΔΙΚΟΤΗΤΑΣ («ποια εργαλεία έχω»).
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΤΙΚΟΣ: χωρίς αυτόν η Φάση 2 είναι
 * **ανεπαλήθευτη στην οθόνη**. Ο Γιώργος είναι `super_admin` ⇒ δικαιούται και
 * όλες τις καρτέλες (Ε4.ε) ⇒ φίλτρο βασισμένο μόνο σε δικαιώματα θα έδειχνε
 * «καμία αλλαγή» — και θα είχε δίκιο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΔΩ (γραμμή καρτελών) ΚΑΙ ΟΧΙ ΣΤΗ ΓΡΑΜΜΗ ΚΑΤΑΣΤΑΣΗΣ
 *
 * Το AutoCAD βάζει τον διακόπτη χώρου εργασίας σε γρανάζι κάτω δεξιά — και
 * είναι διαβόητα δυσεύρετος· ακριβώς η αδυναμία **Υ-2** που το ADR-748 §8
 * δεσμεύεται να ξεπεράσει. Ο δείκτης «Χ κρυμμένες» οφείλει να στέκει **εκεί που
 * λείπουν οι καρτέλες** (NN/g: ο δείκτης δίπλα στην περιοχή που αφορά).
 * Cinema 4D: επιλογέας διάταξης πάνω-δεξιά. Figma Dev Mode: διακόπτης δίπλα στο
 * UI που αλλάζει.
 *
 * ΚΑΙ ΜΕΝΕΙ ΠΑΝΤΑ ΠΡΟΣΙΤΟΣ: ζει στη γραμμή καρτελών, όχι **μέσα** σε καρτέλα.
 * Αν ζούσε στις «Ρυθμίσεις», η θέση «Παρουσίαση» (που κρύβει τις Ρυθμίσεις) θα
 * τον έκανε **αδύνατο να ξαναβρεθεί** — παγίδα που το AutoCAD αποφεύγει επίσης.
 * ─────────────────────────────────────────────────────────────────────────────
 * Α-3 — ΠΟΤΕ ΣΙΩΠΗΛΗ ΑΠΟΚΡΥΨΗ (μάθημα Office 2000, §6.7)
 *
 * Όταν κάτι κρύβεται, φαίνεται **μόνιμα** πόσο και επαναφέρεται με **ένα κλικ**.
 * Το «Χ κρυμμένες» ΔΕΝ είναι ετικέτα: είναι κουμπί που γυρίζει σε «Όλα».
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ADR-001: χρησιμοποιεί το κανονικό `@/components/ui/select` (Radix).
 * ADR-040: ζει στη γραμμή καρτελών, μηδέν `useSyncExternalStore`, μηδέν
 * συνδρομή σε high-frequency store — η αλλαγή θέσης είναι ενέργεια χρήστη.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from './RibbonTooltip';
import {
  RIBBON_SPECIALTY_ALL,
  RIBBON_SPECIALTY_LABEL_KEY,
  RIBBON_SPECIALTY_ORDER,
  countHiddenTabs,
  isRibbonSpecialtySelection,
  type RibbonSpecialtySelection,
} from '../data/ribbon-tab-specialties';

interface RibbonSpecialtySwitchProps {
  activeSpecialty: RibbonSpecialtySelection;
  onSpecialtyChange: (specialty: RibbonSpecialtySelection) => void;
}

export const RibbonSpecialtySwitch: React.FC<RibbonSpecialtySwitchProps> = ({
  activeSpecialty,
  onSpecialtyChange,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const handleChange = useCallback(
    (value: string) => {
      // Ο Radix επιστρέφει `string` — ποτέ cast, πάντα type guard.
      if (isRibbonSpecialtySelection(value)) onSpecialtyChange(value);
    },
    [onSpecialtyChange],
  );

  const handleRestoreAll = useCallback(() => {
    onSpecialtyChange(RIBBON_SPECIALTY_ALL);
  }, [onSpecialtyChange]);

  const hiddenCount = countHiddenTabs(activeSpecialty);

  return (
    <span className="dxf-ribbon-specialty-switch">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="dxf-ribbon-specialty-select">
            <Select value={activeSpecialty} onValueChange={handleChange}>
              <SelectTrigger
                className="h-6 min-w-0 w-auto text-xs border-none bg-transparent px-1.5 gap-1 focus:ring-0 focus:ring-offset-0"
                aria-label={t('ribbon.specialty.ariaLabel')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[9rem]">
                {RIBBON_SPECIALTY_ORDER.map((specialty) => (
                  <SelectItem
                    key={specialty}
                    value={specialty}
                    className="text-xs"
                  >
                    {t(RIBBON_SPECIALTY_LABEL_KEY[specialty])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('ribbon.specialty.tooltip')}</TooltipContent>
      </Tooltip>

      {/* Α-3 / Υ-2 — μόνιμος δείκτης ΚΑΙ επαναφορά με ένα κλικ. Εμφανίζεται
          μόνο όταν όντως κρύβεται κάτι: ένα «0 κρυμμένες» θα ήταν θόρυβος. */}
      {hiddenCount > 0 && (
        // CHECK 3.23 — το native `title=` απαγορεύεται: δεν στυλίζεται, δεν
        // ακολουθεί το θέμα, και σε αφή δεν εμφανίζεται ΠΟΤΕ. Ο δείκτης Α-3
        // οφείλει να εξηγεί τον εαυτό του παντού, άρα ο ΙΔΙΟΣ `Tooltip` με τον
        // επιλογέα από πάνω — ένα λεξιλόγιο υποδείξεων στη γραμμή καρτελών.
        // Το `aria-label` μένει: ο υποβοηθούμενος χρήστης δεν διαβάζει tooltip.
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="dxf-ribbon-specialty-hidden-badge"
              onClick={handleRestoreAll}
              aria-label={t('ribbon.specialty.restoreAll')}
            >
              {t('ribbon.specialty.hiddenCount', { count: hiddenCount })}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('ribbon.specialty.restoreAll')}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
};
