'use client';

/**
 * ADR-650 §M10g — Το ΟΡΑΤΟ μισό του fail-closed.
 *
 * Ο reconciler αρνείται να μαντέψει πλαίσιο για ψημένα προϊόντα που δεν κουβαλούν σφραγίδα
 * (legacy) — σωστά. Αλλά μια άρνηση που δεν φτάνει στον χρήστη είναι σιωπή με άλλο όνομα: ο
 * κάναβος θα κάθεται σε ξεπερασμένο σύστημα και κανείς δεν θα ξέρει γιατί. Εδώ λέγεται
 * ρητά **τι** δεν μετακινήθηκε και **ποια** είναι η θεραπεία (ξανα-ψήσιμο).
 *
 * Εμφανίζεται στον διάλογο της γεωαναφοράς — τη στιγμή ακριβώς που ο χρήστης πειράζει το
 * πλαίσιο, δηλαδή τότε που η πληροφορία έχει νόημα και η διόρθωση είναι ένα κλικ μακριά.
 * Όταν δεν υπάρχει εύρημα, δεν αποδίδει τίποτα (μηδέν θόρυβος).
 *
 * @see ../../../systems/topography/topo-frame-status-store.ts — η πηγή
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import {
  getTopoFrameStatus, subscribeTopoFrameStatus,
} from '../../../systems/topography/topo-frame-status-store';
import type { TopoBakedGroup } from '../../../systems/topography/topo-baked-groups';
import styles from './TopographyPanel.module.css';

export function TopoFrameNotice(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-panels');
  // LOW-freq (panel, όχι canvas orchestrator) — ADR-040 επιτρέπει useSyncExternalStore εδώ.
  const status = React.useSyncExternalStore(
    subscribeTopoFrameStatus, getTopoFrameStatus, getTopoFrameStatus,
  );

  const groupNames = React.useCallback(
    (groups: readonly TopoBakedGroup[]): string =>
      groups.map((group) => t(`topography.frame.group.${group}`)).join(', '),
    [t],
  );

  if (status.unstampedGroups.length === 0 && status.unsupportedGroups.length === 0) return null;

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.frame.title')}</h3>
      {status.unstampedGroups.length > 0 && (
        <p className={`${styles.status} ${styles.statusError}`}>
          {t('topography.frame.unstamped', { groups: groupNames(status.unstampedGroups) })}
        </p>
      )}
      {status.unsupportedGroups.length > 0 && (
        <p className={`${styles.status} ${styles.statusError}`}>
          {t('topography.frame.unsupported', { groups: groupNames(status.unsupportedGroups) })}
        </p>
      )}
    </section>
  );
}
