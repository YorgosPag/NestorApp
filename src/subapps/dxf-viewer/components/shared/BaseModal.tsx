/**
 * BASE MODAL COMPONENT
 * Unified modal component to eliminate duplicate modal patterns across the application
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BaseButton } from './BaseButton';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  
  // Modal behavior options
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  
  // Footer options
  footer?: React.ReactNode;
  
  // Styling options
  className?: string;
  overlayClassName?: string;
  
  // Z-index management
  zIndex?: number;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg', 
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4'
};

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  footer,
  className = '',
  overlayClassName = '',
  zIndex = 9998
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement;
    
    // Focus the modal
    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Restore focus when modal closes
    return () => {
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || typeof window === 'undefined') return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity ${overlayClassName}`}
        style={{ zIndex }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ zIndex: zIndex + 1 }}
      >
        <div className="flex items-center justify-center min-h-full p-4 text-center sm:p-0">
          {/* Modal Content */}
          <div
            ref={modalRef}
            className={`
              relative inline-block w-full 
              ${sizeClasses[size]}
              bg-gray-900 
              border border-gray-600 
              rounded-lg 
              shadow-2xl 
              text-left 
              transform 
              transition-all 
              sm:align-middle
              ${className}
            `}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between p-4 border-b border-gray-600">
                {title && (
                  <h3 
                    id="modal-title" 
                    className="text-lg font-medium text-white"
                  >
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={onClose}
                    aria-label="Κλείσιμο modal"
                    className="ml-auto"
                  />
                )}
              </div>
            )}

            {/* Body */}
            <div className="p-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-4 py-3 border-t border-gray-600 bg-gray-800 rounded-b-lg">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};

// Convenience components for common modal patterns
export const ConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Επιβεβαίωση',
  cancelText = 'Άκυρο',
  variant = 'info'
}) => {
  const confirmVariant = variant === 'danger' ? 'primary' : 'secondary';
  
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end space-x-2">
          <BaseButton variant="ghost" onClick={onClose}>
            {cancelText}
          </BaseButton>
          <BaseButton variant={confirmVariant} onClick={onConfirm}>
            {confirmText}
          </BaseButton>
        </div>
      }
    >
      <p className="text-gray-200">{message}</p>
    </BaseModal>
  );
};

export const LoadingModal: React.FC<{
  isOpen: boolean;
  title?: string;
  message?: string;
}> = ({
  isOpen,
  title = 'Φόρτωση...',
  message = 'Παρακαλώ περιμένετε...'
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => {}} // No close action for loading modal
      title={title}
      size="sm"
      closeOnBackdrop={false}
      closeOnEscape={false}
      showCloseButton={false}
    >
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="text-gray-200">{message}</span>
      </div>
    </BaseModal>
  );
};