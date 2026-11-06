'use client';

/**
 * **Φόρμα | ζωντανή προεπισκόπηση** — η μία διάταξη των επεξεργαστών της υπεργολαβίας (συμφωνητικό · ρήτρα · πρότυπο,
 * ADR-928 Φ3γ · §5.22 · §5.23), όπως Figma/Procore/Ironclad.
 *
 * 🔑 Οθόνη υπολογιστή ⇒ δύο στήλες με συρόμενη διαχωριστική· κινητό ⇒ καρτέλες «Φόρμα / Προεπισκόπηση» (δύο στήλες σε
 *    390 px δεν διαβάζονται).
 * 🔑 §5.23 — **η φόρμα κρατά τα pixel της, το έγγραφο παίρνει τον υπόλοιπο χώρο** (`preserve-pixel-size`, όπως η πλαϊνή
 *    στήλη του VS Code/Revit): μεγαλώνει το παράθυρο ⇒ μεγαλώνει η σελίδα της προεπισκόπησης (ζουμ «προσαρμογή στο
 *    πλάτος», `paper-fit`· μπάρα ζουμ στο `previewTools`, §5.25). Το πλάτος θυμάται ανά συσκευή — η **κοινή** μηχανική `useCollapsibleColumn` (ADR-724/884),
 *    όχι δεύτερη.
 * 🔑 «Μόνο έγγραφο»: η φόρμα συμπτύσσεται και το έγγραφο γεμίζει όλο το πλάτος — ίδια κατάσταση με το σύρσιμο κάτω από
 *    το ελάχιστο (ένας κάτοχος, το panel). Ξανά «Φόρμα και έγγραφο» ⇒ επιστροφή στο αποθηκευμένο πλάτος.
 * 🔑 Το ύψος **μετριέται** (`useFillViewportHeight`): ό,τι μένει από το παράθυρο κάτω από την κορυφή του split — όχι το
 *    μαντεμένο `100dvh-16rem` που άφηνε τη σελίδα να κυλά **και** τις στήλες να κυλούν.
 * 🔑 Συγχρονισμός: αλλαγή καρτέλας στη φόρμα (`previewRequest`) ⇒ η προεπισκόπηση κυλά στην ίδια ενότητα του εγγράφου
 *    (`data-doc-section`).
 * 🔑 Κάθε στήλη είναι `relative`: το κρυφό εγγενές `<select>` της Radix Select είναι `position:absolute`· χωρίς
 *    τοποθετημένο πρόγονο μέσα στο `<main>` τοποθετείται ως προς το **κέλυφος** (εκτός της κύλισης του `<main>`), το
 *    φουσκώνει (μετρημένα 3095 px σε παράθυρο 1121) και κάθε `scrollIntoView` (μολύβι εγγράφου → κάρτα ρήτρας) κυλά
 *    το κέλυφος 356 px — η κεφαλίδα της σελίδας χάνεται, μένει κενό κάτω (ζωντανός έλεγχος §5.23).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollapsibleColumn } from '@/components/ui/collapsible-column';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { createColumnLayoutStore } from '@/components/ui/resizable-column-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFillViewportHeight } from '@/hooks/useFillViewportHeight';
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { STORAGE_KEYS } from '@/lib/storage';
import { revealSectionWhenPresent } from './preview-section-sync';
import type { PreviewScrollRequest } from './useEditorSection';

/** Όρια της φόρμας σε px — η φόρμα θέλει ~720 px για δύο πεδία ανά σειρά· το έγγραφο παίρνει τα υπόλοιπα. */
export const EDITOR_FORM_COLUMN = { widthMin: 420, widthDefault: 720, widthMax: 1400 } as const;
/** Η προεπισκόπηση δεν στενεύει κάτω από αυτό (px) — υπερισχύει του `widthMax` της φόρμας. */
const PREVIEW_MIN_WIDTH = 360;
const FORM_PANEL_ID = 'subcontract-editor-form';
const PREVIEW_PANEL_ID = 'subcontract-editor-preview';
const FILL = { minPx: 480, bottomGapPx: 0 } as const;

const formColumnStore = createColumnLayoutStore(STORAGE_KEYS.SUBCONTRACT_EDITOR_FORM_COLUMN, EDITOR_FORM_COLUMN);

interface EditorSplitLayoutProps {
  readonly form: ReactNode;
  readonly preview: ReactNode;
  /** Ο τίτλος της στήλης της προεπισκόπησης (π.χ. «Προεπισκόπηση εγγράφου», «Έγγραφο-δείγμα»), ήδη μεταφρασμένος. */
  readonly previewTitle: string;
  /**
   * Εργαλεία της στήλης του εγγράφου (§5.25 — η μπάρα ζουμ), στην κολλημένη κεφαλίδα δίπλα στο «Μόνο έγγραφο»: ορατά σε
   * όποιο σημείο του εγγράφου κι αν βρίσκεσαι, όπως η γραμμή κατάστασης του Word. Στο κινητό, πάνω από το έγγραφο.
   */
  readonly previewTools?: ReactNode;
  /** Αίτημα κύλισης της προεπισκόπησης σε ενότητα (`useEditorSection`). Παραλείπεται χωρίς καρτέλες. */
  readonly previewRequest?: PreviewScrollRequest | null;
}

/**
 * Κάθε νέο αίτημα ⇒ κύλιση στο `data-doc-section` (της πρώτης γλώσσας, σε δίγλωσσο)· αν το έγγραφο δεν έχει αποδοθεί
 * ακόμη, το αίτημα το **περιμένει** (`revealSectionWhenPresent`), δεν χάνεται.
 */
function usePreviewSectionSync(request: PreviewScrollRequest | null | undefined) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!request || !scroller) return;
    return revealSectionWhenPresent(scroller, request.section);
  }, [request]);
  return scrollerRef;
}

interface PreviewHeaderProps {
  readonly title: string;
  readonly tools?: ReactNode;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

function PreviewHeader({ title, tools, collapsed, onToggle }: PreviewHeaderProps) {
  const { t } = useTranslation('procurement');
  const label = t(collapsed ? 'subcontracts.editor.layout.showForm' : 'subcontracts.editor.layout.documentOnly');
  const Icon = collapsed ? Minimize2 : Maximize2;
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-card px-4 py-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <section className="flex items-center gap-2">
        {tools}
        <Button type="button" size="sm" variant="ghost" onClick={onToggle} aria-controls={FORM_PANEL_ID} aria-expanded={!collapsed}>
          <Icon className="mr-2 h-4 w-4" aria-hidden />{label}
        </Button>
      </section>
    </header>
  );
}

function DesktopSplit({ form, preview, previewTitle, previewTools, previewRequest }: EditorSplitLayoutProps) {
  const { t } = useTranslation('procurement');
  const { initial, collapsed, panel, persistence, onResize, toggle } = useCollapsibleColumn(formColumnStore);
  const frameRef = useFillViewportHeight<HTMLElement>(true, FILL);
  const previewRef = usePreviewSectionSync(previewRequest);
  return (
    <section ref={frameRef} aria-label={previewTitle} className="h-[32rem] overflow-hidden rounded-lg border">
      <ResizablePanelGroup orientation="horizontal" onLayoutChanged={persistence.onLayoutChanged}>
        <ResizablePanel id={FORM_PANEL_ID} panelRef={panel} elementRef={persistence.elementRef}
          defaultSize={initial.collapsed ? 0 : initial.width} minSize={EDITOR_FORM_COLUMN.widthMin} maxSize={EDITOR_FORM_COLUMN.widthMax}
          collapsible collapsedSize={0} groupResizeBehavior="preserve-pixel-size" onResize={onResize}
          className="relative min-w-0 overflow-y-auto">
          {form}
        </ResizablePanel>
        <ResizableHandle withHandle aria-label={t('subcontracts.editor.layout.resize')} {...persistence.separatorProps} />
        <ResizablePanel id={PREVIEW_PANEL_ID} minSize={PREVIEW_MIN_WIDTH} elementRef={previewRef} className="relative min-w-0 overflow-y-auto bg-muted/20">
          <PreviewHeader title={previewTitle} tools={previewTools} collapsed={collapsed} onToggle={toggle} />
          <section className="p-4">{preview}</section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}

function MobileTabs({ form, preview, previewTools }: EditorSplitLayoutProps) {
  const { t } = useTranslation('procurement');
  return (
    <Tabs defaultValue="form" className="relative">
      <TabsList>
        <TabsTrigger value="form">{t('subcontracts.editor.tabs.form')}</TabsTrigger>
        <TabsTrigger value="preview">{t('subcontracts.editor.tabs.preview')}</TabsTrigger>
      </TabsList>
      <TabsContent value="form">{form}</TabsContent>
      <TabsContent value="preview" className="space-y-2">
        {previewTools && <header className="flex justify-end">{previewTools}</header>}
        {preview}
      </TabsContent>
    </Tabs>
  );
}

export function EditorSplitLayout(props: EditorSplitLayoutProps) {
  return useIsMobile() ? <MobileTabs {...props} /> : <DesktopSplit {...props} />;
}
