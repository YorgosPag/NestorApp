'use client';
/**
 * 🔴 ADR-751 Φ7 — **η ένδειξη που διδάσκει τη χειρονομία.**
 *
 * Χωρίς αυτήν, το Ctrl+κλικ είναι λειτουργία που **κανείς δεν ανακαλύπτει**: το μπλε
 * υπογραμμισμένο κείμενο λέει «είμαι σύνδεσμος», αλλά όχι «πάτα Ctrl». Το ADR-748 §14.7 το
 * έχει ήδη διατυπώσει για αυτό το έργο — *η ένδειξη κατάστασης δεν είναι «μια ένδειξη κάπου»,
 * είναι ένδειξη **που δεν μπορείς να μη δεις***.
 *
 * ## 🔴 Γιατί εμφανίζεται ΧΩΡΙΣ Ctrl, ενώ ο δείκτης το απαιτεί
 * Είναι δύο διαφορετικές δουλειές και θα ήταν σφάλμα να έχουν την ίδια συνθήκη:
 *
 * | | Συνθήκη | Τι λέει |
 * |---|---|---|
 * | **Tooltip** | hover, **χωρίς** modifier | *«υπάρχει κάτι εδώ, και να πώς το ανοίγεις»* — **διδάσκει** |
 * | **Δείκτης** (χεράκι) | hover **+ Ctrl** | *«τώρα το κλικ θα το ανοίξει»* — **επιβεβαιώνει** |
 *
 * Αν το tooltip απαιτούσε κι αυτό Ctrl, θα ήταν ορατό μόνο σε όποιον ήδη ξέρει τη χειρονομία —
 * δηλαδή θα δίδασκε **ακριβώς κανέναν**. Είναι το ίδιο σχήμα με το «Hello There!» του Revit που
 * κατέγραψε η έρευνα του ADR-748 §6.11.4: η οδηγία εμφανίζεται **πριν** τη ζητήσεις.
 *
 * ## Τι δείχνει, και γιατί όχι σκέτο «Ctrl+κλικ»
 * Δείχνει **την ενέργεια** («Αποστολή e-mail» / «Άνοιγμα ιστοσελίδας» / «Κλήση») **και** τον
 * προορισμό. Το Excel δείχνει το ωμό URL· εδώ ο προορισμός είναι συχνά `tel:2310788493`, που
 * δεν λέει σε κανέναν τι θα συμβεί. Λέγοντας τι θα γίνει, ο χρήστης δεν χρειάζεται να το
 * δοκιμάσει για να μάθει.
 *
 * ## Δομή
 * Portal στο `document.body` με `pointer-events-none` — για τον ίδιο λόγο με το
 * `OverlapCountBadge`: **δεν επιτρέπεται να κόψει το κλικ που διαφημίζει**. Micro-leaf
 * (ADR-040): συνδρομή **μόνο** στο χαμηλόσυχνο `table-cell-link-hover-store`, όπου η άγκυρα
 * είναι παγωμένη — άρα καμία επανασχεδίαση όσο ο δείκτης κινείται μέσα στον ίδιο σύνδεσμο.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/TableCellLinkTooltip
 * @see systems/selection/OverlapCountBadge.tsx — ο αδελφός που καθρεφτίζει
 * @see state/table-cell-link-hover-store.ts — γιατί η άγκυρα δεν ακολουθεί τον δείκτη
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getHoveredCellLink,
  subscribeHoveredCellLink,
} from '../../state/table-cell-link-hover-store';
// ADR-751 Φ8 — ο χάρτης είδους→ενέργειας γεννήθηκε εδώ, αλλά τον λένε πλέον **τέσσερις**
// επιφάνειες (tooltip · μενού · λίστα · Mirror DOM). Έφυγε στο SSoT πριν γίνει τέταρτο
// αντίγραφο· δες την κεφαλίδα του για το γιατί μοιράζεται **κλειδί** και όχι κείμενο.
import { LINK_ACTION_KEY } from '../../bim/table/table-link-labels';

export function TableCellLinkTooltip() {
  const { t } = useTranslation('dxf-viewer');
  const hovered = useSyncExternalStore(
    subscribeHoveredCellLink,
    getHoveredCellLink,
    getHoveredCellLink,
  );

  if (!hovered || typeof document === 'undefined') return null;

  const { span } = hovered.hit;
  const action = t(LINK_ACTION_KEY[span.kind]);

  return createPortal(
    <output
      aria-label={t('tableCellLink.ariaLabel', { action, target: span.text })}
      style={{ left: hovered.clientX + 16, top: hovered.clientY + 18 }}
      className="fixed z-[2400] pointer-events-none select-none flex items-center gap-1.5 rounded-sm border border-border bg-popover/95 px-1.5 py-1 text-[11px] text-popover-foreground shadow-sm"
    >
      <span className="font-medium">{action}</span>
      {/* Ο προορισμός όπως τον έγραψε ο χρήστης, όχι το `href`: το `tel:2310788493` δεν λέει
          τίποτα σε κανέναν, ενώ το «2310-788493» είναι αυτό που βλέπει στο κελί. Φραγμένο σε
          πλάτος ώστε ένα μακρύ URL να μην απλωθεί σε όλη την οθόνη. */}
      <span className="max-w-[22rem] truncate text-muted-foreground">{span.text}</span>
      <kbd className="rounded-sm border border-border px-1 font-mono text-[10px] text-muted-foreground">
        {t('tableCellLink.hint')}
      </kbd>
    </output>,
    document.body,
  );
}
