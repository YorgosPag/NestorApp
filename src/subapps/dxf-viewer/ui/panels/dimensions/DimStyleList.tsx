'use client';

import React from 'react';
import { Check, Copy, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { DimStyle } from '../../../types/dimension';

interface DimStyleListProps {
  styles: readonly DimStyle[];
  activeStyleId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetActive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export function DimStyleList({
  styles,
  activeStyleId,
  selectedId,
  onSelect,
  onSetActive,
  onDuplicate,
  onDelete,
  onEdit,
}: DimStyleListProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const colors = useSemanticColors();

  if (styles.length === 0) {
    return (
      <p className={`text-sm ${colors.text.muted} py-4 text-center`}>
        {t('panels.dimensions.emptyList')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5" role="listbox" aria-label={t('panels.dimensions.styleManager')}>
      {styles.map((style) => {
        const isSelected = style.id === selectedId;
        const isActive = style.id === activeStyleId;
        return (
          <li key={style.id} role="option" aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => onSelect(style.id)}
              className={[
                'w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-1.5 group',
                isSelected
                  ? `${colors.bg.accent} ${colors.text.primary} font-medium`
                  : `${colors.text.primary} hover:${colors.bg.hover}`,
              ].join(' ')}
            >
              <span className="flex-1 truncate">{style.name}</span>

              {isActive && (
                <span className={`text-xs px-1 rounded ${colors.bg.success} ${colors.text.onSuccess} shrink-0`}>
                  {t('panels.dimensions.activeBadge')}
                </span>
              )}

              {style.isBuiltIn && (
                <span className={`text-xs px-1 rounded ${colors.bg.neutralSubtle} ${colors.text.muted} shrink-0`}>
                  {t('panels.dimensions.builtInBadge')}
                </span>
              )}

              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                {!isActive && (
                  <ActionButton
                    icon={<Check size={12} />}
                    label={t('panels.dimensions.setActive')}
                    onClick={(e) => { e.stopPropagation(); onSetActive(style.id); }}
                  />
                )}
                <ActionButton
                  icon={<Copy size={12} />}
                  label={t('panels.dimensions.duplicate')}
                  onClick={(e) => { e.stopPropagation(); onDuplicate(style.id); }}
                />
                {!style.isBuiltIn && (
                  <>
                    <ActionButton
                      icon={<Pencil size={12} />}
                      label={t('panels.dimensions.edit')}
                      onClick={(e) => { e.stopPropagation(); onEdit(style.id); }}
                    />
                    <ActionButton
                      icon={<Trash2 size={12} />}
                      label={t('panels.dimensions.delete')}
                      onClick={(e) => { e.stopPropagation(); onDelete(style.id); }}
                      danger
                    />
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}

function ActionButton({ icon, label, onClick, danger = false }: ActionButtonProps) {
  const colors = useSemanticColors();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={[
            'p-0.5 rounded',
            danger
              ? `hover:${colors.bg.danger} hover:${colors.text.onError}`
              : `hover:${colors.bg.hover} ${colors.text.muted}`,
          ].join(' ')}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
