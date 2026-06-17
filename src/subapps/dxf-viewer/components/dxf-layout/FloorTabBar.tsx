'use client';

/**
 * ADR-399 — Building Floor Navigation Tabs (presentational strip).
 *
 * Οριζόντια μπάρα καρτελών ορόφων, ακριβώς κάτω από το status bar και πάνω από
 * τον καμβά (mount: `NormalView.tsx`). Μία καρτέλα ανά όροφο του κτιρίου· κλικ →
 * μετάβαση/lazy-provision του αντίστοιχου level. Όλη η λογική ζει στο
 * {@link useFloorTabs}· εδώ μόνο rendering.
 *
 * Phase B — καρτέλα «Όλοι οι όροφοι» ΠΡΩΤΗ-αριστερά: στοιβάζει όλο το κτίριο σε
 * 3Δ (`floor3DScope='all'`). Phase C — checkbox στην αρχή κάθε καρτέλας ορόφου
 * που ορίζει αν ο όροφος εμφανίζεται μέσα στο «Όλοι» (κοινό SSoT με Floor3DPanel
 * → `floorVisibilityModes`).
 *
 * Styling: αμιγώς centralized tokens (useSemanticColors + useBorderTokens +
 * PANEL_LAYOUT) — καμία inline style, σημασιολογικό `<nav>` (κανόνες N.3/N.4).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useFloorTabs, type FloorTab } from '../../hooks/data/useFloorTabs';
import { FloorManagementDialogStore } from '../../stores/FloorManagementDialogStore';

const TAB_BASE_CLASS =
  `flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.ROUNDED.TOP} ` +
  `${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} whitespace-nowrap ${PANEL_LAYOUT.INTERACTIVE.TRANSITION}`;

interface AllFloorsTabProps {
  active: boolean;
  label: string;
  ariaLabel: string;
  onSelect: () => void;
}

const AllFloorsTab: React.FC<AllFloorsTabProps> = ({ active, label, ariaLabel, onSelect }) => {
  const colors = useSemanticColors();
  const stateClass = active
    ? `${colors.bg.info} ${colors.text.inverse}`
    : `${colors.text.muted} ${PANEL_LAYOUT.INTERACTIVE.HOVER}`;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={`${TAB_BASE_CLASS} ${stateClass}`}
    >
      <Layers size={13} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
};

interface FloorTabButtonProps {
  tab: FloorTab;
  active: boolean;
  visibleInAll: boolean;
  emptyLabel: string;
  checkboxLabel: string;
  onSelect: (tab: FloorTab) => void;
  onToggleVisible: (tab: FloorTab) => void;
}

const FloorTabButton: React.FC<FloorTabButtonProps> = ({
  tab, active, visibleInAll, emptyLabel, checkboxLabel, onSelect, onToggleVisible,
}) => {
  const colors = useSemanticColors();
  const stateClass = active
    ? `${colors.bg.info} ${colors.text.inverse}`
    : `${colors.text.muted} ${PANEL_LAYOUT.INTERACTIVE.HOVER}`;

  return (
    <span className={`${TAB_BASE_CLASS} ${stateClass}`}>
      {/* Phase C — visibility checkbox (disabled for virtual/empty floors). */}
      <input
        type="checkbox"
        checked={visibleInAll}
        disabled={!tab.levelId}
        onChange={() => onToggleVisible(tab)}
        aria-label={checkboxLabel}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-current disabled:cursor-not-allowed disabled:opacity-40"
      />
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onSelect(tab)}
        className={`flex items-center ${PANEL_LAYOUT.GAP.XS} whitespace-nowrap`}
      >
        <span>{tab.label}</span>
        {!tab.hasFloorplan && (
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${active ? colors.text.inverse : colors.text.muted} ${PANEL_LAYOUT.OPACITY['70']}`}>
            {emptyLabel}
          </span>
        )}
      </button>
    </span>
  );
};

export const FloorTabBar: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    visible, tabs, activeFloorId, onSelectTab,
    floor3DScope, onSelectAllFloors, floorVisibilityModes, onToggleFloorVisible,
  } = useFloorTabs();

  if (!visible || tabs.length === 0) return null;

  const allActive = floor3DScope === 'all';

  return (
    <nav
      role="tablist"
      aria-label={t('floorTabs.ariaLabel')}
      // Δεξί κλικ στη γραμμή σταθμών → ανοίγει την καρτέλα «Όροφοι» σε modal (Revit-style).
      onContextMenu={(e) => {
        e.preventDefault();
        FloorManagementDialogStore.open();
      }}
      className={`shrink-0 ${getDirectionalBorder('muted', 'top')} ${colors.bg.backgroundSecondary} ${PANEL_LAYOUT.SPACING.HORIZONTAL_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.OVERFLOW.X_AUTO}`}
    >
      {/* Phase B — «Όλοι οι όροφοι», πρώτη αριστερά. */}
      <AllFloorsTab
        active={allActive}
        label={t('floorTabs.allFloors')}
        ariaLabel={t('floorTabs.allFloorsAria')}
        onSelect={onSelectAllFloors}
      />
      {tabs.map((tab) => (
        <FloorTabButton
          key={tab.floorId}
          tab={tab}
          active={!allActive && tab.floorId === activeFloorId}
          visibleInAll={(floorVisibilityModes.get(tab.levelId ?? '') ?? 'show') !== 'hide'}
          emptyLabel={t('floorTabs.emptyBadge')}
          checkboxLabel={t('floorTabs.floorVisibleAria', { floor: tab.label })}
          onSelect={onSelectTab}
          onToggleVisible={onToggleFloorVisible}
        />
      ))}
    </nav>
  );
};
