/**
 * @fileoverview Toolbar Configurations Module
 * @description Extracted from modal-select.ts - TOOLBAR CONFIGURATIONS
 *   All user-facing strings are i18n keys resolved via t() at render time.
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 2.0.0 - i18n key pattern (ADR-296 Phase 4G)
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING, i18n SSoT
 */

// ====================================================================
// TOOLBAR CONFIGURATIONS - i18n KEYS (namespace: dxf-viewer)
// ====================================================================

/**
 * Action Buttons Labels — i18n keys for ActionButtons.tsx
 * Resolve at render time: t(MODAL_SELECT_ACTION_BUTTONS_LABELS.save, { ns: 'dxf-viewer' })
 */
export const MODAL_SELECT_ACTION_BUTTONS_LABELS = {
  // Primary Actions
  save: 'toolbar.actions.save',
  create: 'toolbar.actions.create',
  add: 'toolbar.actions.add',
  submit: 'toolbar.actions.submit',

  // Secondary Actions
  edit: 'toolbar.actions.edit',
  update: 'toolbar.actions.update',
  cancel: 'toolbar.actions.cancel',
  close: 'toolbar.actions.close',

  // Destructive Actions
  delete: 'toolbar.actions.delete',
  remove: 'toolbar.actions.remove',
  archive: 'toolbar.actions.archive',
  restore: 'toolbar.actions.restore',

  // Loading States
  save_loading: 'toolbar.actions.save_loading',
  delete_loading: 'toolbar.actions.delete_loading',
  archive_loading: 'toolbar.actions.archive_loading',
  restore_loading: 'toolbar.actions.restore_loading',

  // Utility Actions
  refresh: 'toolbar.actions.refresh',
  reset: 'toolbar.actions.reset',
  download: 'toolbar.actions.download',
  upload: 'toolbar.actions.upload',
  export: 'toolbar.actions.export',
  import: 'toolbar.actions.import',

  // Communication Actions
  call: 'toolbar.actions.call',
  email: 'toolbar.actions.email',
  message: 'toolbar.actions.message',
  sms: 'toolbar.actions.sms',

  // Navigation Actions
  back: 'toolbar.actions.back',
  next: 'toolbar.actions.next',
  previous: 'toolbar.actions.previous',

  // State Actions
  enable: 'toolbar.actions.enable',
  disable: 'toolbar.actions.disable',
  favorite: 'toolbar.actions.favorite',

  // Sorting Actions
  sort_asc: 'toolbar.actions.sort_asc',
  sort_desc: 'toolbar.actions.sort_desc',
  sort: 'toolbar.actions.sort',

  // Filter Actions
  favorites: 'toolbar.actions.favorites',
  archived: 'toolbar.actions.archived',

  // Help Actions
  help: 'toolbar.actions.help',
  info: 'toolbar.actions.info',
} as const;

// ====================================================================
// DESKTOP NAVIGATION CONFIGURATIONS - i18n KEYS
// ====================================================================

export interface DesktopConnectionModalConfig {
  readonly title: string;
  readonly placeholder: string;
  readonly emptyMessage: string;
}

export interface DesktopConnectionModalsConfig {
  readonly company: DesktopConnectionModalConfig;
  readonly project: DesktopConnectionModalConfig;
  readonly building: DesktopConnectionModalConfig;
  readonly floor: DesktopConnectionModalConfig;
  readonly unit: DesktopConnectionModalConfig;
}

export interface DesktopNavigationHeadersConfig {
  readonly companies: string;
  readonly projects: string;
  readonly buildings: string;
  readonly floors: string;
  readonly units: string;
}

export interface DesktopCountersConfig {
  readonly total: string;
  readonly selected: string;
  readonly filtered: string;
}

export interface DesktopNavigationActionsConfig {
  readonly connect: string;
  readonly disconnect: string;
  readonly edit: string;
  readonly delete: string;
  readonly view_details: string;
}

export interface DesktopStatusMessagesConfig {
  readonly loading: string;
  readonly empty: string;
  readonly error: string;
  readonly success: string;
}

export interface DesktopConfirmationDialogConfig {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

// ====================================================================
// DESKTOP CONFIGURATION FUNCTIONS - i18n KEYS
// ====================================================================

export function getDesktopConnectionModals(): DesktopConnectionModalsConfig {
  return {
    company: {
      title: 'toolbar.desktop.modals.company.title',
      placeholder: 'toolbar.desktop.modals.company.placeholder',
      emptyMessage: 'toolbar.desktop.modals.company.emptyMessage',
    },
    project: {
      title: 'toolbar.desktop.modals.project.title',
      placeholder: 'toolbar.desktop.modals.project.placeholder',
      emptyMessage: 'toolbar.desktop.modals.project.emptyMessage',
    },
    building: {
      title: 'toolbar.desktop.modals.building.title',
      placeholder: 'toolbar.desktop.modals.building.placeholder',
      emptyMessage: 'toolbar.desktop.modals.building.emptyMessage',
    },
    floor: {
      title: 'toolbar.desktop.modals.floor.title',
      placeholder: 'toolbar.desktop.modals.floor.placeholder',
      emptyMessage: 'toolbar.desktop.modals.floor.emptyMessage',
    },
    unit: {
      title: 'toolbar.desktop.modals.unit.title',
      placeholder: 'toolbar.desktop.modals.unit.placeholder',
      emptyMessage: 'toolbar.desktop.modals.unit.emptyMessage',
    },
  };
}

export function getDesktopNavigationHeaders(): DesktopNavigationHeadersConfig {
  return {
    companies: 'toolbar.desktop.headers.companies',
    projects: 'toolbar.desktop.headers.projects',
    buildings: 'toolbar.desktop.headers.buildings',
    floors: 'toolbar.desktop.headers.floors',
    units: 'toolbar.desktop.headers.units',
  };
}

export function getDesktopCounters(): DesktopCountersConfig {
  return {
    total: 'toolbar.desktop.counters.total',
    selected: 'toolbar.desktop.counters.selected',
    filtered: 'toolbar.desktop.counters.filtered',
  };
}

export function getDesktopNavigationActions(): DesktopNavigationActionsConfig {
  return {
    connect: 'toolbar.desktop.navActions.connect',
    disconnect: 'toolbar.desktop.navActions.disconnect',
    edit: 'toolbar.desktop.navActions.edit',
    delete: 'toolbar.desktop.navActions.delete',
    view_details: 'toolbar.desktop.navActions.view_details',
  };
}

export function getDesktopStatusMessages(): DesktopStatusMessagesConfig {
  return {
    loading: 'toolbar.desktop.status.loading',
    empty: 'toolbar.desktop.status.empty',
    error: 'toolbar.desktop.status.error',
    success: 'toolbar.desktop.status.success',
  };
}

export function getDesktopConfirmationDialog(): DesktopConfirmationDialogConfig {
  return {
    title: 'toolbar.desktop.confirm.title',
    message: 'toolbar.desktop.confirm.message',
    confirmLabel: 'toolbar.desktop.confirm.confirmLabel',
    cancelLabel: 'toolbar.desktop.confirm.cancelLabel',
  };
}

// ====================================================================
// ACCESSOR FUNCTIONS
// ====================================================================

export function getActionButtons() {
  return MODAL_SELECT_ACTION_BUTTONS_LABELS;
}
