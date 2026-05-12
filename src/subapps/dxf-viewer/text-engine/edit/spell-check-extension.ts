/**
 * ADR-344 Phase 8 — TipTap extension that decorates mis-spelled words.
 *
 * Wires the worker-backed `SpellChecker` to a ProseMirror Plugin that
 * paints `<span class="spell-error">` decorations underneath every
 * mis-spelled token. The plugin owns its own `DecorationSet`; the worker
 * round-trip is debounced (300 ms) so typing latency stays at 60 fps even
 * on long paragraphs.
 *
 * Pattern reference: `text-engine/collab/yjs-tiptap-extension.ts`
 * (same `addProseMirrorPlugins()` shape — only existing ProseMirror plugin
 * usage in the project).
 *
 * @module text-engine/edit/spell-check-extension
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { createModuleLogger } from '@/lib/telemetry';
import { getSpellChecker } from '../spell';
import type {
  CustomTermPayload,
  MisspelledRange,
  SpellChecker,
  SpellLanguage,
} from '../spell';

const logger = createModuleLogger('SpellCheckExtension');

/**
 * State stored inside the plugin: latest decoration set + a monotonic
 * generation counter so async results from a stale worker call can be
 * discarded.
 */
interface SpellPluginState {
  readonly decorations: DecorationSet;
  readonly generation: number;
  readonly enabled: boolean;
}

export const SPELL_PLUGIN_KEY = new PluginKey<SpellPluginState>('dxfSpellCheck');

/**
 * Custom transaction meta keys used to push results back into the plugin.
 * (Transaction meta is the canonical way to communicate with a plugin from
 * outside — ProseMirror does not let async callbacks mutate plugin state
 * directly.)
 */
const META_UPDATE_DECORATIONS = 'dxf:spell:update-decorations' as const;
const META_TOGGLE_ENABLED = 'dxf:spell:toggle-enabled' as const;

export interface SpellCheckOptions {
  /** Languages active for this editor. Default: ['el','en']. */
  readonly languages: readonly SpellLanguage[];
  /** Custom dictionary entries to hydrate on mount. */
  readonly initialCustomTerms: readonly CustomTermPayload[];
  /** Initial toggle state. */
  readonly enabled: boolean;
  /** Debounce window for worker round-trips (ms). */
  readonly debounceMs: number;
}

const DEFAULT_OPTIONS: SpellCheckOptions = {
  languages: ['el', 'en'],
  initialCustomTerms: [],
  enabled: true,
  debounceMs: 300,
};

declare module '@tiptap/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Commands<ReturnType> {
    spellCheck: {
      setSpellCheckEnabled: (enabled: boolean) => ReturnType;
      rebuildSpellDecorations: () => ReturnType;
    };
  }
}

function buildDecorationSet(
  doc: EditorState['doc'],
  misspelled: readonly MisspelledRange[],
): DecorationSet {
  const decorations: Decoration[] = [];
  for (const m of misspelled) {
    // ProseMirror positions are 0-indexed (whole-doc), text positions in
    // `m.from`/`m.to` are character offsets into the flat text we sent.
    // The mapping is 1:1 once we account for the document's leading `0`
    // position; we offset by +1 so the decoration covers exactly the word.
    decorations.push(
      Decoration.inline(m.from + 1, m.to + 1, {
        class: 'spell-error',
        'data-spell-word': m.word,
        'data-spell-lang': m.language,
      }),
    );
  }
  return DecorationSet.create(doc, decorations);
}

function extractText(doc: EditorState['doc']): string {
  let out = '';
  doc.descendants((node) => {
    if (node.isText && typeof node.text === 'string') out += node.text;
    else if (node.isBlock && out.length > 0) out += ' ';
    return true;
  });
  return out;
}

interface RunnerHandle {
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: number;
  generation: number;
  dispose: () => void;
}

function createRunner(
  view: { state: EditorState; dispatch: (tr: Transaction) => void },
  checker: SpellChecker,
  debounceMs: number,
): RunnerHandle {
  const handle: RunnerHandle = {
    timer: null,
    inFlight: 0,
    generation: 0,
    dispose: () => {
      if (handle.timer) clearTimeout(handle.timer);
      handle.timer = null;
    },
  };

  const schedule = () => {
    if (handle.timer) clearTimeout(handle.timer);
    handle.timer = setTimeout(async () => {
      handle.timer = null;
      const myGeneration = ++handle.generation;
      handle.inFlight++;
      try {
        const text = extractText(view.state.doc);
        const misspelled = await checker.checkText(text);
        if (myGeneration !== handle.generation) return; // stale
        const tr = view.state.tr.setMeta(META_UPDATE_DECORATIONS, {
          misspelled,
          generation: myGeneration,
        });
        view.dispatch(tr);
      } catch (err) {
        logger.warn('Spell check failed', { error: err });
      } finally {
        handle.inFlight--;
      }
    }, debounceMs);
  };

  // Initial run.
  schedule();
  (handle as RunnerHandle & { schedule: () => void }).schedule = schedule;
  return handle;
}

export function createSpellCheckExtension(
  partial: Partial<SpellCheckOptions> = {},
): Extension<SpellCheckOptions> {
  const options: SpellCheckOptions = { ...DEFAULT_OPTIONS, ...partial };

  return Extension.create<SpellCheckOptions>({
    name: 'dxfSpellCheck',
    priority: 100,
    addOptions() {
      return options;
    },

    addCommands() {
      return {
        setSpellCheckEnabled:
          (enabled: boolean) =>
          ({ tr, dispatch }) => {
            tr.setMeta(META_TOGGLE_ENABLED, enabled);
            if (dispatch) dispatch(tr);
            return true;
          },
        rebuildSpellDecorations:
          () =>
          ({ tr, dispatch }) => {
            tr.setMeta('dxf:spell:rebuild', true);
            if (dispatch) dispatch(tr);
            return true;
          },
      };
    },

    addProseMirrorPlugins() {
      const checker = getSpellChecker({
        languages: options.languages,
        initialCustomTerms: options.initialCustomTerms,
      });

      let runner: (RunnerHandle & { schedule?: () => void }) | null = null;

      return [
        new Plugin<SpellPluginState>({
          key: SPELL_PLUGIN_KEY,
          state: {
            init(_, state): SpellPluginState {
              return {
                decorations: DecorationSet.empty,
                generation: 0,
                enabled: options.enabled,
              };
            },
            apply(tr, prev, _oldState, newState): SpellPluginState {
              const toggle = tr.getMeta(META_TOGGLE_ENABLED);
              const enabled = typeof toggle === 'boolean' ? toggle : prev.enabled;

              if (!enabled) {
                return { decorations: DecorationSet.empty, generation: prev.generation, enabled };
              }

              const update = tr.getMeta(META_UPDATE_DECORATIONS) as
                | { misspelled: readonly MisspelledRange[]; generation: number }
                | undefined;
              if (update && update.generation >= prev.generation) {
                return {
                  decorations: buildDecorationSet(newState.doc, update.misspelled),
                  generation: update.generation,
                  enabled,
                };
              }

              // Document changed → remap decorations + schedule a re-check.
              if (tr.docChanged) {
                if (runner) runner.schedule?.();
                return {
                  decorations: prev.decorations.map(tr.mapping, newState.doc),
                  generation: prev.generation,
                  enabled,
                };
              }

              return { ...prev, enabled };
            },
          },
          props: {
            decorations(state) {
              return SPELL_PLUGIN_KEY.getState(state)?.decorations ?? DecorationSet.empty;
            },
          },
          view(view) {
            runner = createRunner(view, checker, options.debounceMs);
            return {
              destroy() {
                runner?.dispose();
                runner = null;
              },
            };
          },
        }),
      ];
    },
  });
}

/**
 * Convenience helper for the context menu: read the misspelling at a given
 * document position. Returns `null` if the position is not inside a
 * decoration.
 */
export function findMisspellingAt(
  state: EditorState,
  pos: number,
): { from: number; to: number; word: string; language: SpellLanguage } | null {
  const plugin = SPELL_PLUGIN_KEY.getState(state);
  if (!plugin) return null;
  const found = plugin.decorations.find(pos, pos);
  if (found.length === 0) return null;
  const deco = found[0];
  const spec = deco.spec as { 'data-spell-word'?: string; 'data-spell-lang'?: SpellLanguage };
  if (!spec['data-spell-word'] || !spec['data-spell-lang']) return null;
  return {
    from: deco.from,
    to: deco.to,
    word: spec['data-spell-word'],
    language: spec['data-spell-lang'],
  };
}
