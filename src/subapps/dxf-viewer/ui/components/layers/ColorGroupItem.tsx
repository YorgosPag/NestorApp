/**
 * ColorGroupItem Component
 * Displays a single color group with its layers and controls
 *
 * 🏢 ENTERPRISE MIGRATION: 2026-01-05
 * - Zero hardcoded values via PANEL_LAYOUT tokens
 * - Zero inline styles
 * - Full centralized system compliance
 */

import React from 'react';
import { Eye, EyeOff, Trash2, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import { LayerItem } from './LayerItem';
import { createColorGroupKey, type ColorGroupCommonProps } from './utils';
import { DEFAULT_LAYER_COLOR } from '../../../config/color-config';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS, createHoverBorderEffects } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface ColorGroupItemProps extends Pick<ColorGroupCommonProps, 
  'setExpandedColorGroups' | 'setColorPickerColorGroup' | 'setEditingColorGroup' | 
  'setEditingColorGroupName' | 'getColorGroupDisplayName' | 'handleColorGroupMultiSelectForMerge' | 
  'handleColorGroupClick' | 'onColorGroupToggle' | 'onColorGroupDelete' | 'layerItemProps' | 'scene'
> {
  colorName: string;
  layerNames: string[];
  isExpanded: boolean;
  isEditingColorGroup: boolean;
  showColorGroupColorPicker: boolean;
  editingColorGroupName: string;
  selectedColorGroupsForMerge: Set<string>;
}

export function ColorGroupItem({
  colorName,
  layerNames,
  scene,
  isExpanded,
  isEditingColorGroup,
  showColorGroupColorPicker,
  editingColorGroupName,
  selectedColorGroupsForMerge,

  setExpandedColorGroups,
  setColorPickerColorGroup,
  setEditingColorGroup,
  setEditingColorGroupName,

  getColorGroupDisplayName,
  handleColorGroupMultiSelectForMerge,
  handleColorGroupClick,

  onColorGroupToggle,
  onColorGroupDelete,

  layerItemProps
}: ColorGroupItemProps) {
  const iconSizes = useIconSizes();
  const borderTokens = useBorderTokens();
  const { getStatusBorder } = borderTokens;
  const hoverBorderEffects = createHoverBorderEffects(borderTokens);
  const colors = useSemanticColors();

  const representativeColor = scene.layers[layerNames[0]]?.color || DEFAULT_LAYER_COLOR;

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
  const colorBgClass = useDynamicBackgroundClass(representativeColor);
  
  // Color Group visibility check
  const allVisible = layerNames.every((layerName: string) => scene.layers[layerName]?.visible);
  const someVisible = layerNames.some((layerName: string) => scene.layers[layerName]?.visible);

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const colorGroupKey = createColorGroupKey(colorName);
    setExpandedColorGroups((prev: Set<string>) => {
      const newExpanded = new Set(prev);
      if (prev.has(colorGroupKey)) {
        newExpanded.delete(colorGroupKey);
      } else {
        newExpanded.add(colorGroupKey);
      }
      return newExpanded;
    });
  };

  const handleColorPickerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setColorPickerColorGroup(showColorGroupColorPicker ? null : colorName);
  };

  const handleGroupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ctrlPressed = e.ctrlKey || e.metaKey;
    if (ctrlPressed) {
      handleColorGroupMultiSelectForMerge(colorName, layerNames, true);
    } else {
      handleColorGroupClick(colorName, layerNames);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColorGroup(colorName);
    setEditingColorGroupName(getColorGroupDisplayName(colorName));
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onColorGroupDelete?.(colorName, layerNames);
  };

  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onColorGroupToggle?.(colorName, layerNames, !allVisible);
  };

  const handleNameDoubleClick = () => {
    setEditingColorGroup(colorName);
    setEditingColorGroupName(getColorGroupDisplayName(colorName));
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditingColorGroup(null);
      setEditingColorGroupName('');
    } else if (e.key === 'Escape') {
      setEditingColorGroup(null);
      setEditingColorGroupName('');
    }
  };

  const handleNameBlur = () => {
    setEditingColorGroup(null);
    setEditingColorGroupName('');
  };

  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_XS}>
      {/* Color Group Header */}
      <header
        className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.muted} ${getStatusBorder('info')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.CURSOR.POINTER} ${INTERACTIVE_PATTERNS.PURPLE_HOVER} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
          selectedColorGroupsForMerge.has(colorName) ? `ring-2 ${colors.ring.info} ${colors.bg.selection}` : ''
        }`}
        onClick={handleGroupClick}
        title="Κλικ για επιλογή όλων των entities, Ctrl+Κλικ για multi-selection"
      >
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} flex-1 ${PANEL_LAYOUT.MIN_WIDTH['0']}`}>
          {/* Expand/Collapse Arrow */}
          <button
            onClick={handleExpandToggle}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT}`}
            title={isExpanded ? "Σύμπτυξη" : "Ανάπτυξη"}
          >
            {isExpanded ? (
              <ChevronDown className={iconSizes.sm} />
            ) : (
              <ChevronRight className={iconSizes.sm} />
            )}
          </button>

          {/* Color Group Color Picker */}
          <div className="relative">
            <button
              onClick={handleColorPickerToggle}
              className={`${iconSizes.sm} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${getStatusBorder('muted')} ${hoverBorderEffects.BLUE} ${colorBgClass}`}
              title="Αλλαγή χρώματος Color Group"
            />
          </div>

          {/* Color Group Name */}
          {isEditingColorGroup ? (
            <input
              type="text"
              value={editingColorGroupName}
              onChange={(e) => setEditingColorGroupName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameBlur}
              className={`${colors.bg.hover} ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${getStatusBorder('info')} ${PANEL_LAYOUT.INPUT.FOCUS} ${colors.interactive.focus.ring} ${PANEL_LAYOUT.MIN_WIDTH['0']} flex-1`}
              autoFocus
            />
          ) : (
            <span
              className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted} ${PANEL_LAYOUT.TEXT_OVERFLOW.TRUNCATE} ${PANEL_LAYOUT.CURSOR.POINTER}`}
              title="Double-click για μετονομασία"
              onDoubleClick={handleNameDoubleClick}
            >
              {getColorGroupDisplayName(colorName)} ({layerNames.length} layers)
            </span>
          )}
        </div>

        <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
          {/* Visibility Toggle */}
          <button
            onClick={handleVisibilityToggle}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT}`}
            title={allVisible ? "Απόκρυψη Color Group" : "Εμφάνιση Color Group"}
          >
            {allVisible ? (
              <Eye className={iconSizes.sm} />
            ) : someVisible ? (
              <Eye className={`${iconSizes.sm} ${PANEL_LAYOUT.INTERACTIVE.DISABLED_OPACITY}`} />
            ) : (
              <EyeOff className={iconSizes.sm} />
            )}
          </button>

          {/* Edit Button */}
          <button
            onClick={handleEditClick}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT}`}
            title="Μετονομασία Color Group"
          >
            <Edit2 className={iconSizes.sm} />
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDeleteClick}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.error} ${HOVER_TEXT_EFFECTS.RED}`}
            title="Διαγραφή Color Group"
          >
            <Trash2 className={iconSizes.sm} />
          </button>
        </nav>
      </header>

      {/* Individual Layers (when expanded) */}
      {isExpanded && layerNames.map((layerName: string) => (
        <article key={layerName} className={PANEL_LAYOUT.MARGIN.LEFT_LG}>
          <LayerItem
            layerName={layerName}
            scene={scene}
            {...layerItemProps}
          />
        </article>
      ))}
    </section>
  );
}