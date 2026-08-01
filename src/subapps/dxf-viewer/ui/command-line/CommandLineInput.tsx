'use client';
// ADR-357 Phase 14-B — Command Line Input widget.
// AutoCAD-style bottom command line: type alias → Enter → tool activates.
// ADR-040 compliant: subscribes ONLY to CommandLineStore (low-freq, not canvas stores).

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CommandLineStore } from '../../systems/command-line/CommandLineStore';
import { CommandHistoryStore } from '../../systems/command-line/CommandHistoryStore';
import {
  resolveAlias,
  getMatchingAliases,
} from '../../systems/command-line/CommandAliasRegistry';
import { toolStateStore } from '../../stores/ToolStateStore';
// ADR-739 Φ.Δ βήμα 4 — εντολές που ΔΕΝ οπλίζουν εργαλείο (π.χ. `TABLEDIT`): ενεργούν πάνω
// στην τρέχουσα επιλογή. Δεύτερο μητρώο επίτηδες — δες την κεφαλίδα του.
import {
  resolveCommandAction,
  runCommandAction,
  getMatchingCommandActions,
} from '../../systems/command-line/CommandActionRegistry';
import { CommandAutocompleteList, type CommandSuggestion } from './CommandAutocompleteList';
// ADR-364 — Escape Command Bus SSoT
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';

export function CommandLineInput() {
  const { t } = useTranslation('dxf-viewer-shell');
  const clState = useSyncExternalStore(
    CommandLineStore.subscribe,
    CommandLineStore.getSnapshot,
    CommandLineStore.getSnapshot,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);

  // Οι ενέργειες προηγούνται στη λίστα για τον ίδιο λόγο που προηγούνται και στην
  // εκτέλεση: είναι λίγες και συγκεκριμένες, ενώ τα ~150 aliases εργαλείων είναι ο θόρυβος
  // βάθους. Το συνολικό όριο μένει 8, ώστε το popover να μη μεγαλώνει.
  const matches: readonly CommandSuggestion[] = [
    ...getMatchingCommandActions(input, 8).map((e) => ({ alias: e.alias, detail: e.actionId })),
    ...getMatchingAliases(input, 8).map((e) => ({ alias: e.alias, detail: e.toolId })),
  ].slice(0, 8);

  // Focus input when store shows the widget (letter pressed on canvas).
  useEffect(() => {
    if (!clState.visible) return;
    const ref = inputRef.current;
    if (!ref) return;
    ref.focus();

    if (clState.pendingChar) {
      setInput(clState.pendingChar);
      CommandLineStore.clearPendingChar();
    }
  }, [clState.visible, clState.pendingChar]);

  // Reset autocomplete index on input change.
  useEffect(() => {
    setAutocompleteIdx(0);
  }, [input]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    CommandHistoryStore.resetNavigation();
    setInput(e.target.value.toUpperCase());
  }

  function executeCommand(alias: string) {
    const cmd = alias.trim().toUpperCase();
    if (!cmd) {
      // Empty Enter → repeat last command
      const last = CommandHistoryStore.getEntries()[0];
      if (last) executeCommand(last);
      return;
    }

    // ADR-739 Φ.Δ βήμα 4 — οι ενέργειες ρωτιούνται ΠΡΩΤΕΣ. Τα δύο σύνολα ονομάτων είναι
    // αποδεδειγμένα ξένα (`__tests__/command-alias-namespace.test.ts`), οπότε η σειρά δεν
    // κρίνει ποιος κερδίζει — κρίνει τι θα συμβεί αν κάποιος **σπάσει** αυτή την απόδειξη:
    // μια εντολή που δεν οπλίζει εργαλείο είναι πάντα η πιο συγκεκριμένη πρόθεση.
    const actionId = resolveCommandAction(cmd);
    if (actionId) {
      // `runCommandAction` επιστρέφει `false` όταν η ενέργεια δεν έχει νόημα τώρα (καμία
      // επιλογή, λάθος τύπος οντότητας). Τότε ΔΕΝ γράφεται στο ιστορικό: το ιστορικό
      // εντολών είναι «τι έκανα», όχι «τι πληκτρολόγησα».
      if (runCommandAction(actionId)) CommandHistoryStore.push(cmd);
    } else {
      const toolId = resolveAlias(cmd);
      if (toolId) {
        CommandHistoryStore.push(cmd);
        toolStateStore.selectTool(toolId);
      }
    }

    setInput('');
    CommandLineStore.hide();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const chosen = matches[autocompleteIdx]?.alias ?? input;
        executeCommand(chosen);
        break;
      }
      // ADR-364: Escape moved to EscapeCommandBus (COMMAND_LINE priority, allowWhenEditable).
      case 'ArrowUp': {
        e.preventDefault();
        if (matches.length > 0) {
          setAutocompleteIdx(prev =>
            prev > 0 ? prev - 1 : matches.length - 1,
          );
        } else {
          const prev = CommandHistoryStore.navigateUp();
          if (prev !== null) setInput(prev);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (matches.length > 0) {
          setAutocompleteIdx(prev =>
            prev < matches.length - 1 ? prev + 1 : 0,
          );
        } else {
          const next = CommandHistoryStore.navigateDown();
          setInput(next);
        }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        const top = matches[autocompleteIdx];
        if (top) setInput(top.alias);
        break;
      }
      default:
        break;
    }
  }

  function handleBlur() {
    if (!input) CommandLineStore.hide();
  }

  // ADR-364 — COMMAND_LINE priority slot in the EscapeCommandBus.
  // `allowWhenEditable: true` because the command-line widget owns its own
  // text input — ESC dismisses the widget even with focus inside it.
  useEscapeHandler({
    id: 'command-line/dismiss',
    priority: ESC_PRIORITY.COMMAND_LINE,
    allowWhenEditable: true,
    canHandle: () => clState.visible,
    handle: () => {
      setInput('');
      CommandLineStore.hide();
      return true;
    },
  });

  return (
    <div className="relative flex items-center shrink-0">
      <span
        aria-hidden
        className="mr-1 text-xs font-mono font-bold text-muted-foreground select-none"
      >
        {t('commandLine.prompt')}
      </span>
      <CommandAutocompleteList
        matches={matches}
        selectedIndex={autocompleteIdx}
        onSelect={(alias) => {
          setInput(alias);
          inputRef.current?.focus();
        }}
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={matches.length > 0}
        aria-label={t('commandLine.label')}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={clState.visible ? '' : t('commandLine.placeholder')}
        className={`h-6 w-32 rounded border bg-background px-1.5 text-xs font-mono transition-all focus:w-48 focus:outline-none focus:ring-1 focus:ring-ring ${
          clState.visible
            ? 'border-ring text-foreground'
            : 'border-border text-muted-foreground'
        }`}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
      />
    </div>
  );
}
