/**
 * Settings tab — Credits / Licences panel (ADR-409 §B-θετικό.2).
 *
 * A single button that opens the in-app third-party attribution screen
 * (`CreditsDialog`). Mirrors `SETTINGS_DEVELOPER_PANEL`; the `open-credits`
 * action is intercepted in `useDxfViewerCallbacks.wrappedHandleAction`.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const SETTINGS_CREDITS_PANEL: RibbonPanelDef = {
  id: 'credits',
  labelKey: 'ribbon.panels.credits',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'settings.open-credits',
            labelKey: 'ribbon.commands.openCredits',
            icon: 'info',
            commandKey: 'open-credits',
            action: 'open-credits',
          },
        },
      ],
    },
  ],
};
