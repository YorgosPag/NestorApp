'use client';

/**
 * ADR-782 §25 — η γραμμή **πλαισίου** του θεατή: «πού είμαι» και «ποιον όροφο βλέπω».
 *
 * ## Γιατί υπάρχει
 * Η γραμμή κάτω από την εργαλειοθήκη φιλοξενούσε δύο πράγματα με **διαφορετική διάρκεια ζωής**,
 * αλλά ένα μόνο ιδιοκτήτη: το `FloorTabBar`. Όποιος έκανε `return null` για τους **ορόφους**
 * έσβηνε μαζί και το χειριστήριο του **έργου** (ADR-782 §25). Η διόρθωση δεν είναι δεύτερο
 * σημείο απόδοσης αλλά **ξεχωριστός ιδιοκτήτης**: η γραμμή ζει όσο ζει ο θεατής, και κάθε
 * περιεχόμενό της αποφασίζει **μόνο του** αν έχει κάτι να πει.
 *
 * | Περιεχόμενο | Εμβέλεια | Ζει όταν |
 * |---|---|---|
 * | `BasemapControlGroup` | **έργο** — πού είναι πάνω στη Γη | **πάντα** (η άρνηση είναι απάντηση) |
 * | `FloorTabBar` | **κτίριο** — ποιος όροφος | μόνο με κτίριο & ορόφους |
 *
 * ## Γιατί σκέτο δοχείο διάταξης και όχι `<section>`/`<nav>`
 * Η γραμμή **δεν είναι** η ίδια ορόσημο πλοήγησης· είναι λωρίδα που κρατά δύο χειριστήρια, το
 * καθένα με **δική** του σημασιολογία (`role="group"` ο χάρτης, `role="tablist"` οι όροφοι). Ένα
 * επιπλέον ορόσημο γύρω τους θα ανακοίνωνε στον αναγνώστη οθόνης μια οντότητα που δεν υπάρχει —
 * και θα χρειαζόταν όνομα που δεν σημαίνει τίποτα. Το `role="tablist"` δέχεται εξάλλου **μόνο**
 * `role="tab"` ως παιδιά· ο χάρτης δεν είναι καρτέλα και δεν επιτρέπεται να κάθεται μέσα του.
 *
 * ## Ποιος κρατά τι
 * Το **πλαίσιο** της λωρίδας (περίγραμμα, φόντο, αποστάσεις) ζει **εδώ**, μία φορά. Η οριζόντια
 * κύλιση μένει στο `<nav>` των ορόφων: εκείνοι πληθαίνουν, ο χάρτης όχι — κύλιση σε ολόκληρη τη
 * λωρίδα θα έσπρωχνε τον χάρτη εκτός οθόνης ακριβώς όταν το κτίριο μεγαλώνει.
 *
 * Μηδέν inline styles (N.3), κεντρικά tokens, σημασιολογικά παιδιά (N.4).
 *
 * @see ./BasemapControlGroup.tsx — το project-level χειριστήριο
 * @see ./FloorTabBar.tsx — οι καρτέλες ορόφων (ADR-399)
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { BasemapControlGroup } from './BasemapControlGroup';
import { FloorTabBar } from './FloorTabBar';

export const ViewerContextStrip: React.FC = () => {
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div
      className={`shrink-0 ${getDirectionalBorder('muted', 'top')} ${colors.bg.backgroundSecondary} ` +
        `${PANEL_LAYOUT.SPACING.HORIZONTAL_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} ` +
        `flex items-center ${PANEL_LAYOUT.GAP.XS}`}
    >
      {/* Ο χάρτης πρώτος-αριστερά (Giorgio 2026-08-09, §10): είναι το πλαίσιο μέσα στο οποίο
          διαβάζονται όλα τα υπόλοιπα — «πού είμαι» πριν από «ποιον όροφο βλέπω». Η θέση **δεν**
          άλλαξε με τη μετακόμιση του §25· άλλαξε μόνο ποιος κρατά τη ζωή του. */}
      <BasemapControlGroup />
      <FloorTabBar />
    </div>
  );
};
