/**
 * ADR-366 §C.1.b — Animation contextual ribbon tab.
 *
 * Visible όταν `AnimationStore.toolActive === true` (gated by
 * `ribbon-contextual-config.ts → useActiveContextualTrigger`). Mirror του
 * DIMENSION_CONTEXTUAL_TAB declarative shape.
 *
 * Three panels:
 *   (A) Tool        — turntable preset + tool deactivate
 *   (B) Waypoints   — add at current camera, delete active, reverse track
 *   (C) Persistence — save / load / share (C.1.b stubs; full flow in C.1.c)
 *   (D) Export      — disabled placeholder (real MP4 export = C.1.c)
 *
 * Action handlers wired σε `useDxfViewerCallbacks.wrappedHandleAction`
 * (animation.* cases). Coming-soon stubs render notification toast.
 *
 * ⚠️ **Οι ετικέτες ζουν στο `dxf-viewer-shell`, όχι στο `bim3d`** (ADR-739 §52.3). Ήταν στο
 * `bim3d.json` ενώ το `RibbonPanel` μεταφράζει με `dxf-viewer-shell` και το `i18n/config.ts`
 * **δεν έχει `fallbackNS`** — δηλαδή ολόκληρη η καρτέλα τύπωνε **ωμά κλειδιά**. Ό,τι μοιράζεται
 * με τον `TimelineEditor` μετακόμισε **μία** φορά· εκείνος διαβάζει πλέον και τα δύο namespaces.
 */

import type { RibbonTab } from '../types/ribbon-types';
import { SNAP_STEP_COMBOBOX_OPTIONS } from './animation-snap-step-options';

export const ANIMATION_CONTEXTUAL_TRIGGER = 'animation-tool';

const ANIMATION_TAB_LABEL_KEY = 'animation.title';

export const ANIMATION_CONTEXTUAL_TAB: RibbonTab = {
  id: 'animation',
  labelKey: ANIMATION_TAB_LABEL_KEY,
  isContextual: true,
  contextualTrigger: ANIMATION_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'animation-tool',
      labelKey: 'animation.panels.tool',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'animation.turntable',
                labelKey: 'animation.toolbar.turntable',
                icon: 'animation-turntable',
                commandKey: 'animation.turntable',
                action: 'animation.turntable',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.tool-toggle',
                labelKey: 'animation.toolbar.deactivate',
                icon: 'animation-deactivate',
                commandKey: 'animation.tool-toggle',
                action: 'animation.tool-toggle',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'animation-waypoints',
      labelKey: 'animation.panels.waypoints',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.add-waypoint',
                labelKey: 'animation.toolbar.addWaypoint',
                icon: 'animation-add-waypoint',
                commandKey: 'animation.add-waypoint',
                action: 'animation.add-waypoint',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.delete-waypoint',
                labelKey: 'animation.toolbar.deleteWaypoint',
                icon: 'animation-delete-waypoint',
                commandKey: 'animation.delete-waypoint',
                action: 'animation.delete-waypoint',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.reverse',
                labelKey: 'animation.toolbar.reverseTrack',
                icon: 'animation-reverse',
                commandKey: 'animation.reverse',
                action: 'animation.reverse',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'animation-persistence',
      labelKey: 'animation.panels.persistence',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.save',
                labelKey: 'animation.persistence.save',
                icon: 'animation-save',
                commandKey: 'animation.save',
                action: 'animation.save',
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.load',
                labelKey: 'animation.persistence.load',
                icon: 'animation-load',
                commandKey: 'animation.load',
                comingSoon: true,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'animation.share',
                labelKey: 'animation.persistence.share',
                icon: 'animation-share',
                commandKey: 'animation.share',
                comingSoon: true,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'animation-snap',
      labelKey: 'animation.panels.snap',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'toggle',
              size: 'small',
              command: {
                id: 'animation.snap-toggle',
                labelKey: 'animation.toolbar.snapToggle',
                icon: 'snap-grid',
                commandKey: 'animation.snap-toggle',
                action: 'animation.snap-toggle',
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'animation.snap-step',
                labelKey: 'animation.toolbar.snapStep',
                commandKey: 'animation.snap-step',
                comboboxWidthPx: 90,
                // 🔴 Καμία χειρόγραφη λίστα: τα βήματα ΠΑΡΑΓΟΝΤΑΙ από τον κβαντιστή. Η παλιά
                // λίστα εδώ ήταν το δεύτερο αντίγραφο (το πρώτο ζει στο `useRibbonCommands`)
                // **και** έγραφε κλειδιά με τελεία στο φύλλο, δηλαδή δομικά ανεπίλυτα.
                options: SNAP_STEP_COMBOBOX_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'animation-export',
      labelKey: 'animation.panels.export',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'animation.export',
                labelKey: 'animation.toolbar.export',
                icon: 'animation-export',
                commandKey: 'animation.export',
                action: 'animation.export',
                tooltipKey: 'animation.exportTooltip',
              },
            },
          ],
        },
      ],
    },
  ],
};
