'use client';

/**
 * **Οι ενότητες του επεξεργαστή ως καρτέλες** (ADR-928 §5.23) — Ταυτότητα · Μέρη · Γραμμές · Όροι · Σχέδιο πληρωμών ·
 * Ρήτρες, όπως οι καρτέλες ενός commitment στο Procore και η σελίδα σύμβασης του Ironclad. Αντικατέστησε τη λίστα
 * συνδέσμων πάνω από **μία** μακριά φόρμα (Φ3γ-2 απόφαση 9).
 *
 * 🔑 Ο κίνδυνος των καρτελών είναι το **κρυμμένο λάθος**: κάθε καρτέλα δείχνει πόσα ευρήματα έχει, με λέξη και αριθμό
 *    (ADR-771 — όχι μόνο κόκκινη τελεία), και μετρά τα **ορατά** ευρήματα του κριτή (ίδιο `issueCountsBySection`).
 * 🔑 Όλες οι ενότητες μένουν **προσαρτημένες** (`forceMount`, κρυφές όταν δεν είναι ενεργές): ανοιχτές «Λεπτομέρειες»
 *    γραμμής, εστίαση και κύλιση δεν χάνονται με την αλλαγή καρτέλας — όπως οι καρτέλες του Figma.
 * 🔑 Βέλη / Home / End από το WAI-ARIA tabs της Radix· η λωρίδα κολλά στην κορυφή της στήλης της φόρμας.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { issueCountsBySection, type EditorSection, type EditorSectionMap } from './editor-sections';
import type { EditorSectionState } from './useEditorSection';

interface EditorSectionTabsProps {
  readonly map: EditorSectionMap;
  readonly issues: readonly SubcontractIssue[];
  readonly state: EditorSectionState;
  /** Το περιεχόμενο κάθε ενότητας του `map` (το πρότυπο δεν έχει «Μέρη», άρα όχι ολικό `Record`). */
  readonly panels: Readonly<Partial<Record<EditorSection, ReactNode>>>;
}

/** Η Radix δίνει `string`· γίνεται ενότητα μόνο αν ο επεξεργαστής την έχει — όχι μετατροπή τύπου στα τυφλά. */
function select(map: EditorSectionMap, state: EditorSectionState, value: string) {
  const section = map.sections.find((candidate) => candidate === value);
  if (section) state.select(section);
}

/** Ο πλησιέστερος πρόγονος που κυλά (η στήλη της φόρμας) — `null` όταν κυλά το ίδιο το έγγραφο (κινητό). */
function scrollParentOf(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/** Νέα καρτέλα ⇒ η στήλη ξεκινά από την αρχή της (όχι από το βάθος όπου είχε μείνει η προηγούμενη). */
function useScrollTopOnChange(section: EditorSection) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previous = useRef(section);
  useEffect(() => {
    if (previous.current === section) return;
    previous.current = section;
    const root = rootRef.current;
    const scroller = root ? scrollParentOf(root) : null;
    if (scroller) scroller.scrollTop = 0;
  }, [section]);
  return rootRef;
}

export function EditorSectionTabs({ map, issues, state, panels }: EditorSectionTabsProps) {
  const { t } = useTranslation('procurement');
  const counts = issueCountsBySection(issues, map);
  const rootRef = useScrollTopOnChange(state.section);
  return (
    <Tabs ref={rootRef} value={state.section} onValueChange={(value) => select(map, state, value)} className="space-y-4">
      <TabsList aria-label={t('subcontracts.sections.nav.label')} className="sticky top-0 z-10 -mx-4 rounded-none border-b px-4">
        {map.sections.map((section) => (
          <TabsTrigger key={section} value={section}>
            {t(`subcontracts.sections.nav.${section}`)}
            {counts[section] > 0 && <span className="ml-1 text-destructive">· {t('subcontracts.sections.issueCount', { count: counts[section] })}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {map.sections.map((section) => (
        <TabsContent key={section} value={section} forceMount className="mt-0 data-[state=inactive]:hidden">
          {panels[section]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
