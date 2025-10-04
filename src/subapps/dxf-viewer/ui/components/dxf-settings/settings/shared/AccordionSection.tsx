'use client';

import React, { useState } from 'react';

// Simple SVG icons
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export function AccordionSection({
  title,
  children,
  isOpen,
  onToggle,
  className = '',
  headerClassName = '',
  contentClassName = '',
  icon,
  badge,
  disabled = false
}: AccordionSectionProps) {
  return (
    <div className={`border border-gray-600 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${headerClassName}`}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          {icon && (
            <div className="flex-shrink-0 text-gray-400">
              {icon}
            </div>
          )}

          {/* Title */}
          <span className="text-sm font-medium text-white">
            {title}
          </span>

          {/* Badge */}
          {badge && (
            <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
              {badge}
            </span>
          )}
        </div>

        {/* Chevron */}
        <div className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${
          isOpen ? 'transform rotate-180' : ''
        }`}>
          {isOpen ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className={`px-4 py-4 bg-gray-750 border-t border-gray-600 ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// Hook για διαχείριση πολλαπλών accordion sections
export function useAccordion(defaultOpenSection?: string) {
  const [openSection, setOpenSection] = useState<string | null>(defaultOpenSection || null);

  const toggleSection = (sectionId: string) => {
    setOpenSection(current => current === sectionId ? null : sectionId);
  };

  const isOpen = (sectionId: string) => openSection === sectionId;

  return {
    openSection,
    setOpenSection,
    toggleSection,
    isOpen
  };
}