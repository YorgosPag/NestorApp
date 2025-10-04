Build Error
Failed to compile

Next.js (14.2.32) is outdated (learn more) (turbo)
./src/subapps/dxf-viewer/ui/FloatingPanelContainer.tsx:21:1
Module not found: Can't resolve './components/ColorPalettePanel'
  19 | import { LayerOperationsService } from '../services/LayerOperationsService';
  20 | import { DEFAULT_LAYER_COLOR } from '../config/color-config';
> 21 | import { ColorPalettePanel } from './components/ColorPalettePanel';
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  22 | import { EntityMergeService } from '../services/EntityMergeService';
  23 | import { useConfirmationToast } from './components/layers/hooks/useConfirmationToast';
  24 | import { publishHighlight } from '../events/selection-bus';

https://nextjs.org/docs/messages/module-not-found
This error occurred during the build process and can only be dismissed by fixing the error.