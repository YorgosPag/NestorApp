import { useState, useCallback } from 'react';

export interface CadToggle {
  on: boolean;
  toggle: () => void;
  set: (value: boolean) => void;
}

export interface CadToggles {
  osnap: CadToggle;
  grid: CadToggle;
  snap: CadToggle;
  ortho: CadToggle;
  polar: CadToggle;
  dynInput: CadToggle;
}

export const useCadToggles = (): CadToggles => {
  const [osnap, setOsnap] = useState(true);
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(false);
  const [ortho, setOrtho] = useState(false);
  const [polar, setPolar] = useState(false);
  const [dynInput, setDynInput] = useState(false);

  // 🔄 ORTHO/POLAR mutual exclusion (AutoCAD-like)
  const toggleOrtho = useCallback(() => {
    setOrtho(prev => {
      const newOrtho = !prev;
      if (newOrtho) {
        setPolar(false); // Disable POLAR when ORTHO is enabled
        console.log('🔄 ORTHO enabled, POLAR disabled');
      }
      return newOrtho;
    });
  }, []);

  const togglePolar = useCallback(() => {
    setPolar(prev => {
      const newPolar = !prev;
      if (newPolar) {
        setOrtho(false); // Disable ORTHO when POLAR is enabled
        console.log('🔄 POLAR enabled, ORTHO disabled');
      }
      return newPolar;
    });
  }, []);

  return {
    osnap: {
      on: osnap,
      toggle: () => setOsnap(prev => !prev),
      set: setOsnap
    },
    grid: {
      on: grid,
      toggle: () => setGrid(prev => !prev),
      set: setGrid
    },
    snap: {
      on: snap,
      toggle: () => setSnap(prev => !prev),
      set: setSnap
    },
    ortho: {
      on: ortho,
      toggle: toggleOrtho,
      set: (value: boolean) => {
        setOrtho(value);
        if (value) setPolar(false);
      }
    },
    polar: {
      on: polar,
      toggle: togglePolar,
      set: (value: boolean) => {
        setPolar(value);
        if (value) setOrtho(false);
      }
    },
    dynInput: {
      on: dynInput,
      toggle: () => setDynInput(prev => !prev),
      set: setDynInput
    }
  };
};
