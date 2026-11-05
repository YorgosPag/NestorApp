'use client';

/**
 * **Ο επεξεργαστής σώματος ρήτρας** (ADR-928 §5.22): κείμενο, λίστες, και παράμετροι ως chips.
 *
 * 🔑 TipTap 3 (MIT, ήδη στο έργο) με **μόνο** ό,τι έχει το μοντέλο: παράγραφος · λίστα (κουκκίδες / αριθμημένη) ·
 *    κόμβος-παράμετρος. Καμία έντονη/πλάγια/επικεφαλίδα: ό,τι επικολληθεί με μορφοποίηση κρατά μόνο το κείμενο.
 * 🔑 Το μοντέλο είναι ένα (`ClauseBlock[]`)· το έγγραφο του επεξεργαστή είναι όψη (`clause-body-doc`). Ό,τι αλλάζει
 *    **απ' έξω** (απόρριψη αλλαγών, μετονομασία κλειδιού) ξαναγράφει την όψη· ό,τι γράφει ο άνθρωπος δεν ξαναγράφεται
 *    (ο δρομέας δεν πηδά).
 * 🔑 Τρεις δρόμοι προς παράμετρο: κουμπί «Παράμετρος» · πλήκτρο `{` (Notion/Figma) · «Κάνε το παράμετρο» από επιλογή.
 *    Η νέα παράμετρος και το chip της φτάνουν στον καλούντα **σε μία αλλαγή** (`onChange(blocks, added)`), ώστε το σώμα να
 *    μην αναφέρει ποτέ, ούτε για ένα καρέ, παράμετρο που δεν υπάρχει.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn, renderParameterValue } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { CLAUSE_PARAM_NODE, clauseBlocksToDoc, docToClauseBlocks } from '@/subapps/procurement/subcontracts/clauses/clause-body-doc';
import { CLAUSE_AUTHORITATIVE_LANGUAGE, type ClauseBlock } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { ClauseBodyToolbar } from './ClauseBodyToolbar';
import { ClauseParamLabelsContext, ClauseParamNode, type ClauseParamChipView } from './clause-param-node';
import { NewParameterDialog, type NewParameterRequest } from './NewParameterDialog';

const AUTHORITATIVE = documentLocaleOf(CLAUSE_AUTHORITATIVE_LANGUAGE);

/** Μόνο ό,τι έχει το μοντέλο. */
const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false, bold: false, code: false, codeBlock: false, hardBreak: false, heading: false,
    horizontalRule: false, italic: false, link: false, strike: false, underline: false, trailingNode: false,
  }),
  ClauseParamNode,
];

export interface ClauseBodyEditorProps {
  readonly id: string;
  readonly label: string;
  readonly describedBy?: string;
  readonly blocks: readonly ClauseBlock[];
  readonly parameters: readonly ClauseParameterDefinition[];
  readonly onChange: (blocks: ClauseBlock[], added: ClauseParameterDefinition | null) => void;
}

const asDoc = (blocks: readonly ClauseBlock[]): JSONContent => clauseBlocksToDoc(blocks) as JSONContent;

interface Bridge {
  readonly emitted: { current: readonly ClauseBlock[] };
  readonly pendingAdd: { current: ClauseParameterDefinition | null };
  readonly openMenu: { current: () => void };
}

function useClauseEditor(props: ClauseBodyEditorProps, bridge: Bridge): Editor | null {
  const onChange = useRef(props.onChange);
  onChange.current = props.onChange;
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: asDoc(props.blocks),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: props.id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': props.label,
        ...(props.describedBy ? { 'aria-describedby': props.describedBy } : {}),
        class: 'min-h-[10rem] rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-1.5',
      },
      handleTextInput: (_view, _from, _to, text) => {
        if (text !== '{') return false;
        bridge.openMenu.current();
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = docToClauseBlocks(current.getJSON());
      const added = bridge.pendingAdd.current;
      bridge.emitted.current = next;
      bridge.pendingAdd.current = null;
      onChange.current(next, added);
    },
  });
  useEffect(() => {
    if (!editor || dequal(props.blocks, bridge.emitted.current)) return;
    bridge.emitted.current = props.blocks;
    editor.commands.setContent(asDoc(props.blocks), { emitUpdate: false });
  }, [editor, props.blocks, bridge.emitted]);
  return editor;
}

function useChipViews(parameters: readonly ClauseParameterDefinition[]): (key: string) => ClauseParamChipView | null {
  return useMemo(() => {
    const byKey = new Map(parameters.map((parameter) => [parameter.key, parameter]));
    return (key: string) => {
      const definition = byKey.get(key);
      if (!definition) return null;
      const value = definition.source.kind === 'term' ? '' : renderParameterValue(definition.preferred, definition, AUTHORITATIVE);
      return { label: localizedIn(definition.label, CLAUSE_AUTHORITATIVE_LANGUAGE) || key, value };
    };
  }, [parameters]);
}

export function ClauseBodyEditor(props: ClauseBodyEditorProps) {
  const bridge = useRef<Bridge>({ emitted: { current: props.blocks }, pendingAdd: { current: null }, openMenu: { current: () => undefined } }).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const [request, setRequest] = useState<NewParameterRequest | null>(null);
  bridge.openMenu.current = () => setMenuOpen(true);
  const editor = useClauseEditor(props, bridge);
  const chipViews = useChipViews(props.parameters);
  const takenKeys = useMemo(() => new Set(props.parameters.map((parameter) => parameter.key)), [props.parameters]);

  const insertParameter = (key: string, added: ClauseParameterDefinition | null) => {
    if (!editor) return;
    bridge.pendingAdd.current = added;
    editor.chain().focus().insertContent({ type: CLAUSE_PARAM_NODE, attrs: { key } }).run();
  };
  const create = (definition: ClauseParameterDefinition) => {
    setRequest(null);
    insertParameter(definition.key, definition);
  };

  return (
    <ClauseParamLabelsContext.Provider value={chipViews}>
      <section className="space-y-2">
        <ClauseBodyToolbar
          editor={editor}
          parameters={props.parameters}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          onInsert={(key) => insertParameter(key, null)}
          onNewParameter={(selection) => setRequest({ selection })}
        />
        <EditorContent editor={editor} />
      </section>
      {request && <NewParameterDialog request={request} takenKeys={takenKeys} onCreate={create} onClose={() => setRequest(null)} />}
    </ClauseParamLabelsContext.Provider>
  );
}
