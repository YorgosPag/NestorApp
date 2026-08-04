'use client';

/**
 * ADR-751 Φ8.β — **ποιος ανοίγει το μενού συνδέσμου και με ποιον στόχο**.
 *
 * ## 🔑 Γιατί ο στόχος διαβάζεται από το hover store και ΔΕΝ ξαναϋπολογίζεται
 * Το αδελφό `use-table-range-menu` κάνει δικό του hit-test, και σωστά: ρωτά «ποια περιοχή
 * κελιών;», ερώτηση που **κανείς δεν έχει ήδη απαντήσει**. Εδώ η απάντηση υπάρχει: το
 * `table-cell-link-hover-store` κρατά ήδη τον σύνδεσμο κάτω από τον δείκτη — είναι αυτός που
 * βάφει το χεράκι και τροφοδοτεί το tooltip.
 *
 * Ένας δεύτερος επιλυτής εδώ θα ήταν δεύτερη απάντηση στο «ποιος σύνδεσμος είναι εδώ», δηλαδή
 * ακριβώς το σχήμα λάθους που το ίδιο το ADR-751 απαγορεύει δύο φορές (§8 για το
 * `wholeRunLink`, §2 για το «hover και κλικ συμφωνούν»). Διαβάζοντας το store, το μενού
 * **δεν μπορεί δομικά** να διαφωνήσει με αυτό που βλέπει ο χρήστης.
 *
 * ### Τι κληρονομείται ΔΩΡΕΑΝ από αυτή την επιλογή
 * Το store το γράφει το `mouse-handler-move` πίσω από τις υπάρχουσες πύλες, οπότε το μενού
 * αποκτά χωρίς μία γραμμή:
 *
 * - **εργαλείο**: μόνο σε `select` / ενεργή επιλογή οντότητας·
 * - **μετακίνηση**: τίποτα όσο γίνεται pan ή marquee·
 * - **κλείδωμα**: `null` όσο ο καμβάς ανήκει σε συνεδρία επεξεργασίας κελιού — γι' αυτό το
 *   μενού συνδέσμου δεν κλέβει ποτέ το δεξί κλικ από το μενού περιγραμμάτων (§ θύρα).
 *
 * ⚠️ Το τίμημα, δηλωμένο: το hover είναι **throttled**. Δεξί κλικ σε σύνδεσμο χωρίς καμία
 * προηγούμενη κίνηση ποντικιού πάνω του (π.χ. αμέσως μετά από προγραμματιστική μετακίνηση
 * κάδρου) βρίσκει άδειο store και πέφτει στο επόμενο μενού. Είναι αποδεκτό γιατί είναι
 * **συνεπές**: όταν δεν υπάρχει tooltip και δεν υπάρχει χεράκι, δεν υπάρχει ούτε μενού.
 * Η εναλλακτική — μενού συνδέσμου χωρίς καμία οπτική ένδειξη ότι υπάρχει σύνδεσμος — θα ήταν
 * χειρότερη από την απουσία του.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-link-menu
 * @see ui/components/TableCellLinkContextMenu.tsx — η επιφάνεια
 * @see state/table-cell-link-hover-store.ts — ο ΕΝΑΣ στόχος
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { getHoveredCellLink } from '../../state/table-cell-link-hover-store';
import {
  copyCellLinkAddress,
  openCellLink,
} from '../../bim/table/table-link-interaction-2d';
import {
  getTableLinkMenuPort,
  setTableLinkMenuPort,
  type TableLinkMenuPort,
} from './table-link-menu-port';
import type {
  TableCellLinkContextMenuHandle,
  TableLinkMenuProps,
  TableLinkMenuTarget,
} from '../components/TableCellLinkContextMenu';

export interface TableLinkMenuMount {
  readonly ref: React.RefObject<TableCellLinkContextMenuHandle | null>;
  readonly props: TableLinkMenuProps;
}

export function useTableLinkMenu(): TableLinkMenuMount {
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();
  const menuRef = useRef<TableCellLinkContextMenuHandle | null>(null);

  /**
   * Η αντιγραφή είναι **ασύγχρονη** και μπορεί να αποτύχει (πολιτική browser, μη ασφαλές
   * context). Η αποτυχία **λέγεται**: ένας χρήστης που νομίζει ότι αντέγραψε θα επικολλήσει
   * κάτι παλιό και θα το ανακαλύψει αργότερα, σε λάθος μέρος.
   */
  const handleCopy = useCallback(
    (target: TableLinkMenuTarget) => {
      void copyCellLinkAddress(target.kind, target.href).then((ok) => {
        if (ok) notifications.success(t('tableCellLink.copied'));
        else notifications.error(t('tableCellLink.copyFailed'));
      });
    },
    [notifications, t],
  );

  const props = useMemo<TableLinkMenuProps>(
    () => ({
      onOpen: (target) => openCellLink(target.href),
      onCopy: handleCopy,
    }),
    [handleCopy],
  );

  useEffect(() => {
    const port: TableLinkMenuPort = {
      open: (x, y) => {
        const hovered = getHoveredCellLink();
        if (!hovered) return false;
        const { span } = hovered.hit;
        menuRef.current?.open(x, y, {
          kind: span.kind,
          href: span.href,
          text: span.text,
        });
        return true;
      },
    };
    setTableLinkMenuPort(port);
    // Έλεγχος ταυτότητας στο cleanup, ίδιος λόγος με τις αδελφές θύρες: σε διπλό mount το
    // cleanup του παλιού δεν επιτρέπεται να σβήσει τη θύρα που μόλις έγραψε ο νέος.
    return () => {
      if (getTableLinkMenuPort() === port) setTableLinkMenuPort(null);
    };
  }, []);

  return useMemo(() => ({ ref: menuRef, props }), [props]);
}
