'use client';
import React from 'react';
import { withIconProps } from '../../icons/iconRegistry';

interface ToolbarButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'danger';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function ToolbarButton({
  label,
  icon,
  onClick,
  active = false,
  variant = 'default',
  disabled = false,
  size = 'medium'
}: ToolbarButtonProps) {
  
  const baseClasses = [
    'dv-btn',
    `dv-btn--${variant}`,
    `dv-btn--${size}`,
    active ? 'dv-btn--active' : '',
    disabled ? 'dv-btn--disabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <>
      <button
        className={baseClasses}
        onClick={onClick}
        disabled={disabled}
        title={label}
        type="button"
      >
        {icon && (
          <span className="dv-btn__icon">
            {withIconProps(icon)}
          </span>
        )}
        <span className="dv-btn__label">{label}</span>
      </button>

      <style jsx>{`
        .dv-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border-radius: 8px;
          border: 1px solid #2a2a2a;
          background: #1f1f1f;
          color: #eaeaea;
          cursor: pointer;
          transition: all 0.15s ease;
          font-weight: 500;
          white-space: nowrap;
          box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset;
        }

        .dv-btn:hover:not(.dv-btn--disabled) {
          background: #262626;
          border-color: #3a3a3a;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .dv-btn:active:not(.dv-btn--disabled) {
          transform: translateY(0);
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        /* Sizes */
        .dv-btn--small {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        .dv-btn--medium {
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
        }

        .dv-btn--large {
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
        }

        /* Variants */
        .dv-btn--primary {
          background: #2b3345;
          border-color: #3e4a68;
          color: #dfe8ff;
        }

        .dv-btn--primary:hover:not(.dv-btn--disabled) {
          background: #364157;
          border-color: #4a5a7a;
        }

        .dv-btn--success {
          background: #1e3f2b;
          border-color: #2a7f43;
          color: #a9f5c3;
        }

        .dv-btn--success:hover:not(.dv-btn--disabled) {
          background: #255233;
          border-color: #36a555;
        }

        .dv-btn--danger {
          background: #2a1f1f;
          border-color: #5a2a2a;
          color: #ffdede;
        }

        .dv-btn--danger:hover:not(.dv-btn--disabled) {
          background: #352626;
          border-color: #6a3535;
        }

        /* States */
        .dv-btn--active {
          background: #2b3345;
          border-color: #3e4a68;
          color: #dfe8ff;
          box-shadow: 0 0 8px rgba(58, 122, 254, 0.3);
        }

        .dv-btn--disabled {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: #666;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .dv-btn__icon {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }

        .dv-btn__label {
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
      `}</style>
    </>
  );
}
