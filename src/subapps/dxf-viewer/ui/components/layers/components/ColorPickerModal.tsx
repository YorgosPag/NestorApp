/**
 * 🏢 ENTERPRISE COLOR PICKER MODAL - v3.0
 *
 * @version 3.0.0 (PR3: Enterprise Color System Migration)
 * @migration Migrated to full Enterprise Color System with React Aria
 * @features
 *   - Full Enterprise ColorPicker with ColorArea, Hue/Alpha sliders
 *   - Brand palettes (DXF, Semantic, Material Design)
 *   - Recent colors (LRU)
 *   - Mode switching (HEX/RGB/HSL)
 *   - Eyedropper API support
 *   - Full keyboard navigation & ARIA compliance
 *
 * @see src/subapps/dxf-viewer/ui/color/EnterpriseColorDialog.tsx
 */

'use client';

import React from 'react';
import { EnterpriseColorDialog } from '../../../color/EnterpriseColorDialog';

interface ColorPickerModalProps {
  title: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  /** Initial color value */
  initialColor?: string;
}

/**
 * 🏢 ENTERPRISE: Migrated to EnterpriseColorDialog
 *
 * This is now a thin wrapper around EnterpriseColorDialog for backward compatibility.
 * The new system provides:
 * - ColorArea (HSV 2D picker)
 * - Hue + Alpha sliders
 * - Mode switching (HEX/RGB/HSL)
 * - Brand palettes (DXF, Semantic, Material)
 * - Recent colors (LRU)
 * - Eyedropper API
 * - Full keyboard navigation
 * - ARIA compliance
 */
export const ColorPickerModal = ({
  title,
  onColorSelect,
  onClose,
  initialColor = '#ff0000',
}: ColorPickerModalProps) => {
  const [tempColor, setTempColor] = React.useState(initialColor);

  // Update temp color when dialog opens
  React.useEffect(() => {
    setTempColor(initialColor);
  }, [initialColor]);

  return (
    <EnterpriseColorDialog
      isOpen={true}
      onClose={onClose}
      title={title}
      value={tempColor}
      onChange={setTempColor}
      onChangeEnd={(color) => {
        onColorSelect(color);
        onClose();
      }}
      alpha={false}
      modes={['hex', 'rgb', 'hsl']}
      palettes={['dxf', 'semantic', 'material']}
      recent={true}
      eyedropper={true}
      showFooter={false}
    />
  );
};