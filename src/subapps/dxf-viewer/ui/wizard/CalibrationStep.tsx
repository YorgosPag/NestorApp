'use client';

import React, { useState } from 'react';
import { Ruler, AlertCircle, CheckCircle } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { createDefaultCalibration } from './utils/calibration-utils';
import { HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function CalibrationStep() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { setCalibration } = useLevels();
  const [units, setUnits] = useState<'mm' | 'cm' | 'm' | 'in' | 'ft'>('mm');
  const [skipCalibration, setSkipCalibration] = useState(true);
  const [realDistance, setRealDistance] = useState('');

  const handleSkipChange = (skip: boolean) => {
    setSkipCalibration(skip);
    if (skip && setCalibration) {
      setCalibration(createDefaultCalibration(units, 100));
    }
  };

  const handleUnitsChange = (newUnits: typeof units) => {
    setUnits(newUnits);
    if (setCalibration) {
      setCalibration(createDefaultCalibration(newUnits, parseFloat(realDistance) || 100));
    }
  };

  const handleManualCalibration = () => {
    setSkipCalibration(false);
    if (setCalibration) {
      setCalibration(createDefaultCalibration(units, parseFloat(realDistance) || 100));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium ${colors.text.primary} mb-2">
          Βαθμονόμηση Κλίμακας & Μονάδων
        </h3>
        <p className={`text-sm ${colors.text.muted} mb-6`}>
          Ορίστε τις μονάδες και προαιρετικά βαθμονομήστε την κλίμακα χρησιμοποιώντας γνωστές μετρήσεις από το DXF αρχείο σας.
        </p>
      </div>

      {/* Units Selection */}
      <div className="space-y-3">
        <h4 className={`text-sm font-medium ${colors.text.tertiary}`}>Μονάδες</h4>
        <div className="grid grid-cols-5 gap-2">
          {[
            { value: 'mm', label: 'χιλιοστά' },
            { value: 'cm', label: 'εκατοστά' }, 
            { value: 'm', label: 'μέτρα' },
            { value: 'in', label: 'ίντσες' },
            { value: 'ft', label: 'πόδια' }
          ].map((unit) => (
            <button
              key={unit.value}
              onClick={() => handleUnitsChange(unit.value as typeof units)}
              className={`p-2 text-sm transition-colors ${
                units === unit.value
                  ? `${getStatusBorder('info')} ${colors.bg.info} ${colors.text.info}`
                  : `${quick.button} ${colors.text.tertiary} ${HOVER_BORDER_EFFECTS.MUTED}`
              }`}
            >
              {unit.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calibration Options */}
      <div className="space-y-4">
        <h4 className={`text-sm font-medium ${colors.text.tertiary}`}>Βαθμονόμηση</h4>
        
        {/* Skip Calibration Option */}
        <label className={`flex items-start p-3 ${quick.card} cursor-pointer ${HOVER_BORDER_EFFECTS.MUTED} transition-colors`}>
          <input
            type="radio"
            name="calibration"
            checked={skipCalibration}
            onChange={() => handleSkipChange(true)}
            className="mt-1 mr-3"
          />
          <div>
            <div className="${colors.text.primary} font-medium">Παράλειψη Βαθμονόμησης (Προτεινόμενο)</div>
            <p className={`text-sm ${colors.text.muted} mt-1`}>
              Χρήση εγγενών μονάδων και κλίμακας του DXF αρχείου. Καλύτερο για τις περισσότερες αρχιτεκτονικές κατόψεις.
            </p>
            <div className={`flex items-center mt-2 ${colors.text.success}`}>
              <CheckCircle className={`${iconSizes.sm} mr-1`} />
              <span className="text-xs">Γρήγορη εισαγωγή, διατηρεί την αρχική κλίμακα</span>
            </div>
          </div>
        </label>

        {/* Manual Calibration Option */}
        <label className={`flex items-start p-3 ${quick.card} cursor-pointer ${HOVER_BORDER_EFFECTS.MUTED} transition-colors`}>
          <input
            type="radio"
            name="calibration"
            checked={!skipCalibration}
            onChange={() => handleManualCalibration()}
            className="mt-1 mr-3"
          />
          <div>
            <div className="${colors.text.primary} font-medium">Βαθμονόμηση 2 Σημείων</div>
            <p className={`text-sm ${colors.text.muted} mt-1`}>
              Ορισμός κλίμακας μετρώντας μια γνωστή απόσταση στο σχέδιο.
            </p>
            <div className={`flex items-center mt-2 ${colors.text.info}`}>
              <Ruler className={`${iconSizes.sm} mr-1`} />
              <span className="text-xs">Ακριβής βαθμονόμηση για προσαρμοσμένη κλίμακα</span>
            </div>
          </div>
        </label>

        {/* Manual Calibration Controls */}
        {!skipCalibration && (
          <div className={`${colors.bg.secondary} rounded-lg p-4 space-y-3`}>
            <h5 className={`text-sm font-medium ${colors.text.info}`}>Ρυθμίσεις Βαθμονόμησης</h5>
            <div className="space-y-2">
              <label className={`block text-sm ${colors.text.tertiary}`}>
                Γνωστή Απόσταση:
                <input
                  type="number"
                  value={realDistance}
                  onChange={(e) => setRealDistance(e.target.value)}
                  placeholder="π.χ. 100"
                  className={`mt-1 w-full ${colors.bg.muted} ${quick.input} px-3 py-2 ${colors.text.primary} ${colors.text.muted} focus:outline-none`}
                />
              </label>
              <p className={`text-xs ${colors.text.muted}`}>
                Στο επόμενο βήμα θα μπορείτε να επιλέξετε δύο σημεία στο σχέδιο που αντιστοιχούν σε αυτή την απόσταση.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
