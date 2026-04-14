'use client';

import React, { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ToolDefinition, ActionDefinition } from './types';
import { ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
// 🏢 ENTERPRISE: Shadcn Button (same as CompactToolbar - NO BORDERS, clean minimal look)
import { Button } from '@/components/ui/button';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Shadcn Tooltip (replaces native title attribute)
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

interface ToolButtonProps {
  tool: ToolDefinition;
  isActive: boolean;
  onClick: () => void;
  onDropdownSelect?: (toolId: string) => void;
  disabled?: boolean;
  activeTool?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({ tool, isActive, onClick, onDropdownSelect, disabled, activeTool }) => {
  // 🏢 ENTERPRISE HOOKS: Zero duplicates - using existing centralized systems
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  // Determine which icon to show - if activeTool matches a dropdown option, use that icon
  let IconComponent = tool.icon;
  if (tool.dropdownOptions && activeTool) {
    const activeOption = tool.dropdownOptions.find(option => option.id === activeTool);
    if (activeOption) {
      IconComponent = activeOption.icon;
    }
  }
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasDropdown = tool.dropdownOptions && tool.dropdownOptions.length > 0;

  useClickOutside(dropdownRef, () => setShowDropdown(false));

  const handleMainClick = () => {
    if (!hasDropdown) {
      onClick();
    } else {
      onClick(); // Default action (first tool)
    }
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleDropdownItemClick = (toolId: string) => {
    setShowDropdown(false);
    if (onDropdownSelect) {
      onDropdownSelect(toolId);
    }
  };

  // 🎨 ENTERPRISE: Apply color class to icon (only when NOT active - active state has its own colors)
  const iconColorClass = !isActive && tool.colorClass ? tool.colorClass : '';

  // 🏢 ENTERPRISE: Simple button without dropdown
  if (!hasDropdown) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={onClick}
              disabled={disabled}
              aria-label={`${t(tool.label)} (${tool.hotkey})`}
              className={`${iconSizes.xl} p-0`}
            >
              {IconComponent ? (
                <IconComponent className={`${iconSizes.md} ${iconColorClass}`} />
              ) : (
                <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${iconColorClass}`}>
                  {tool.label?.charAt(0) || '?'}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{`${t(tool.label)} (${tool.hotkey})`}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 🏢 ENTERPRISE: Button with dropdown (split button pattern)
  return (
    <TooltipProvider>
      <div className="relative" ref={dropdownRef}>
        <div className="flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={handleMainClick}
                disabled={disabled}
                aria-label={`${t(tool.label)} (${tool.hotkey})`}
                className="rounded-r-none px-2"
              >
                {IconComponent ? (
                  <IconComponent className={`${iconSizes.md} ${iconColorClass}`} />
                ) : (
                  <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${iconColorClass}`}>
                    {tool.label?.charAt(0) || '?'}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{`${t(tool.label)} (${tool.hotkey})`}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={handleDropdownToggle}
                disabled={disabled}
                aria-label={t('entitiesSettings.moreOptions')}
                className="rounded-l-none px-1"
              >
                <ChevronDown className={`${iconSizes.xs} ${iconColorClass}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('entitiesSettings.moreOptions')}</TooltipContent>
          </Tooltip>
        </div>

        {/* 🏢 ENTERPRISE: Dropdown menu with grouped sections (ADR-189 §37) */}
        {showDropdown && (
          <nav className="absolute top-full left-0 mt-1 bg-popover text-popover-foreground rounded-md shadow-lg z-50 min-w-max border border-border py-1 max-h-[70vh] overflow-y-auto">
            {tool.dropdownOptions!.map((option, index) => {
              const OptionIcon = option.icon;
              const prevGroup = index > 0 ? tool.dropdownOptions![index - 1].group : undefined;
              const showGroupHeader = option.group && option.group !== prevGroup;
              return (
                <React.Fragment key={option.id}>
                  {showGroupHeader && (
                    <header className={`px-3 py-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-semibold ${colors.text.muted} uppercase tracking-wider select-none ${index > 0 ? 'border-t border-border mt-1 pt-1.5' : ''}`}>
                      {t(option.group!)}
                    </header>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDropdownItemClick(option.id)}
                    className={`flex items-center w-full px-3 py-1.5 ${PANEL_LAYOUT.TYPOGRAPHY.SM} whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground`}
                  >
                    {OptionIcon && <OptionIcon className={`${iconSizes.sm} mr-2 shrink-0 ${iconColorClass}`} />}
                    <span className="flex-1 text-left">{t(option.label)}</span>
                    {option.hotkey && <span className={`ml-2 text-[10px] shrink-0 ${colors.text.muted}`}>{option.hotkey}</span>}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        )}
      </div>
    </TooltipProvider>
  );
};

interface ActionButtonProps {
  action: ActionDefinition;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ action }) => {
  const iconSizes = useIconSizes();
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const IconComponent = action.icon;

  // 🏢 ENTERPRISE: Translate label - supports both i18n keys and plain strings
  const translatedLabel = action.label.startsWith('tools.') || action.label.startsWith('actionButtons.')
    ? t(action.label)
    : action.label;

  // 🎨 ENTERPRISE: Apply color class to icon (only when NOT active - active state has its own colors)
  const iconColorClass = !action.active && action.colorClass ? action.colorClass : '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={action.active ? 'default' : 'ghost'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled ?? false}
            aria-label={action.hotkey ? `${translatedLabel} (${action.hotkey})` : translatedLabel}
            className={`${iconSizes.xl} p-0`}
          >
            {IconComponent ? (
              <IconComponent className={`${iconSizes.sm} ${iconColorClass}`} />
            ) : (
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${iconColorClass}`}>
                {action.label?.charAt(0) || '?'}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{action.hotkey ? `${translatedLabel} (${action.hotkey})` : translatedLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

