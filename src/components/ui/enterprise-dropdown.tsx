"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// ENTERPRISE DROPDOWN SYSTEM - CENTRALIZED SOLUTION
// ============================================================================
//
// 🏢 Single source of truth για όλα τα dropdown components στην εφαρμογή
// Χρησιμοποιεί το theme system (bg-popover, text-popover-foreground, etc.)
// Εξασφαλίζει consistent εμφάνιση σε όλη την εφαρμογή
//
// ============================================================================

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ComponentType<any>;
  disabled?: boolean;
}

export interface EnterpriseDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

/**
 * 🏢 Enterprise Dropdown Component
 *
 * Κεντρικοποιημένο dropdown που χρησιμοποιεί το theme system της εφαρμογής
 * για consistent εμφάνιση σε όλα τα dropdowns
 */
export const EnterpriseDropdown: React.FC<EnterpriseDropdownProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "Επιλέξτε...",
  disabled = false,
  className,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected option
  const selectedOption = options.find(option => option.value === value);

  // Update dropdown position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 320)
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
  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
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
      }, 10);
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
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <Button
        ref={buttonRef}
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full justify-between h-10 px-3 py-2 text-sm border bg-background",
          error ? "border-destructive" : "border-input",
          "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        type="button"
      >
        <div className="flex items-center space-x-2 flex-1 text-left">
          {selectedOption ? (
            <>
              {selectedOption.icon && <selectedOption.icon className="h-4 w-4 text-muted-foreground" />}
              <span className="text-foreground">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
      </Button>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}

      {/* Dropdown Portal */}
      {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2147483647,
            pointerEvents: 'none'
          }}
        >
          <div
            ref={dropdownRef}
            className="rounded-md border bg-popover text-popover-foreground shadow-md"
            style={{
              position: 'absolute',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              minHeight: '100px',
              maxHeight: '300px',
              overflow: 'hidden',
              pointerEvents: 'auto'
            }}
          >
            <div className="p-1 max-h-72 overflow-y-auto">
              {options.map((option) => {
                const Icon = option.icon;
                const isSelected = value === option.value;

                return (
                  <div
                    key={option.value}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    className={cn(
                      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                      option.disabled
                        ? "pointer-events-none opacity-50"
                        : "focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                    <span className="flex-1">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnterpriseDropdown;