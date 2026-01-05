'use client';

import React from 'react';
import { Eye, EyeOff, Trash2, Edit2 } from 'lucide-react';
import type { AnySceneEntity, SceneLayer } from '../../../../types/scene';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface EntityCardProps {
  entity: AnySceneEntity;
  layer: SceneLayer;
  isSelected: boolean;
  isEntityEditing: boolean;
  showEntityColorPicker: boolean;
  isFocused: boolean;
  selectedEntitiesForMerge: Set<string>;
  editingEntityName: string;
  onEntityClick: (entityId: string, ctrlPressed: boolean) => void;
  onEntityMultiSelectForMerge: (entityId: string, ctrlKey: boolean) => void;
  onEntityKeyDown: (e: React.KeyboardEvent, allVisibleEntities: Array<{ id: string }>) => void;
  onSetFocusedEntityId: (id: string | null) => void;
  onSetColorPickerEntity: (entityId: string | null) => void;
  onSetEditingEntity: (entityId: string | null) => void;
  onSetEditingEntityName: (name: string) => void;
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
  layerEntities: AnySceneEntity[];
}

export const EntityCard = ({
  entity,
  layer,
  isSelected,
  isEntityEditing,
  showEntityColorPicker,
  isFocused,
  selectedEntitiesForMerge,
  editingEntityName,
  onEntityClick,
  onEntityMultiSelectForMerge,
  onEntityKeyDown,
  onSetFocusedEntityId,
  onSetColorPickerEntity,
  onSetEditingEntity,
  onSetEditingEntityName,
  onEntityToggle,
  onEntityDelete,
  onEntityColorChange,
  onEntityRename,
  layerEntities
}: EntityCardProps) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <div 
      key={entity.id}
      tabIndex={0}
      data-entity-id={entity.id}
      data-entity-selected={isSelected || undefined}
      className={`${PANEL_LAYOUT.MARGIN.LEFT_3XL} flex items-center justify-between rounded cursor-pointer transition-all ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} focus:outline-none ${colors.interactive.focus.ring} ${
        isSelected ? `${PANEL_LAYOUT.SPACING.SM} ${colors.bg.selection} ${getDirectionalBorder('info', 'left')} rounded` : PANEL_LAYOUT.SPACING.XS
      } ${selectedEntitiesForMerge.has(entity.id) ? `ring-2 ${colors.ring.info} ${colors.bg.selection}` : ''} ${
        isFocused ? `ring-2 ${colors.ring.success}` : ''
      }`}
      onKeyDown={(e) => onEntityKeyDown(e, layerEntities)}
      onFocus={() => onSetFocusedEntityId(entity.id)}
      onClick={(e) => {
        if (!isEntityEditing) {
          e.stopPropagation();
          const ctrl = e.ctrlKey || e.metaKey;
          if (ctrl) {
            onEntityMultiSelectForMerge(entity.id, true); // ✅ γεμίζει selectedEntitiesForMerge
          } else {
            onEntityClick(entity.id, false);              // απλό κλικ
          }
        }
      }}
    >
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} flex-1 min-w-0`}>
        {/* Entity Color Picker */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetColorPickerEntity(showEntityColorPicker ? null : entity.id);
            }}
            className={`rounded-full ${getStatusBorder('muted')} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${
              isSelected ? iconSizes.xs : iconSizes.xs
            } ${getDynamicBackgroundClass(entity.color || layer.color)}`}
            title="Αλλαγή χρώματος entity"
          />
        </div>

        {/* Entity Name */}
        {isEntityEditing ? (
          <input
            type="text"
            value={editingEntityName}
            onChange={(e) => onSetEditingEntityName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (editingEntityName.trim()) {
                  onEntityRename?.(entity.id, editingEntityName.trim());
                }
                onSetEditingEntity(null);
                onSetEditingEntityName('');
              } else if (e.key === 'Escape') {
                onSetEditingEntity(null);
                onSetEditingEntityName('');
              }
            }}
            onBlur={() => {
              if (editingEntityName.trim()) {
                onEntityRename?.(entity.id, editingEntityName.trim());
              }
              onSetEditingEntity(null);
              onSetEditingEntityName('');
            }}
            className={`${colors.bg.hover} ${colors.text.primary} rounded ${getStatusBorder('info')} focus:outline-none ${colors.interactive.focus.ring} ${
              isSelected ? `text-sm ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS}` : `text-xs ${PANEL_LAYOUT.SPACING.HORIZONTAL_HALF}`
            }`}
            autoFocus
          />
        ) : (
          <span 
            className={`truncate cursor-pointer ${
              isSelected
                ? `text-sm ${colors.text.warning} font-medium`
                : `text-xs ${colors.text.secondary}`
            }`}
            title={entity.name || `${entity.type} #${entity.id.substring(0, 8)}...`}
            onDoubleClick={() => {
              onSetEditingEntity(entity.id);
              onSetEditingEntityName(entity.name || `${entity.type}_${entity.id.substring(0, 8)}`);
            }}
          >
            {entity.name || `${entity.type} #${entity.id.substring(0, 8)}...`}
          </span>
        )}
      </div>
      
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
        {/* Visibility Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEntityToggle?.(entity.id, entity.visible === false ? true : false);
          }}
          className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${
            isSelected ? PANEL_LAYOUT.SPACING.XS : PANEL_LAYOUT.SPACING.HALF
          }`}
          title={entity.visible === false ? "Εμφάνιση" : "Απόκρυψη"}
        >
          {entity.visible === false ? (
            <EyeOff className={isSelected ? iconSizes.sm : iconSizes.xs} />
          ) : (
            <Eye className={isSelected ? iconSizes.sm : iconSizes.xs} />
          )}
        </button>
        
        {/* Edit Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetEditingEntity(entity.id);
            onSetEditingEntityName(entity.name || `${entity.type}_${entity.id.substring(0, 8)}`);
          }}
          className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${
            isSelected ? PANEL_LAYOUT.SPACING.XS : PANEL_LAYOUT.SPACING.HALF
          }`}
          title="Μετονομασία entity"
        >
          <Edit2 className={isSelected ? iconSizes.sm : iconSizes.xs} />
        </button>
        
        {/* Delete Button */}
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            onEntityDelete?.(entity.id); 
          }}
          className={`${colors.text.error} ${HOVER_TEXT_EFFECTS.RED} ${
            isSelected ? PANEL_LAYOUT.SPACING.XS : PANEL_LAYOUT.SPACING.HALF
          }`}
          title="Διαγραφή"
        >
          <Trash2 className={isSelected ? iconSizes.sm : iconSizes.xs} />
        </button>
        
        {/* Selection indicator */}
        {isSelected && (
          <span className={`${colors.text.warning} ${
            isSelected ? 'text-sm' : 'text-xs'
          }`}>★</span>
        )}
      </div>
    </div>
  );
};