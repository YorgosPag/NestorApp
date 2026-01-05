/**
 * BASE MODAL COMPONENT
 * Unified modal component to eliminate duplicate modal patterns across the application
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BaseButton } from './BaseButton';
// portalComponents not available - creating mock
const portalComponents = {
  modal: {
    backdrop: { zIndex: (z: number) => z },
    content: { zIndex: (z: number) => z + 1 }
  }
};
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '../modal/ModalLoadingStates';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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
  full: `max-w-full ${PANEL_LAYOUT.MARGIN.X_LG}`
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
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
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
        style={{ zIndex: portalComponents.modal.backdrop.zIndex(zIndex) }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 overflow-y-auto"
        style={{ zIndex: portalComponents.modal.content.zIndex(zIndex) }}
      >
        <div className={`flex items-center justify-center min-h-full ${PANEL_LAYOUT.SPACING.LG} text-center ${PANEL_LAYOUT.SPACING.SM_NONE}`}>
          {/* Modal Content */}
          <div
            ref={modalRef}
            className={`
              relative inline-block w-full 
              ${sizeClasses[size]}
              ${colors.bg.accent} 
              ${getStatusBorder('muted')} 
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
              <div className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'bottom')}`}>
                {title && (
                  <h3
                    id="modal-title"
                    className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} font-medium ${colors.text.primary}`}
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
            <div className={PANEL_LAYOUT.SPACING.LG}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className={`${PANEL_LAYOUT.BUTTON.PADDING} ${getDirectionalBorder('muted', 'top')} ${colors.bg.secondary} rounded-b-lg`}>
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
  const colors = useSemanticColors();
  const confirmVariant = variant === 'danger' ? 'primary' : 'secondary';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <nav className={`flex justify-end ${PANEL_LAYOUT.SPACING.GAP_H_SM}`}>
          <BaseButton variant="ghost" onClick={onClose}>
            {cancelText}
          </BaseButton>
          <BaseButton variant={confirmVariant} onClick={onConfirm}>
            {confirmText}
          </BaseButton>
        </nav>
      }
    >
      <p className={`${colors.text.secondary}`}>{message}</p>
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
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
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
      <aside className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
        <AnimatedSpinner size="medium" />
        <span className={colors.text.secondary}>{message}</span>
      </aside>
    </BaseModal>
  );
};