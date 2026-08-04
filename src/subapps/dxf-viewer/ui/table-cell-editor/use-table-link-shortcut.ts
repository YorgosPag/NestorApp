'use client';

/**
 * 🔴 ADR-751 Φ8.γ — **`Ctrl+Shift+K`: όλες οι διευθύνσεις του επιλεγμένου πίνακα.**
 *
 * Το μοτίβο είναι το `Open Detected Link…` του **VS Code**, και το πρόβλημα που λύνει είναι
 * ακριβώς το δικό μας: συνδέσμους **εντοπισμένους** μέσα σε περιεχόμενο που δεν είναι DOM δεν
 * τους φτάνει κανένα `Tab`. Το Excel εδώ έχει **κενό** (καμία συντόμευση υπερσυνδέσμου), και
 * τα Google Sheets απαντούν μόνο για το **τρέχον** κελί — δηλαδή πρέπει να ξέρεις ήδη πού
 * είναι αυτό που ψάχνεις.
 *
 * ## Οι τρεις εκβάσεις, και γιατί καμία δεν είναι σιωπηλή κατά λάθος
 *
 * | Κατάσταση | Τι γίνεται | Γιατί |
 * |---|---|---|
 * | Κανένας πίνακας επιλεγμένος | **τίποτα** (ούτε `preventDefault`) | η συντόμευση δεν αφορά αυτό το πλαίσιο· να την κατανάλωνε θα έκλεβε πλήκτρο από τον browser |
 * | Πίνακας **χωρίς** διευθύνσεις | μήνυμα «δεν έχει συνδέσμους» | ο χρήστης πάτησε **σκόπιμα**· η σιωπή διαβάζεται ως «χάλασε» |
 * | Πίνακας με διευθύνσεις | ανοίγει η λίστα | — |
 *
 * ## Γιατί «ακριβώς ένας επιλεγμένος πίνακας»
 * Δεν είναι δικός μας κανόνας: τον απαντά ήδη το {@link resolveSelectedTable}, το ίδιο
 * κριτήριο με την είσοδο σε ομάδα και σε block editor (ADR-575 / ADR-641). Με δύο
 * επιλεγμένους πίνακες το «ποιανού οι σύνδεσμοι;» δεν έχει απάντηση, και μια αυθαίρετη
 * επιλογή θα έδειχνε λίστα που ο χρήστης δεν ζήτησε.
 *
 * ⚠️ Η ελληνική διάταξη **δεν** χρειάστηκε τίποτα εδώ: ο `matchesShortcut` πέφτει ήδη πίσω
 * στο `event.code === 'KeyK'` όταν το `event.key` δεν είναι λατινικό (τεκμηριωμένο στο ίδιο
 * το `keyboard-shortcuts.ts`). Ένας τοπικός έλεγχος χαρακτήρα εδώ θα δούλευε μόνο σε
 * λατινικό πληκτρολόγιο — δηλαδή ποτέ, για τον χρήστη αυτής της εφαρμογής.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-link-shortcut
 * @see ui/components/TableLinkPicker.tsx — η επιφάνεια
 * @see config/keyboard-shortcuts.ts — ο SSoT της συντόμευσης (`openTableLinks`)
 */

import { useEffect } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { matchesShortcut } from '../../config/keyboard-shortcuts';
import { addGlobalShortcutListener } from '../../keyboard/global-shortcut-listener';
import { collectTableCellLinks } from '../../bim/table/table-cell-link-index';
import { openTableLinkPicker } from '../../state/table-link-picker-store';
import { resolveSelectedTable } from './table-entity-lookup';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableLinkShortcutParams {
  readonly levelManager: LevelManagerLike;
  /** ADR-040 κανόνας #2 — getter, ώστε η επιλογή να διαβάζεται τη στιγμή του πλήκτρου. */
  readonly getSelectedEntityIds: () => readonly string[];
}

export function useTableLinkShortcut({
  levelManager,
  getSelectedEntityIds,
}: UseTableLinkShortcutParams): void {
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesShortcut(event, 'openTableLinks')) return;

      const entity = resolveSelectedTable(levelManager, getSelectedEntityIds);
      if (!entity) return;

      // Από εδώ και κάτω η συντόμευση **μας ανήκει**: ο χρήστης έχει επιλεγμένο πίνακα, άρα
      // κάθε έκβαση οφείλει να είναι ορατή.
      event.preventDefault();

      const links = collectTableCellLinks(entity);
      if (links.length === 0) {
        notifications.info(t('tableCellLink.pickerEmpty'));
        return;
      }
      openTableLinkPicker({ links, scope: 'table' });
    };

    // ADR-711 — δομικός φύλακας: η συντόμευση παραιτείται όσο γράφει ο χρήστης σε πεδίο ή
    // όσο ένα modal κατέχει το πληκτρολόγιο.
    return addGlobalShortcutListener(onKeyDown);
  }, [levelManager, getSelectedEntityIds, notifications, t]);
}
