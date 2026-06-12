/**
 * ADR-449 Slice 5 — finish-param ribbon combobox helpers (column + beam shared).
 *
 * Επαληθεύει: resolveFinishComboboxState (read) + applyFinishComboboxChange (write)
 * round-trip μέσω του entity-specific key→field map, incl. non-finish key → null,
 * invalid value → null (no-op), και ότι το νέο params κρατά τα υπόλοιπα πεδία.
 */

import {
  resolveFinishComboboxState,
  applyFinishComboboxChange,
} from '../finish-param';
import { COLUMN_FINISH_KEYS, COLUMN_FINISH_KEY_TO_FIELD } from '../column-command-keys';
import { BEAM_FINISH_KEYS, BEAM_FINISH_KEY_TO_FIELD } from '../beam-command-keys';
import { createDefaultStructuralFinishSpec } from '../../../../../bim/finishes/structural-finish-types';

describe('ADR-449 Slice 5 — resolveFinishComboboxState', () => {
  const spec = createDefaultStructuralFinishSpec();

  it('επιστρέφει state για finish key (column)', () => {
    expect(resolveFinishComboboxState(spec, COLUMN_FINISH_KEYS.enabled, COLUMN_FINISH_KEY_TO_FIELD))
      .toEqual({ value: 'on', options: [] });
    expect(resolveFinishComboboxState(spec, COLUMN_FINISH_KEYS.thickness, COLUMN_FINISH_KEY_TO_FIELD))
      .toEqual({ value: '15', options: [] });
  });

  it('non-finish key → null', () => {
    expect(resolveFinishComboboxState(spec, 'column.params.width', COLUMN_FINISH_KEY_TO_FIELD)).toBeNull();
  });
});

describe('ADR-449 Slice 5 — applyFinishComboboxChange', () => {
  const params = { width: 400, depth: 400, finish: createDefaultStructuralFinishSpec() };

  it('εφαρμόζει finish value + κρατά τα υπόλοιπα πεδία (column)', () => {
    const next = applyFinishComboboxChange(params, COLUMN_FINISH_KEYS.thickness, '20', COLUMN_FINISH_KEY_TO_FIELD);
    expect(next).not.toBeNull();
    expect(next?.finish?.thickness).toBe(20);
    expect(next?.width).toBe(400); // αμετάβλητο
  });

  it('beam map δουλεύει ισοδύναμα', () => {
    const beamParams = { depth: 600, finish: createDefaultStructuralFinishSpec() };
    const next = applyFinishComboboxChange(beamParams, BEAM_FINISH_KEYS.enabled, 'off', BEAM_FINISH_KEY_TO_FIELD);
    expect(next?.finish?.enabled).toBe(false);
    expect(next?.depth).toBe(600);
  });

  it('non-finish key → null', () => {
    expect(applyFinishComboboxChange(params, 'beam.params.width', '5', COLUMN_FINISH_KEY_TO_FIELD)).toBeNull();
  });

  it('invalid value (μη-θετικό πάχος) → null (no-op)', () => {
    expect(applyFinishComboboxChange(params, COLUMN_FINISH_KEYS.thickness, '0', COLUMN_FINISH_KEY_TO_FIELD)).toBeNull();
  });
});
