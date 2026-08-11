'use client';

/**
 * **ΤΟ ΒΟΗΘΗΤΙΚΟ ΠΑΝΕΛ ΣΕ ΣΤΕΝΗ ΟΘΟΝΗ** — ADR-777 §8.20 · SPEC-777D §26.8.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΠΡΟΤΥΠΟ ΕΙΝΑΙ ΓΡΑΜΜΕΝΟ, ΚΑΙ ΟΝΟΜΑΖΕΙ ΑΚΡΙΒΩΣ ΑΥΤΗ ΤΗΝ ΠΕΡΙΠΤΩΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Material 3, *Supporting Pane*: *«For compact-width displays, place the supporting content
 * **below the main content or inside a bottom sheet**.»* Από τις **δύο** επιλογές κρατήθηκε η
 * δεύτερη, με **μετρημένο** λόγο και όχι με προτίμηση: το κύριο περιεχόμενο εδώ είναι ο
 * προβολέας κατόψεων, που κρατά `zoom` και `panOffset` — δηλαδή **επιφάνεια χειρονομιών**.
 * Τοποθετημένος «από πάνω» μέσα σε κατακόρυφο κυλιόμενο, το σύρσιμο για μετακίνηση της
 * κάτοψης θα **κύλιε τη σελίδα** αντί να μετακινήσει το σχέδιο.
 *
 * ⛔ **ΔΕΝ ΕΙΝΑΙ ΤΟ ΦΥΛΛΟ ΤΗΣ ΟΘΟΝΗΣ 2, ΚΑΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΓΙΝΕΙ.** Εκείνο
 * (`ResultsSheet`) είναι **μη-αποκλειστικό** με **τρεις** στάσεις, γιατί ο κανόνας 1 του
 * §26.3 απαιτεί χάρτη **και** λίστα ζωντανά ταυτόχρονα. Εδώ η ερώτηση είναι η **αντίθετη**:
 * το βοηθητικό πάνελ ανοίγει **σκόπιμα**, διαβάζεται, και κλείνει — καμία ανάγκη να δει
 * κανείς κάτοψη και στοιχεία στο **ίδιο** καρέ. Άρα η σωστή επιλογή είναι το **modal** φύλλο
 * του `components/ui/sheet.tsx` (Radix Dialog), που φέρνει **δωρεάν** παγίδα εστίασης,
 * `Escape`, και επαναφορά εστίασης μέσω των SSoT του ADR-711/ADR-364 — τα οποία το φύλλο της
 * οθόνης 2 έπρεπε να **αρνηθεί**, ακριβώς επειδή δεν ήταν modal.
 *
 * 🔑 **Το περιεχόμενο προσαρτάται μόνο όταν ανοίγει** (Radix): σε ευρεία οθόνη, όπου το
 * πάνελ ζει ως **στήλη**, αυτό εδώ δεν αποδίδει **τίποτα** — καμία διπλή παρουσία στο DOM,
 * κανένα διπλό στοιχείο στο δέντρο προσβασιμότητας.
 */

import React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ViewerDetailsSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: React.ReactNode;
}

export function ViewerDetailsSheet({ open, onOpenChange, children }: ViewerDetailsSheetProps) {
  const { t } = useTranslation(['properties-viewer']);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        `max-h-[85dvh]`, **όχι** `vh`: σε κινητό περιηγητή η γραμμή διευθύνσεων συμπτύσσεται
        και το `vh` κρατά το **αρχικό** ύψος, δηλαδή το φύλλο θα ξεπερνούσε την ορατή περιοχή.
        Το `dvh` ακολουθεί το ζωντανό ύψος — ίδια επιλογή με τα υπάρχοντα συρτάρια του έργου.

        `md:hidden`: **ζώνη και τιράντες**. Η σκανδάλη είναι ήδη `md:hidden` και η κατάσταση
        κλείνει όταν η οθόνη γίνει ευρεία, οπότε αυτό δεν θα έπρεπε ποτέ να χρειαστεί — αλλά
        μια επικάλυψη που «δεν θα έπρεπε» να εμφανιστεί σε desktop είναι φθηνότερο να είναι
        **δομικά αδύνατη**.
      */}
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 p-0 md:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-sm">{t('properties-viewer:viewer.narrow.detailsTitle')}</SheetTitle>
        </SheetHeader>

        {/* `min-h-0`: χωρίς αυτό το flex παιδί αρνείται να συρρικνωθεί και η εσωτερική
            κύλιση του πάνελ λεπτομερειών δεν ενεργοποιείται ποτέ. */}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
