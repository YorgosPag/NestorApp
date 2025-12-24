'use client';

import React, { useState } from 'react';
import { Ruler, AlertCircle, CheckCircle } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { createDefaultCalibration } from './utils/calibration-utils';
import { HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function CalibrationStep() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
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
        <h3 className="text-lg font-medium text-white mb-2">
          Βαθμονόμηση Κλίμακας & Μονάδων
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Ορίστε τις μονάδες και προαιρετικά βαθμονομήστε την κλίμακα χρησιμοποιώντας γνωστές μετρήσεις από το DXF αρχείο σας.
        </p>
      </div>

      {/* Units Selection */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">Μονάδες</h4>
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
                  ? `${getStatusBorder('active')} bg-blue-500 bg-opacity-20 text-blue-300`
                  : `${quick.button} text-gray-300 ${HOVER_BORDER_EFFECTS.MUTED}`
              }`}
            >
              {unit.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calibration Options */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300">Βαθμονόμηση</h4>
        
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
            <div className="text-white font-medium">Παράλειψη Βαθμονόμησης (Προτεινόμενο)</div>
            <p className="text-sm text-gray-400 mt-1">
              Χρήση εγγενών μονάδων και κλίμακας του DXF αρχείου. Καλύτερο για τις περισσότερες αρχιτεκτονικές κατόψεις.
            </p>
            <div className="flex items-center mt-2 text-green-400">
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
            <div className="text-white font-medium">Βαθμονόμηση 2 Σημείων</div>
            <p className="text-sm text-gray-400 mt-1">
              Ορισμός κλίμακας μετρώντας μια γνωστή απόσταση στο σχέδιο.
            </p>
            <div className="flex items-center mt-2 text-blue-400">
              <Ruler className={`${iconSizes.sm} mr-1`} />
              <span className="text-xs">Ακριβής βαθμονόμηση για προσαρμοσμένη κλίμακα</span>
            </div>
          </div>
        </label>

        {/* Manual Calibration Controls */}
        {!skipCalibration && (
          <div className="bg-gray-700 rounded-lg p-4 space-y-3">
            <h5 className="text-sm font-medium text-blue-400">Ρυθμίσεις Βαθμονόμησης</h5>
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">
                Γνωστή Απόσταση:
                <input
                  type="number"
                  value={realDistance}
                  onChange={(e) => setRealDistance(e.target.value)}
                  placeholder="π.χ. 100"
                  className={`mt-1 w-full bg-gray-600 ${quick.input} px-3 py-2 text-white placeholder-gray-400 focus:outline-none`}
                />
              </label>
              <p className="text-xs text-gray-400">
                Στο επόμενο βήμα θα μπορείτε να επιλέξετε δύο σημεία στο σχέδιο που αντιστοιχούν σε αυτή την απόσταση.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
