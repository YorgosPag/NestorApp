'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ToolDefinition, ActionDefinition } from './types';
import { ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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
  const { getStatusBorder, getElementBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Centralized backgrounds - NO HARDCODED VALUES
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

  if (!hasDropdown) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={`${tool.label} (${tool.hotkey})`}
        className={`
          ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} rounded-md transition-colors duration-150
          flex items-center justify-center
          ${
            isActive
              ? `${colors.bg.info} ${colors.text.inverse} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
              : `${colors.bg.hover} ${colors.text.secondary} ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {IconComponent ? <IconComponent className={`${iconSizes.md} text-current`} /> : <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{tool.label?.charAt(0) || '?'}</span>}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex">
        <button
          onClick={handleMainClick}
          disabled={disabled}
          title={`${tool.label} (${tool.hotkey})`}
          className={`
            ${PANEL_LAYOUT.BUTTON.HEIGHT} ${PANEL_LAYOUT.WIDTH.BUTTON_MD} ${PANEL_LAYOUT.SPACING.NONE} rounded-l-md transition-colors duration-150
            flex items-center justify-center
            ${
              isActive
                ? `${colors.bg.info} ${colors.text.inverse} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                : `${colors.bg.hover} ${colors.text.secondary} ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {IconComponent ? <IconComponent className={`${iconSizes.md} text-current`} /> : <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{tool.label?.charAt(0) || '?'}</span>}
        </button>
        <button
          onClick={handleDropdownToggle}
          disabled={disabled}
          title="Περισσότερες επιλογές"
          className={`
            ${PANEL_LAYOUT.BUTTON.HEIGHT} ${PANEL_LAYOUT.WIDTH.XS} ${PANEL_LAYOUT.SPACING.NONE} rounded-r-md transition-colors duration-150
            flex items-center justify-center
            ${
              isActive
                ? `${colors.bg.info} ${colors.text.inverse} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                : `${colors.bg.hover} ${colors.text.secondary} ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <ChevronDown className={`${iconSizes.xs} text-current`} />
        </button>
      </div>

      {showDropdown && (
        <nav className={`absolute top-full left-0 ${PANEL_LAYOUT.MARGIN.TOP_XS} ${colors.bg.secondary} rounded-md shadow-lg z-50 min-w-[150px] ${getStatusBorder('default')}`}>
          {tool.dropdownOptions!.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => handleDropdownItemClick(option.id)}
                className={`w-full ${PANEL_LAYOUT.BUTTON.PADDING} text-left ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.secondary} flex items-center ${PANEL_LAYOUT.GAP.SM} first:rounded-t-md last:rounded-b-md ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              >
                {OptionIcon && <OptionIcon className={iconSizes.sm} />}
                {option.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

interface ActionButtonProps {
  action: ActionDefinition;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ action }) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getElementBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Centralized colors for ActionButton
  const IconComponent = action.icon;
  
  return (
    <button
      onClick={action.onClick}
      title={action.hotkey ? `${action.label} (${action.hotkey})` : action.label}
      disabled={action.disabled ?? false}
      className={`
        ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} rounded-md transition-colors duration-150
        flex items-center justify-center
        ${
          action.active
            ? `${colors.bg.info} ${colors.text.inverse} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
            : action.disabled
            ? `${colors.bg.secondary} ${colors.text.muted} ${getElementBorder('button', 'default')} cursor-not-allowed`
            : `${colors.bg.hover} ${colors.text.secondary} ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
        }
      `}
    >
      {IconComponent ? <IconComponent className={iconSizes.sm} /> : <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>{action.label?.charAt(0) || '?'}</span>}
    </button>
  );
};
