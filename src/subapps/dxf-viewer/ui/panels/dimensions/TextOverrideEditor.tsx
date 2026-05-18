'use client';

/**
 * ADR-362 Phase G1 — Pure UI component for dimension text override.
 * ADR-362 Phase N4 — Field token autocomplete + syntax highlighting.
 *
 * Three modes:
 *   measured    — shows the computed measurement (userText = undefined / '<>')
 *   prefixSuffix — wraps the measurement: "<prefix><><suffix>"
 *   free        — replaces it entirely with user text (supports field tokens)
 *
 * N4 additions:
 *   - FieldTokenInput: shows autocomplete dropdown when user types `<`
 *   - ColoredPreview: renders field tokens in blue, DIESEL in orange
 *   - Applied to all text inputs (prefix, suffix, free)
 *
 * No stores, no Firestore. Caller is responsible for saving via updateEntity.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseFieldAST, FIELD_TOKEN_NAMES, type FieldTokenName } from '../../../systems/dimensions/dim-text-field-parser';
import styles from './TextOverrideEditor.module.css';

// ── Field token autocomplete data ─────────────────────────────────────────────

interface TokenOption {
  readonly token: FieldTokenName | '';
  readonly display: string;
}

const AUTOCOMPLETE_OPTIONS: ReadonlyArray<TokenOption> = [
  { token: '', display: '<>' },
  ...FIELD_TOKEN_NAMES.map((name) => ({ token: name, display: `<${name}>` })),
];

function findOpenAngle(text: string, cursor: number): number | null {
  const before = text.slice(0, cursor);
  const lastOpen = before.lastIndexOf('<');
  if (lastOpen === -1) return null;
  return before.slice(lastOpen + 1).includes('>') ? null : lastOpen;
}

// ── ColoredPreview ─────────────────────────────────────────────────────────────

function ColoredPreview({ text }: { text: string }) {
  const ast = useMemo(() => parseFieldAST(text), [text]);
  return (
    <span className="font-mono">
      {ast.map((node, i) => {
        if (node.kind === 'literal') {
          return <React.Fragment key={i}>{node.text}</React.Fragment>;
        }
        if (node.kind === 'diesel') {
          return <span key={i} className={styles.dieselToken}>{node.raw}</span>;
        }
        const label = node.kind === 'measurement' ? '<>' : `<${node.name}>`;
        return <span key={i} className={styles.fieldToken}>{label}</span>;
      })}
    </span>
  );
}

// ── FieldTokenInput ────────────────────────────────────────────────────────────

interface FieldTokenInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  tokenLabels: Record<string, string>;
}

function FieldTokenInput({ value, onChange, disabled, placeholder, className, tokenLabels }: FieldTokenInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [openAngle, setOpenAngle] = useState<number | null>(null);
  const [partial, setPartial] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const suggestions = useMemo(() => {
    if (openAngle === null) return [];
    return AUTOCOMPLETE_OPTIONS.filter((opt) =>
      opt.display.slice(1).toLowerCase().startsWith(partial),
    );
  }, [openAngle, partial]);

  useEffect(() => { setActiveIdx(0); }, [suggestions.length]);

  const insertToken = useCallback((option: TokenOption) => {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const anchor = openAngle ?? cursor;
    const newVal = value.slice(0, anchor) + option.display + value.slice(cursor);
    onChange(newVal);
    setOpenAngle(null);
    setPartial('');
    const newCursor = anchor + option.display.length;
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(newCursor, newCursor);
      inputRef.current?.focus();
    });
  }, [value, openAngle, onChange]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value;
    const cursor = e.target.selectionStart ?? newVal.length;
    const newOpenAngle = findOpenAngle(newVal, cursor);
    setOpenAngle(newOpenAngle);
    setPartial(newOpenAngle !== null ? newVal.slice(newOpenAngle + 1, cursor).toLowerCase() : '');
    onChange(newVal);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        e.preventDefault();
        insertToken(suggestions[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpenAngle(null);
    }
  }

  function handleBlur() {
    setTimeout(() => setOpenAngle(null), 120);
  }

  return (
    <div className={styles.fieldInputWrap}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className={styles.suggestionList} role="listbox">
          {suggestions.map((opt, i) => (
            <li
              key={opt.display}
              role="option"
              aria-selected={i === activeIdx}
              className={i === activeIdx ? styles.suggestionItemActive : styles.suggestionItem}
              onMouseDown={(e) => { e.preventDefault(); insertToken(opt); }}
            >
              <span className={styles.suggestionToken}>{opt.display}</span>
              {opt.token !== '' && (
                <span className={styles.suggestionLabel}>
                  {tokenLabels[opt.token] ?? opt.token}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

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

  const tokenLabels = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const name of FIELD_TOKEN_NAMES) {
      result[name] = t(`panels.dimensions.textOverride.fieldTokens.${name}`);
    }
    return result;
  }, [t]);

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

  const MODES: OverrideMode[] = ['measured', 'prefixSuffix', 'free'];

  const showFieldInputs = mode === 'prefixSuffix' || mode === 'free';

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
          <FieldTokenInput
            value={prefix}
            onChange={handlePrefixChange}
            disabled={readOnly}
            placeholder={k('placeholderPrefix')}
            className="h-7 text-xs w-24"
            tokenLabels={tokenLabels}
          />
          <span className="text-xs font-mono text-muted-foreground select-none">&lt;&gt;</span>
          <FieldTokenInput
            value={suffix}
            onChange={handleSuffixChange}
            disabled={readOnly}
            placeholder={k('placeholderSuffix')}
            className="h-7 text-xs w-24"
            tokenLabels={tokenLabels}
          />
        </div>
      )}

      {mode === 'free' && (
        <FieldTokenInput
          value={freeText}
          onChange={handleFreeChange}
          disabled={readOnly}
          placeholder={k('placeholderFree')}
          className="h-7 text-xs"
          tokenLabels={tokenLabels}
        />
      )}

      {showFieldInputs && !readOnly && (
        <p className="text-xs text-muted-foreground">{k('fieldHint')}</p>
      )}

      <p className="text-xs text-muted-foreground leading-tight">
        <span className="font-medium">{k('preview')}: </span>
        {mode === 'measured' ? (
          <span className="font-mono">{k('previewMeasured')}</span>
        ) : mode === 'prefixSuffix' ? (
          <span className="font-mono">
            <ColoredPreview text={prefix} />
            <span className="text-blue-400 font-semibold">&lt;&gt;</span>
            <ColoredPreview text={suffix} />
          </span>
        ) : (
          <ColoredPreview text={freeText || k('previewEmpty')} />
        )}
      </p>
    </div>
  );
}
