/**
 * =============================================================================
 * 🏢 ENTERPRISE: Workspace Switcher Component
 * =============================================================================
 *
 * Dropdown UI για επιλογή active workspace.
 * Displays available workspaces and allows switching.
 *
 * @module components/workspace/WorkspaceSwitcher
 * @enterprise ADR-032 - Workspace-based Multi-Tenancy
 *
 * @example
 * ```tsx
 * import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
 *
 * <WorkspaceSwitcher />
 * ```
 */

'use client';

import React, { useState } from 'react';
import { Building2, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation'; // 🏢 ENTERPRISE: i18n support
import { cn } from '@/lib/utils';
import type { Workspace, WorkspaceType } from '@/types/workspace';
import { WORKSPACE_TYPE_LABELS } from '@/types/workspace'; // 🏢 ENTERPRISE: i18n keys
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const logger = createModuleLogger('WorkspaceSwitcher');

// ============================================================================
// COMPONENT
// ============================================================================

export interface WorkspaceSwitcherProps {
  /** Optional CSS class */
  className?: string;
  /** Show refresh button */
  showRefresh?: boolean;
}

/**
 * Workspace Switcher Component
 *
 * Dropdown για επιλογή active workspace.
 */
export function WorkspaceSwitcher({ className, showRefresh = true }: WorkspaceSwitcherProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']); // 🏢 ENTERPRISE: i18n translation
  const { activeWorkspace, availableWorkspaces, loading, switchWorkspace, refreshWorkspaces } =
    useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSelectWorkspace = async (workspace: Workspace) => {
    if (workspace.id === activeWorkspace?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitching(true);
      await switchWorkspace(workspace.id);
      setIsOpen(false);
    } catch (error) {
      logger.error('Failed to switch workspace', { error });
      alert(t('workspace.switchFailed'));
    } finally {
      setSwitching(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshWorkspaces();
    } catch (error) {
      logger.error('Failed to refresh workspaces', { error });
    }
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const getWorkspaceIcon = (type: WorkspaceType) => {
    switch (type) {
      case 'company':
        return <Building2 className={iconSizes.sm} aria-hidden="true" />;
      case 'office_directory':
        return <Building2 className={iconSizes.sm} aria-hidden="true" />;
      case 'personal':
        return <Building2 className={iconSizes.sm} aria-hidden="true" />;
      default:
        return <Building2 className={iconSizes.sm} aria-hidden="true" />;
    }
  };

  // 🏢 ENTERPRISE: i18n-aware workspace type label (no hardcoded strings)
  const getWorkspaceTypeLabel = (type: WorkspaceType): string => {
    const i18nKey = WORKSPACE_TYPE_LABELS[type];
    return t(i18nKey, { defaultValue: type });
  };

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <RefreshCw className={cn(iconSizes.sm, 'animate-spin')} aria-hidden="true" />
        <span className={cn("text-sm", colors.text.muted)}>{t('workspace.loading')}</span>
      </div>
    );
  }

  // ==========================================================================
  // NO WORKSPACES
  // ==========================================================================

  if (availableWorkspaces.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <Building2 className={iconSizes.sm} aria-hidden="true" />
        <span className={cn("text-sm", colors.text.muted)}>{t('workspace.noWorkspaces')}</span>
      </div>
    );
  }

  // ==========================================================================
  // RENDER DROPDOWN
  // ==========================================================================

  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md',
          'bg-card border border-border',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'transition-colors',
          switching && 'opacity-50 cursor-not-allowed'
        )}
        aria-label={t('workspace.selectLabel')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Icon */}
        {getWorkspaceIcon(activeWorkspace?.type || 'company')}

        {/* Active Workspace Name */}
        <span className="text-sm font-medium truncate max-w-[200px]">
          {activeWorkspace?.displayName || t('workspace.selectWorkspace')}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={cn(iconSizes.xs, 'transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu */}
          <div
            className={cn(
              'absolute top-full left-0 mt-2 z-50',
              'w-[320px]',
              'bg-card border border-border rounded-md shadow-lg',
              'py-2'
            )}
            role="listbox"
            aria-label={t('workspace.availableLabel')}
          >
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between border-b border-border">
              <span className={cn("text-xs font-semibold uppercase", colors.text.muted)}>
                {t('workspace.title')}
              </span>
              {showRefresh && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-1 rounded hover:bg-accent"
                  aria-label={t('workspace.refreshLabel')}
                >
                  <RefreshCw className={iconSizes.xs} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Workspace List */}
            <div className="max-h-[400px] overflow-y-auto">
              {availableWorkspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspace?.id;

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => handleSelectWorkspace(workspace)}
                    disabled={switching}
                    className={cn(
                      'w-full px-3 py-2 flex items-center gap-3',
                      'hover:bg-accent hover:text-accent-foreground',
                      'transition-colors text-left',
                      isActive && 'bg-accent/50',
                      switching && 'opacity-50 cursor-not-allowed'
                    )}
                    role="option"
                    aria-selected={isActive}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">{getWorkspaceIcon(workspace.type)}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {workspace.displayName}
                        </span>
                        {isActive && (
                          <Check className={iconSizes.xs} aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-xs", colors.text.muted)}>
                          {getWorkspaceTypeLabel(workspace.type)}
                        </span>
                        {workspace.status !== 'active' && (
                          <span className={cn("text-xs", colors.text.muted)}>
                            ({workspace.status})
                          </span>
                        )}
                      </div>
                      {workspace.description && (
                        <p className={cn("text-xs mt-1 truncate", colors.text.muted)}>
                          {workspace.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
