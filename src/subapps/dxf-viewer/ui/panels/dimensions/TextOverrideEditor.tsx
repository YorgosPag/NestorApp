'use client';

/**
 * ADR-362 Phase G1 — Pure UI component for dimension text override.
 *
 * Three modes:
 *   measured    — shows the computed measurement (userText = undefined / '<>')
 *   prefixSuffix — wraps the measurement: "<prefix><><suffix>"
 *   free        — replaces it entirely with user text (no '<>' token)
 *
 * No stores, no Firestore. Caller is responsible for saving via updateEntity.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OverrideMode = 'measured' | 'prefixSuffix' | 'free';

function detectMode(userText: string | undefined): OverrideMode {
  if (!userText || userText === '<>') return 'measured';
  if (userText.includes('<>')) return 'prefixSuffix';
  return 'free';
}

function parsePrefix(text: string): string {
  const idx = text.indexOf('<>');
  return idx > 0 ? text.slice(0, idx) : '';
}

function parseSuffix(text: string): string {
  const idx = text.indexOf('<>');
  return idx >= 0 ? text.slice(idx + 2) : '';
}

interface TextOverrideEditorProps {
  userText: string | undefined;
  onChange: (text: string | undefined) => void;
  readOnly?: boolean;
}

export function TextOverrideEditor({
  userText,
  onChange,
  readOnly = false,
}: TextOverrideEditorProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const k = (key: string) => t(`panels.dimensions.textOverride.${key}`);

  const [mode, setMode] = useState<OverrideMode>(() => detectMode(userText));
  const [prefix, setPrefix] = useState(() => (userText ? parsePrefix(userText) : ''));
  const [suffix, setSuffix] = useState(() => (userText ? parseSuffix(userText) : ''));
  const [freeText, setFreeText] = useState<string>(() =>
    detectMode(userText) === 'free' ? (userText ?? '') : '',
  );

  useEffect(() => {
    const newMode = detectMode(userText);
    setMode(newMode);
    if (newMode === 'prefixSuffix' && userText) {
      setPrefix(parsePrefix(userText));
      setSuffix(parseSuffix(userText));
    } else if (newMode === 'free') {
      setFreeText(userText ?? '');
    } else {
      setPrefix('');
      setSuffix('');
      setFreeText('');
    }
  }, [userText]);

  function handleModeChange(newMode: OverrideMode) {
    setMode(newMode);
    if (newMode === 'measured') {
      onChange(undefined);
    } else if (newMode === 'prefixSuffix') {
      const val = `${prefix}<>${suffix}`;
      onChange(val === '<>' ? undefined : val);
    } else {
      onChange(freeText || undefined);
    }
  }

  function handlePrefixChange(val: string) {
    setPrefix(val);
    onChange(`${val}<>${suffix}`);
  }

  function handleSuffixChange(val: string) {
    setSuffix(val);
    onChange(`${prefix}<>${val}`);
  }

  function handleFreeChange(val: string) {
    setFreeText(val);
    onChange(val || undefined);
  }

  const preview =
    mode === 'measured'
      ? k('previewMeasured')
      : mode === 'prefixSuffix'
        ? `${prefix || ''}<Τιμή>${suffix || ''}`
        : freeText || k('previewEmpty');

  const MODES: OverrideMode[] = ['measured', 'prefixSuffix', 'free'];

  return (
    <div className="flex flex-col gap-3 py-1">
      <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
        {MODES.map((m) => (
          <Label key={m} className="flex items-center gap-2 cursor-pointer font-normal text-sm">
            <input
              type="radio"
              name="dim-text-override-mode"
              value={m}
              checked={mode === m}
              onChange={() => handleModeChange(m)}
              disabled={readOnly}
              className="accent-primary"
            />
            {k(`mode.${m}`)}
          </Label>
        ))}
      </fieldset>

      {mode === 'prefixSuffix' && (
        <div className="flex items-center gap-2">
          <Input
            value={prefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            disabled={readOnly}
            placeholder={k('placeholderPrefix')}
            className="h-7 text-xs w-24"
          />
          <span className="text-xs font-mono text-muted-foreground select-none">&lt;&gt;</span>
          <Input
            value={suffix}
            onChange={(e) => handleSuffixChange(e.target.value)}
            disabled={readOnly}
            placeholder={k('placeholderSuffix')}
            className="h-7 text-xs w-24"
          />
        </div>
      )}

      {mode === 'free' && (
        <Input
          value={freeText}
          onChange={(e) => handleFreeChange(e.target.value)}
          disabled={readOnly}
          placeholder={k('placeholderFree')}
          className="h-7 text-xs"
        />
      )}

      <p className="text-xs text-muted-foreground leading-tight">
        <span className="font-medium">{k('preview')}: </span>
        <span className="font-mono">{preview}</span>
      </p>
    </div>
  );
}
