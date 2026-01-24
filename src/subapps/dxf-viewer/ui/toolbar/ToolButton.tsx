'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('dxf-viewer');
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
                className="rounded-l-none px-1"
              >
                <ChevronDown className={`${iconSizes.xs} ${iconColorClass}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('entitiesSettings.moreOptions')}</TooltipContent>
          </Tooltip>
        </div>

        {/* 🏢 ENTERPRISE: Dropdown menu */}
        {showDropdown && (
          <nav className={`absolute top-full left-0 mt-1 ${colors.bg.secondary} rounded-md shadow-lg z-50 min-w-[160px] border border-border`}>
            {tool.dropdownOptions!.map((option) => {
              const OptionIcon = option.icon;
              return (
                <Button
                  key={option.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDropdownItemClick(option.id)}
                  className="w-full justify-start rounded-none first:rounded-t-md last:rounded-b-md"
                >
                  {OptionIcon && <OptionIcon className={`${iconSizes.sm} mr-2 ${iconColorClass}`} />}
                  {t(option.label)}
                </Button>
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
  const { t } = useTranslation('dxf-viewer');
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
