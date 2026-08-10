'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΑΛΛΑΞΕΙΣ
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-782 Φ2 — **η απόδοση του παρόχου υποβάθρου στην οθόνη**.
 *
 * ## Δεν είναι στοιχείο διεπαφής· είναι όρος της άδειας
 * Η οδηγία απόδοσης του OSMF δεν συστήνει τη μνεία — την **απαιτεί** ως προϋπόθεση χρήσης των
 * δεδομένων, και ζητά η λέξη `OpenStreetMap` να είναι σύνδεσμος προς τη σελίδα πνευματικών
 * δικαιωμάτων, όπου ζει η άδεια (ODbL) και οι πηγές. Γι' αυτό το κείμενο **δεν μεταφράζεται**:
 * είναι νομικός όρος και εμπορικό σήμα, όχι μήνυμα προς τον χρήστη. Μεταφράζεται μόνο η ετικέτα
 * προσβασιμότητας — που περιγράφει **τι είναι** αυτό το πράγμα, όχι τι λέει.
 *
 * ## Ένα mount, δύο προβολές
 * Προσαρτάται **μία φορά**, ως αδερφός του `CanvasLayerStack3dLeaf` μέσα στον `CanvasLayerStack`,
 * ακριβώς όπως ο `UnifiedPerformanceHudLeaf`: ο ίδιος γονέας ζει και στο 2Δ και στο 3Δ, οπότε δύο
 * mounts (ένα ανά προβολή) θα ήταν δύο πλακέτες τη μέρα που το `BimViewport3D` ζωγραφίζει από
 * πάνω. Το `z-[55]` του `PANEL_LAYOUT` είναι ο λόγος που φαίνεται στο 3Δ: το `BimViewport3D`
 * κάθεται σε `absolute inset-0 z-50`.
 *
 * ## 🔑 Γιατί δηλώνεται στο μητρώο επιφανειών
 * Η προσάρτηση καταγράφεται στο `basemap-attribution-surface`, και **οι ζωγράφοι δεν ζωγραφίζουν
 * χωρίς αυτήν**. Δηλαδή η υποχρέωση δεν είναι «θυμήσου να βάλεις το component δίπλα σε κάθε
 * ζωγράφο» (ανάθεση σε άνθρωπο, που σε αυτό το αποθετήριο έχει αποτύχει μετρημένα) αλλά
 * μηχανισμός: χωρίς μνεία, δεν υπάρχει χάρτης. Δες την επικεφαλίδα του
 * `basemap-paint-decision` για το γιατί αυτό **δεν** δημιουργεί κύκλο.
 *
 * ADR-040: λεπτό micro-leaf· **μόνο** εγγραφές χαμηλής συχνότητας (διακόπτης/αδιαφάνεια/πάροχος,
 * διαθεσιμότητα γεωαναφοράς). Καμία εξάρτηση από `transform` — η απόδοση είναι αγκυρωμένη στην
 * **οθόνη**, όχι στον κόσμο, οπότε το pan/zoom δεν την αγγίζει καθόλου.
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import {
  getBasemapAvailability,
  subscribeBasemapAvailability,
} from '../../systems/basemap/basemap-frame';
import { getBasemapState, subscribeBasemap } from '../../systems/basemap/basemap-store';
import { registerBasemapAttributionSurface } from '../../systems/basemap/basemap-attribution-surface';
import { resolveBasemapContent } from '../../systems/basemap/basemap-paint-decision';

/** Το αναγνωριστικό αυτής της επιφάνειας στο μητρώο — ο καμβάς σχεδίασης του viewer. */
const SURFACE_ID = 'dxf-canvas-stack';

/**
 * Η πλακέτα κάτω από το κείμενο **δεν είναι αισθητική**: η οδηγία του OSMF απαιτεί η μνεία να
 * είναι *«legible … taking into consideration the font, size, colour, contrast, positioning»*.
 * Το υπόβαθρο του χάρτη είναι φωτεινό ακόμη και στο σκοτεινό θέμα, οπότε σκέτο κείμενο θα
 * αποτύγχανε σε αντίθεση **ακριβώς** όταν ο χάρτης είναι αναμμένος — δηλαδή πάντα όταν μετράει.
 * Η αδιαφάνεια 95% του `bg.overlay` κρατά το ζεύγος στο συμβόλαιο του θέματος αντί να
 * εξαρτάται από το τι έτυχε να δείχνει το πλακίδιο.
 */
const PLATE_CLASS =
  `${PANEL_LAYOUT.SPACING.COMPACT_XS} ${PANEL_LAYOUT.ROUNDED.SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ` +
  `${PANEL_LAYOUT.FONT_FAMILY.BASE} leading-none border`;

export interface BasemapAttributionLeafProps {
  /** Κλάσεις θέσης από τον Shell (απόλυτη γωνία, z-index). */
  className?: string;
}

export const BasemapAttributionLeaf: React.FC<BasemapAttributionLeafProps> = ({ className }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  // ⚠️ Η εγγραφή είναι ΑΝΕΞΑΡΤΗΤΗ από το αν φαίνεται κείμενο αυτή τη στιγμή: δηλώνει ότι σε αυτή
  // την επιφάνεια **υπάρχει θέση** για τη μνεία. Αν εξαρτιόταν από την ορατότητα, το σύστημα θα
  // κλείδωνε (καμία μνεία ⇒ καμία επιφάνεια ⇒ κανένας χάρτης ⇒ καμία μνεία).
  useEffect(() => registerBasemapAttributionSurface(SURFACE_ID), []);

  // Καμία τιμή δεν διαβάζεται από εδώ — οι εγγραφές υπάρχουν ώστε το leaf να ξαναποδοθεί όταν
  // αλλάξει κάτι που αφορά την απόφαση· την ίδια την απόφαση τη δίνει το ΕΝΑ SSoT παρακάτω.
  useSyncExternalStore(subscribeBasemap, getBasemapState, getBasemapState);
  useSyncExternalStore(subscribeBasemapAvailability, getBasemapAvailability, getBasemapAvailability);

  const decision = resolveBasemapContent();
  if (!decision.show) return null;

  return (
    <aside
      aria-label={t('basemap.attributionAria')}
      className={`${className ?? ''} ${PLATE_CLASS} ${colors.bg.overlay} ${colors.border.default} ${colors.text.primary} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
    >
      {decision.content.source.attribution.map((segment, index) =>
        segment.href ? (
          <a
            key={`${segment.text}-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${PANEL_LAYOUT.POINTER_EVENTS.AUTO} ${colors.interactive.hover.text}`}
          >
            {segment.text}
          </a>
        ) : (
          <React.Fragment key={`${segment.text}-${index}`}>{segment.text}</React.Fragment>
        ),
      )}
    </aside>
  );
};
