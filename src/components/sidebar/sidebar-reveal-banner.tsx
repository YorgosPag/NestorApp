'use client';

/**
 * ADR-748 Φάση 3.6 / **ΕΠΙΠΕΔΟ 3** — η **μόνιμη ένδειξη κατάστασης** του τρόπου
 * «Αποκάλυψη κρυμμένων».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΠΡΟΤΥΠΟ: **Revit — `Reveal Hidden Elements`** (§6.13)
 *
 * Στο Revit τα κρυμμένα εμφανίζονται **στη θέση τους** σε ματζέντα, τα ορατά
 * γκριζάρουν, και — το κρίσιμο — **ολόκληρο** το παράθυρο σχεδίασης παίρνει
 * έγχρωμο περίγραμμα όσο ο τρόπος είναι ενεργός. Ο λόγος δεν είναι διακοσμητικός:
 * χωρίς αυτό, ο χρήστης ξεχνά ότι είναι σε **τρόπο λειτουργίας** και ερμηνεύει
 * αυτό που βλέπει ως **την κανονική κατάσταση**. Θα ήταν σιωπηλή έκπληξη —
 * δηλαδή το **Α-3** ανάποδα.
 *
 * 🔑 **ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ** (Υ-11): η τεκμηρίωση της Autodesk λέει ρητά ότι ο
 * τρόπος αποκαλύπτει ό,τι κρύφτηκε *by Category / by Element / Temporary Hide*
 * — **«but not by Filter»**. Το ίδιο κενό έχει και το VS Code: το δέντρο του σε
 * κατάσταση **filter** αφαιρεί κόμβους χωρίς **καμία** ένδειξη ποιοι φάκελοι
 * δεν λήφθηκαν υπόψη *(ανοιχτό ζήτημα στο repo τους)*. Και οι **δύο** κορυφαίοι
 * έχουν τρόπο αποκάλυψης και **τον αφήνουν τυφλό ακριβώς στο φιλτράρισμα** —
 * που είναι η **μόνη** περίπτωση εδώ. Ο δικός μας τον καλύπτει.
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΤΟ ΚΟΥΜΠΙ ΕΞΟΔΟΥ ΕΙΝΑΙ ΜΕΣΑ ΣΤΗΝ ΕΝΔΕΙΞΗ: μια ένδειξη που δεν
 * προσφέρει έξοδο μετατρέπει την πληροφορία σε εμπόδιο. Ένα κλικ μπαίνεις,
 * ένα κλικ βγαίνεις — η ίδια συμμετρία με το `HiddenItemsBadge`.
 *
 * ⚠️ Στο **μαζεμένο** sidebar μένει μόνο το εικονίδιο: το `aria-label` του
 * κουμπιού κουβαλά όλο το νόημα, ώστε η κατάσταση να μη γίνεται ποτέ αόρατη
 * στον υποβοηθούμενο χρήστη. CHECK 3.23: κανένα native `title=`.
 */

import React from 'react';
import { Eye } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';

interface SidebarRevealBannerProps {
  /** Δεν αποδίδεται τίποτα όταν ο τρόπος είναι ανενεργός. */
  isRevealing: boolean;
  onStop: () => void;
}

export function SidebarRevealBanner({ isRevealing, onStop }: SidebarRevealBannerProps) {
  const { t } = useTranslation('navigation');
  const iconSizes = useIconSizes();

  if (!isRevealing) return null;

  return (
    <aside
      // `status` και όχι `alert`: είναι κατάσταση που ο ίδιος ο χρήστης άναψε,
      // όχι συμβάν που τον διακόπτει — ο αναγνώστης οθόνης το ανακοινώνει
      // ευγενικά αντί να κόψει ό,τι διαβάζει.
      role="status"
      className={cn(
        'mx-2 mb-1 flex items-center gap-2 rounded-md px-2 py-1.5',
        'border border-dashed border-primary/50 bg-primary/5 text-xs text-foreground',
      )}
    >
      <Eye className={cn(iconSizes.sm, 'shrink-0 text-primary')} aria-hidden />
      <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
        <span className="font-medium">{t('jobs.reveal.bannerTitle')}</span>
        <span className="text-muted-foreground">{t('jobs.reveal.bannerDescription')}</span>
      </span>
      <button
        type="button"
        onClick={onStop}
        aria-label={t('jobs.reveal.bannerTitle')}
        className={cn(
          'ml-auto shrink-0 rounded-sm px-2 py-0.5 font-medium text-primary transition-colors',
          'hover:bg-primary/10 group-data-[collapsible=icon]:hidden',
        )}
      >
        {t('jobs.reveal.stop')}
      </button>
    </aside>
  );
}
