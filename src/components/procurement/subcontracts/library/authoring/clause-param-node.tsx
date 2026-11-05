'use client';

/**
 * **Το chip παραμέτρου** μέσα στο σώμα της ρήτρας (ADR-928 §5.22): κόμβος-άτομο TipTap `clauseParam{key}`.
 *
 * 🔑 Άτομο: δεν σπάει με πληκτρολόγηση, σβήνεται ολόκληρο, αντιγράφεται/επικολλάται ως παράμετρος (`data-clause-param`).
 * 🔑 Το chip δείχνει **ετικέτα · τιμή όπως τυπώνεται** (ο ίδιος `renderParameterValue` με το έγγραφο), από το
 *    `ClauseParamLabelsContext` — το έγγραφο ProseMirror κρατά **μόνο** το κλειδί. Αλλαγή ετικέτας/τιμής φαίνεται αμέσως
 *    χωρίς να αγγίξει το κείμενο.
 * 🔑 Κλειδί χωρίς ορισμό ⇒ chip σε κατάσταση σφάλματος (ο κριτής λέει `paramReferenceUnknown`).
 */

import { createContext, useContext } from 'react';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type Editor, type NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { CLAUSE_PARAM_NODE } from '@/subapps/procurement/subcontracts/clauses/clause-body-doc';

export interface ClauseParamChipView {
  readonly label: string;
  readonly value: string;
}

/** Κλειδί → τι δείχνει το chip· `null` = καμία παράμετρος με αυτό το κλειδί. */
export const ClauseParamLabelsContext = createContext<(key: string) => ClauseParamChipView | null>(() => null);

function ClauseParamChip({ node, selected }: NodeViewProps) {
  const key = typeof node.attrs.key === 'string' ? node.attrs.key : '';
  const view = useContext(ClauseParamLabelsContext)(key);
  return (
    <NodeViewWrapper
      as="span"
      data-clause-param={key}
      className={cn(
        'mx-0.5 inline-flex items-baseline gap-1 rounded border px-1.5 py-0 text-sm',
        view ? 'border-primary/40 bg-primary/10' : 'border-destructive bg-destructive/10 text-destructive',
        selected && 'ring-2 ring-ring',
      )}
    >
      <span className="font-medium">{view?.label ?? key}</span>
      {view?.value && <span className="text-muted-foreground">· {view.value}</span>}
    </NodeViewWrapper>
  );
}

export const ClauseParamNode = Node.create({
  name: CLAUSE_PARAM_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      key: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-clause-param') ?? '',
        renderHTML: (attributes: { key: string }) => ({ 'data-clause-param': attributes.key }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-clause-param]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes];
  },

  renderText({ node }) {
    return `{${String(node.attrs.key)}}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ClauseParamChip);
  },
});

/**
 * Η επιλογή του ανθρώπου ως απλό κείμενο — `null` όταν είναι κενή, περνά από παράγραφο σε παράγραφο (η αντικατάσταση θα
 * τις ένωνε), ή περιέχει ήδη παράμετρο.
 */
export function selectedPlainText(editor: Editor): string | null {
  const { from, to, empty, $from, $to } = editor.state.selection;
  if (empty || !$from.sameParent($to)) return null;
  let hasParam = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === CLAUSE_PARAM_NODE) hasParam = true;
  });
  const text = editor.state.doc.textBetween(from, to, ' ').trim();
  return hasParam || text.length === 0 ? null : text;
}
