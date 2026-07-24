import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_DISPLAY_PANEL: RibbonPanelDef = {
  id: 'display',
  labelKey: 'ribbon.panels.display',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'display.grid',
            labelKey: 'ribbon.commands.displayGrid',
            icon: 'display-grid',
            commandKey: 'grid',
            action: 'grid',
            shortcut: 'G',
          },
        },
        // ADR-692 Φ2 — «Διαμπερής Επιλογή» (X-ray): τι πιάνει το ορθογώνιο επιλογής στο 3D —
        // ό,τι προβάλλεται μέσα του (CAD default) ή μόνο ό,τι φαίνεται πραγματικά.
        {
          type: 'widget',
          size: 'small',
          widgetId: 'marquee-select-through-toggle',
          command: {
            id: 'view.marqueeSelectThrough',
            labelKey: 'ribbon.commands.marqueeSelectThrough.label',
            icon: '',
            commandKey: 'marquee-select-through-toggle',
          },
        },
      ],
    },
  ],
};
