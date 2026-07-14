'use client';
/**
 * ADR-650 M8β/Β — «Νέφος σημείων (3Δ)»: το τεκμήριο του import, ζωντανό στην 3Δ όψη.
 *
 * Μέχρι τώρα το νέφος φαινόταν μόνο ως 2Δ scatter ΜΕΣΑ στον wizard και χανόταν στο κλείσιμο.
 * Εδώ ο μηχανικός το ανάβει/σβήνει πάνω από το έδαφος (καφέ = έδαφος, γκρι = ό,τι έκοψε το
 * φίλτρο) — ReCap / CloudCompare parity: ΒΛΕΠΕΙ τι κράτησε το φίλτρο πριν εμπιστευτεί την
 * επιφάνεια που βγήκε από αυτό (§9 human-certifier).
 *
 * 🚨 §6 — το νέφος είναι ΟΨΗ, όχι γεωμετρία: δεν μετριέται, δεν γίνεται snap πάνω του, δεν
 * μπαίνει στο TIN. Γι' αυτό εδώ δεν υπάρχει καμία ενέργεια που να το «χρησιμοποιεί» — μόνο
 * εμφάνιση/απόκρυψη και ρητή αφαίρεση (που ελευθερώνει και τη μνήμη).
 *
 * i18n μέσω `t()` (N.11)· κοινό CSS module (N.3)· semantic markup (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import {
  clearPointCloud3D,
  getPointCloud3DState,
  setPointCloud3DVisible,
  subscribePointCloud3D,
} from '../../../systems/topography/pointcloud-3d-store';
import styles from './TopographyPanel.module.css';

/** Bytes ανά σημείο στη heap: 3 θέσεις + 3 χρώματα, Float32 (βλ. σημείωση μνήμης στον store). */
const BYTES_PER_POINT = 6 * Float32Array.BYTES_PER_ELEMENT;
const BYTES_PER_MB = 1024 * 1024;

export function TopoCloud3DSection(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-panels');
  // LOW-freq consumer (panel, όχι canvas orchestrator) — ίδιο συμβόλαιο με το `terrain3d`.
  const cloud = React.useSyncExternalStore(subscribePointCloud3D, getPointCloud3DState, getPointCloud3DState);

  const onToggle = React.useCallback(() => {
    setPointCloud3DVisible(!getPointCloud3DState().visible);
  }, []);

  // Καμία εισαγωγή νέφους ακόμη → καμία section. Ο wizard είναι ο μόνος δρόμος που το γεννά.
  if (!cloud.preview) return null;

  const count = cloud.preview.count;
  const megabytes = ((count * BYTES_PER_POINT) / BYTES_PER_MB).toFixed(1);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.cloud3d.title')}</h3>
      <p className={styles.subtitle}>{t('topography.cloud3d.hint')}</p>

      <p className={styles.status}>
        {t('topography.cloud3d.stats', { count: count.toLocaleString(), megabytes })}
      </p>

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${cloud.visible ? styles.toolActive : ''}`}
          onClick={onToggle}
          aria-pressed={cloud.visible}
        >
          {t(cloud.visible ? 'topography.cloud3d.hide' : 'topography.cloud3d.show')}
        </button>
        <button type="button" className={styles.generateButton} onClick={clearPointCloud3D}>
          {t('topography.cloud3d.remove')}
        </button>
      </div>
    </section>
  );
}
