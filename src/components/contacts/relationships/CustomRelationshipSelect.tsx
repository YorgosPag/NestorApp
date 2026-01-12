'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ChevronDown, Check } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useEnterprisePortal, createPortalConfig } from '@/components/ui/enterprise-portal';
import { portalComponents, layoutUtilities } from '@/styles/design-tokens';

// Import relationship types
import type { RelationshipType } from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { getRelationshipTypeConfig, getAvailableRelationshipTypes } from './utils/relationship-types';

interface CustomRelationshipSelectProps {
  value: RelationshipType | '';
  onValueChange: (value: RelationshipType) => void;
  contactType: string;
  disabled?: boolean;
  placeholder?: string;
}

export const CustomRelationshipSelect: React.FC<CustomRelationshipSelectProps> = ({
  value,
  onValueChange,
  contactType,
  disabled = false,
  placeholder = "Επιλέξτε τύπο σχέσης"
}) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 🏢 ENTERPRISE: Get available relationship types with proper type casting
  const availableTypes = getAvailableRelationshipTypes(contactType as ContactType);

  // Get selected option config
  const selectedConfig = value ? getRelationshipTypeConfig(value) : null;

  // Update dropdown position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 320) // Minimum 320px width
      });
    }
  };

  // Handle button click
  const handleToggle = () => {
    if (disabled) return;

    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  // Handle option selection
  const handleSelect = (selectedValue: RelationshipType) => {
    onValueChange(selectedValue);
    setIsOpen(false);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position on scroll/resize with throttling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const throttledUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (isOpen) {
          updateDropdownPosition();
        }
      }, 10); // 10ms throttle
    };

    const handlePositionUpdate = () => {
      if (isOpen) {
        throttledUpdate();
      }
    };

    if (isOpen) {
      window.addEventListener('resize', handlePositionUpdate);
      document.addEventListener('scroll', handlePositionUpdate, true);
      window.addEventListener('scroll', handlePositionUpdate);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handlePositionUpdate);
      document.removeEventListener('scroll', handlePositionUpdate, true);
      window.removeEventListener('scroll', handlePositionUpdate);
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <Button
        ref={buttonRef}
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full justify-between h-10 px-3 py-2 text-sm ${colors.bg.primary} ${quick.input}`}
        type="button"
      >
        <div className="flex items-center space-x-2 flex-1 text-left">
          {selectedConfig ? (
            <>
              <selectedConfig.icon className={`${iconSizes.sm} ${colors.text.muted}`} />
              <span className="text-foreground">{selectedConfig.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`${iconSizes.sm} ${TRANSITION_PRESETS.STANDARD_TRANSFORM} ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown Portal - Debug Version */}
      {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            ...portalComponents.overlay.fullscreen,
            zIndex: portalComponents.zIndex.critical
          }}
        >
          <Card
            ref={dropdownRef}
            className={`shadow-xl ${colors.bg.primary} ${quick.card}`}
            data-custom-relationship-select="true"
            data-custom-dropdown-portal="true"
            style={{
              ...portalComponents.dropdown.custom({
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                height: 'auto',
                minHeight: '150px',
                maxHeight: '300px'
              }),
              zIndex: portalComponents.zIndex.critical,
              overflow: 'hidden'
            }}
          >
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {availableTypes.map((type) => {
                const config = getRelationshipTypeConfig(type);
                if (!config) return null;

                const Icon = config.icon;
                const isSelected = value === type;

                return (
                  <div
                    key={type}
                    onClick={() => handleSelect(type)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 cursor-pointer ${quick.borderB} last:border-b-0
                      ${TRANSITION_PRESETS.STANDARD_COLORS} ${INTERACTIVE_PATTERNS.ACCENT_HOVER}
                      ${isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground'}
                    `}
                  >
                    <Icon className={`${iconSizes.sm} flex-shrink-0 text-muted-foreground`} />
                    <span className="flex-1 text-sm font-medium">
                      {config.label}
                    </span>
                    {isSelected && (
                      <Check className={`${iconSizes.sm} text-primary ml-2`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomRelationshipSelect;