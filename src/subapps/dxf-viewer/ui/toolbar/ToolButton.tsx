'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ToolDefinition, ActionDefinition } from './types';
import { ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';

interface ToolButtonProps {
  tool: ToolDefinition;
  isActive: boolean;
  onClick: () => void;
  onDropdownSelect?: (toolId: string) => void;
  disabled?: boolean;
  activeTool?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({ tool, isActive, onClick, onDropdownSelect, disabled, activeTool }) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getElementBorder } = useBorderTokens();
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
          ${iconSizes.xl} p-0 rounded-md transition-colors duration-150
          flex items-center justify-center
          ${
            isActive
              ? `bg-blue-600 text-white ${getStatusBorder('active')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
              : `bg-gray-700 text-gray-200 ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {IconComponent ? <IconComponent className={`${iconSizes.md} text-current`} /> : <span className="text-xs font-bold">{tool.label?.charAt(0) || '?'}</span>}
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
            h-8 w-7 p-0 rounded-l-md border-r-0 transition-colors duration-150
            flex items-center justify-center
            ${
              isActive
                ? `bg-blue-600 text-white ${getStatusBorder('active')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                : `bg-gray-700 text-gray-200 ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {IconComponent ? <IconComponent className={`${iconSizes.md} text-current`} /> : <span className="text-xs font-bold">{tool.label?.charAt(0) || '?'}</span>}
        </button>
        <button
          onClick={handleDropdownToggle}
          disabled={disabled}
          title="Περισσότερες επιλογές"
          className={`
            h-8 w-5 p-0 rounded-r-md transition-colors duration-150
            flex items-center justify-center
            ${
              isActive
                ? `bg-blue-600 text-white ${getStatusBorder('active')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                : `bg-gray-700 text-gray-200 ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <ChevronDown className={`${iconSizes.xs} text-current`} />
        </button>
      </div>

      {showDropdown && (
        <div className={`absolute top-full left-0 mt-1 bg-gray-800 rounded-md shadow-lg z-50 min-w-[150px] ${getStatusBorder('default')}`}>
          {tool.dropdownOptions!.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => handleDropdownItemClick(option.id)}
                className={`w-full px-3 py-2 text-left text-sm text-gray-200 flex items-center gap-2 first:rounded-t-md last:rounded-b-md ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              >
                {OptionIcon && <OptionIcon className={iconSizes.sm} />}
                {option.label}
              </button>
            );
          })}
        </div>
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
  const IconComponent = action.icon;
  
  return (
    <button
      onClick={action.onClick}
      title={`${action.label} (${action.hotkey})`}
      disabled={action.disabled}
      className={`
        ${iconSizes.xl} p-0 rounded-md transition-colors duration-150
        flex items-center justify-center
        ${
          action.active
            ? `bg-blue-600 text-white ${getStatusBorder('active')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
            : action.disabled
            ? `bg-gray-800 text-gray-500 ${getElementBorder('button', 'disabled')} cursor-not-allowed`
            : `bg-gray-700 text-gray-200 ${getElementBorder('button', 'default')} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
        }
      `}
    >
      {IconComponent ? <IconComponent className={iconSizes.sm} /> : <span className="text-xs font-bold">{action.label?.charAt(0) || '?'}</span>}
    </button>
  );
};
