import { useCallback } from 'react';

export type SettingsValue = string | number | boolean;

export interface SettingsUpdateConfig<T = Record<string, SettingsValue>> {
  updateSettings: (updates: Partial<T>) => void;
  validator?: (value: SettingsValue, key: string) => boolean;
  transformer?: (value: SettingsValue, key: string) => SettingsValue;
}

export interface RangeInputConfig {
  min?: number;
  max?: number;
  step?: number;
  parseType?: 'int' | 'float';
}

/**
 * Hook για unified settings update patterns
 * Παρέχει helpers για όλα τα κοινά patterns (text inputs, sliders, checkboxes, dropdowns)
 */
export function useSettingsUpdater<T = Record<string, SettingsValue>>(config: SettingsUpdateConfig<T>) {
  const { updateSettings, validator, transformer } = config;

  // Helper για value transformation και validation
  const processValue = useCallback((value: SettingsValue, key: string): SettingsValue | undefined => {
    let processedValue = transformer ? transformer(value, key) : value;

    if (validator && !validator(processedValue, key)) {
      console.warn(`Invalid value for ${key}:`, processedValue);
      return undefined;
    }

    return processedValue;
  }, [validator, transformer]);

  // Generic updater
  const updateSetting = useCallback((key: keyof T, value: SettingsValue) => {
    const processedValue = processValue(value, key as string);
    if (processedValue !== undefined) {
      updateSettings({ [key]: processedValue } as Partial<T>);
    }
  }, [updateSettings, processValue]);

  // Text input handler
  const createTextInputHandler = useCallback((key: keyof T) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting(key, e.target.value);
    };
  }, [updateSetting]);

  // Number input handler (για range sliders και number inputs)
  const createNumberInputHandler = useCallback((key: keyof T, config?: RangeInputConfig) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const parseFunc = config?.parseType === 'int' ? parseInt : parseFloat;
      const value = parseFunc(e.target.value);

      // Validation για range
      if (config?.min !== undefined && value < config.min) return;
      if (config?.max !== undefined && value > config.max) return;

      updateSetting(key, value);
    };
  }, [updateSetting]);

  // Checkbox handler
  const createCheckboxHandler = useCallback((key: keyof T) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSetting(key, e.target.checked);
    };
  }, [updateSetting]);

  // Color picker handler
  const createColorHandler = useCallback((key: keyof T) => {
    return (color: string) => {
      updateSetting(key, color);
    };
  }, [updateSetting]);

  // Dropdown/Select handler
  const createSelectHandler = useCallback((key: keyof T, closeDropdown?: () => void) => {
    return (value: SettingsValue) => {
      updateSetting(key, value);
      if (closeDropdown) closeDropdown();
    };
  }, [updateSetting]);

  // Direct value setter (για buttons, toggles κλπ)
  const createValueSetter = useCallback((key: keyof T) => {
    return (value: SettingsValue) => {
      updateSetting(key, value);
    };
  }, [updateSetting]);

  // Batch update helper
  const updateMultipleSettings = useCallback((updates: Partial<T>) => {
    const processedUpdates: Partial<T> = {};
    let hasValidUpdates = false;

    for (const [key, value] of Object.entries(updates)) {
      const processedValue = processValue(value as SettingsValue, key);
      if (processedValue !== undefined) {
        (processedUpdates as Record<string, SettingsValue>)[key] = processedValue;
        hasValidUpdates = true;
      }
    }

    if (hasValidUpdates) {
      updateSettings(processedUpdates);
    }
  }, [updateSettings, processValue]);

  // Utility για keyboard navigation σε dropdowns
  const createKeyboardHandler = useCallback((
    key: keyof T,
    options: SettingsValue[],
    currentValue: SettingsValue,
    closeDropdown?: () => void
  ) => {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = options.findIndex(option => option === currentValue);
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0);

        updateSetting(key, options[nextIndex]);
      } else if (e.key === 'Escape' && closeDropdown) {
        closeDropdown();
      }
    };
  }, [updateSetting]);

  return {
    // Core functionality
    updateSetting,
    updateMultipleSettings,

    // Event handlers
    createTextInputHandler,
    createNumberInputHandler,
    createCheckboxHandler,
    createColorHandler,
    createSelectHandler,
    createValueSetter,
    createKeyboardHandler,

    // Utility functions
    processValue
  };
}

// Συχνά χρησιμοποιούμενοι transformers
export const commonTransformers = {
  // Για numeric values με bounds
  boundedNumber: (min: number, max: number) => (value: SettingsValue) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value as number);
    return Math.max(min, Math.min(max, num as number));
  },

  // Για colors (hex validation)
  hexColor: (value: string) => {
    if (typeof value !== 'string') return value;
    return value.startsWith('#') ? value : `#${value}`;
  },

  // Για strings (trim, case conversion)
  trimmedString: (value: string) => {
    return typeof value === 'string' ? value.trim() : value;
  }
};

// Συχνά χρησιμοποιούμενοι validators
export const commonValidators = {
  // Number range validation
  numberRange: (min: number, max: number) => (value: SettingsValue) => {
    const num = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : NaN);
    return typeof num === 'number' && !isNaN(num) && num >= min && num <= max;
  },

  // Hex color validation
  hexColor: (value: SettingsValue) => {
    if (typeof value !== 'string') return false;
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  },

  // Non-empty string validation
  nonEmptyString: (value: SettingsValue) => {
    return typeof value === 'string' && value.trim().length > 0;
  }
};