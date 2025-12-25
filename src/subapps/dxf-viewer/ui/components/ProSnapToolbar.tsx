'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Target, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// Ελληνικά labels και configurations για όλα τα snap modes
const SNAP_LABELS: Record<ExtendedSnapType, string> = {
  [ExtendedSnapType.AUTO]: 'Αυτόματο',
  [ExtendedSnapType.ENDPOINT]: 'Άκρο',
  [ExtendedSnapType.MIDPOINT]: 'Μέσο',
  [ExtendedSnapType.CENTER]: 'Κέντρο',
  [ExtendedSnapType.INTERSECTION]: 'Τομή',
  [ExtendedSnapType.GRID]: 'Πλέγμα',
  [ExtendedSnapType.PERPENDICULAR]: 'Κάθετος',
  [ExtendedSnapType.TANGENT]: 'Εφαπτομένη',
  [ExtendedSnapType.PARALLEL]: 'Παράλληλος',
  [ExtendedSnapType.QUADRANT]: 'Τεταρτημόριο',
  [ExtendedSnapType.NEAREST]: 'Κοντινότερο',
  [ExtendedSnapType.EXTENSION]: 'Επέκταση',
  [ExtendedSnapType.NODE]: 'Κόμβος',
  [ExtendedSnapType.INSERTION]: 'Εισαγωγή',
  [ExtendedSnapType.NEAR]: 'Πλησίον',
  [ExtendedSnapType.ORTHO]: 'Ορθογώνιος'
};

const SNAP_TOOLTIPS: Record<ExtendedSnapType, string> = {
  [ExtendedSnapType.AUTO]: 'Αυτόματο Snap - Ανιχνεύει αυτόματα τα καλύτερα σημεία (F11)',
  [ExtendedSnapType.ENDPOINT]: 'Άκρα Γραμμών - Snap στα τελικά σημεία γραμμών και τόξων (E)',
  [ExtendedSnapType.MIDPOINT]: 'Μέσα Σημεία - Snap στο μέσο γραμμών και τόξων (M)',
  [ExtendedSnapType.CENTER]: 'Κέντρα - Snap στο κέντρο κύκλων και τόξων (C)',
  [ExtendedSnapType.INTERSECTION]: 'Τομές - Snap στις τομές δύο αντικειμένων (I)',
  [ExtendedSnapType.GRID]: 'Πλέγμα - Snap στα σημεία του πλέγματος (F9)',
  [ExtendedSnapType.PERPENDICULAR]: 'Κάθετος - Snap κάθετα σε γραμμές (P)',
  [ExtendedSnapType.TANGENT]: 'Εφαπτόμενη - Snap εφαπτόμενα σε κύκλους και τόξα (T)',
  [ExtendedSnapType.PARALLEL]: 'Παράλληλος - Snap παράλληλα με υπάρχουσες γραμμές (L)',
  [ExtendedSnapType.QUADRANT]: 'Τεταρτημόρια - Snap στα τεταρτημόρια κύκλων (Q)',
  [ExtendedSnapType.NEAREST]: 'Κοντινότερο - Snap στο πλησιέστερο σημείο αντικειμένου (N)',
  [ExtendedSnapType.EXTENSION]: 'Επέκταση - Snap σε επεκτάσεις γραμμών (X)',
  [ExtendedSnapType.NODE]: 'Κόμβοι - Snap σε κόμβους και σημεία (D)',
  [ExtendedSnapType.INSERTION]: 'Εισαγωγή - Snap σε σημεία εισαγωγής (INS)',
  [ExtendedSnapType.NEAR]: 'Πλησίον - Snap κοντά σε αντικείμενα (R)',
  [ExtendedSnapType.ORTHO]: 'Ορθογώνιος - Περιορισμός σε οριζόντιες/κάθετες γραμμές (F8)'
};

interface SnapButtonProps {
  mode: ExtendedSnapType;
  enabled: boolean;
  onClick: () => void;
  compact?: boolean;
}

const SnapButton: React.FC<SnapButtonProps> = ({ mode, enabled, onClick, compact = false }) => {
  const label = SNAP_LABELS[mode];
  const tooltip = SNAP_TOOLTIPS[mode];
  const { quick, getStatusBorder, radius } = useBorderTokens();

  if (!label) return null;

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        ${compact ? 'h-6 w-12 text-xs' : 'h-8 w-16 text-sm'}
        ${radius.md} border transition-all duration-150 font-medium
        flex items-center justify-center
        ${enabled
          ? `bg-blue-600 ${getStatusBorder('info')} text-white shadow-md ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
          : `bg-gray-700 ${getStatusBorder('default')} text-gray-300 ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
        }
      `}
    >
      <span className="select-none truncate">{label}</span>
    </button>
  );
};

const CORE_MODES = [
  ExtendedSnapType.AUTO,
  ExtendedSnapType.ENDPOINT,
  ExtendedSnapType.MIDPOINT,
  ExtendedSnapType.CENTER,
  ExtendedSnapType.INTERSECTION
];

const ADVANCED_MODES = [
  ExtendedSnapType.GRID,
  ExtendedSnapType.PERPENDICULAR,
  ExtendedSnapType.TANGENT,
  ExtendedSnapType.PARALLEL,
  ExtendedSnapType.QUADRANT,
  ExtendedSnapType.NEAREST,
  ExtendedSnapType.EXTENSION,
  ExtendedSnapType.NODE,
  ExtendedSnapType.INSERTION,
  ExtendedSnapType.NEAR,
  ExtendedSnapType.ORTHO
];

interface ProSnapToolbarProps {
  enabledModes: Set<ExtendedSnapType>;
  onToggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  snapEnabled: boolean;
  onToggleSnap: (enabled: boolean) => void;
  className?: string;
  compact?: boolean;
}


export const ProSnapToolbar: React.FC<ProSnapToolbarProps> = ({
  enabledModes,
  onToggleMode,
  snapEnabled,
  onToggleSnap,
  className = '',
  compact = false,
}) => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleMasterToggle = useCallback(() => {
    onToggleSnap(!snapEnabled);
  }, [snapEnabled, onToggleSnap]);

  const handleModeToggle = useCallback((mode: ExtendedSnapType) => {
    onToggleMode(mode, !(enabledModes?.has(mode) || false));
  }, [enabledModes, onToggleMode]);

  const handleToggleAdvanced = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  const handleQuickEnable = useCallback(() => {
    CORE_MODES.forEach(mode => {
      if (!(enabledModes?.has(mode) || false)) {
        onToggleMode(mode, true);
      }
    });
  }, [enabledModes, onToggleMode]);

  const enabledCount = useMemo(() => enabledModes?.size || 0, [enabledModes]);
  const advancedEnabledCount = useMemo(() => ADVANCED_MODES.filter(mode => enabledModes?.has(mode)).length, [enabledModes]);
  
  return (
    <div className={`flex items-center gap-2 p-2 bg-gray-800 ${quick.card} ${className}`}>
      <button
        onClick={handleMasterToggle}
        className={`px-3 py-1 ${radius.md} text-sm font-bold transition-colors border flex items-center gap-1 ${
          snapEnabled ? `bg-blue-600 text-white ${getStatusBorder('info')} shadow-md` : `bg-gray-700 text-gray-300 ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK}`
        }`}
        title="Ενεργοποίηση/Απενεργοποίηση Object Snap (F3)"
      >
        <Target size={14} />
        <span>SNAP</span>
        {enabledCount > 0 && <span className="text-xs opacity-80">({enabledCount})</span>}
      </button>

      <div className="flex gap-1">
        {CORE_MODES.map(mode => (
          <SnapButton
            key={mode}
            mode={mode}
            enabled={enabledModes?.has(mode) || false}
            onClick={() => handleModeToggle(mode)}
            compact={compact}
          />
        ))}
      </div>

      {ADVANCED_MODES.length > 0 && (
        <>
          <div className="w-px h-6 bg-gray-600" />
          <button
            onClick={handleToggleAdvanced}
            className={`${iconSizes.xl} ${radius.md} border transition-all duration-150 flex items-center justify-center ${
              showAdvanced || advancedEnabledCount > 0 ? `bg-gray-600 ${getStatusBorder('subtle')} text-white` : `bg-gray-700 ${getStatusBorder('default')} text-gray-400 ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK}`
            }`}
            title={`${showAdvanced ? 'Απόκρυψη' : 'Εμφάνιση'} προχωρημένων λειτουργιών`}
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </>
      )}

      <div className="w-px h-6 bg-gray-600" />
      <button
        onClick={handleQuickEnable}
        className={`${iconSizes.xl} ${radius.md} border transition-all duration-150 flex items-center justify-center text-gray-400 ${HOVER_TEXT_EFFECTS.WHITE} bg-gray-700 ${getStatusBorder('default')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK}`}
        title="Ενεργοποίηση βασικών λειτουργιών"
      >
        <Settings size={14} />
      </button>

      {showAdvanced && (
        <div className={`flex gap-1 ml-1 pl-1 ${quick.separatorV}`}>
          {ADVANCED_MODES.map(mode => (
            <SnapButton
              key={mode}
              mode={mode}
              enabled={enabledModes?.has(mode) || false}
              onClick={() => handleModeToggle(mode)}
              compact={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProSnapToolbar;
