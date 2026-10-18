'use client';
/**
 * @fileoverview **Λίστα αρχείων + προεπισκόπηση** — δίπλα-δίπλα σε υπολογιστή, πλήρης οθόνη στο κινητό.
 * @related ADR-912 §12.15 · `core/layouts/MobileDetailsSlideIn.tsx` (το φύλλο κινητού, ο ΕΝΑΣ) ·
 *   `components/file-manager/FilePreviewPanel.tsx` (ο θεατής) · `EntityFilesContent.tsx` (ο καταναλωτής)
 * @module components/shared/files/FilesPreviewSplit
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390px)**: η προεπισκόπηση άνοιγε ως δεύτερη στήλη 55% ⇒ η λίστα
 *   έμενε με ~140px («Ε.», «Δι…», μόνο μεγέθη χωρίς ονόματα) και το PDF με ~175px, εννέα εικονίδια χωρίς όνομα αρχείου.
 * 🔑 **Drive / Dropbox / iOS Files**: πάτημα αρχείου στο κινητό ⇒ θεατής **πλήρους οθόνης** με ✕, όνομα και ενέργειες·
 *   το ✕ γυρνά στη λίστα **στο ίδιο σημείο κύλισης** (η λίστα δεν αποπροσαρτάται ποτέ, το φύλλο σκεπάζει).
 * 🔑 **Μετακόμιση, όχι απόκρυψη** ⇒ `useViewportClass`, όπως η κάτω μπάρα: **ΕΝΑΣ** θεατής προσαρτημένος, ποτέ δύο
 *   (δύο κρυμμένοι με CSS θα κατέβαζαν το PDF δύο φορές). `measuring` ⇒ καμία προεπισκόπηση για ένα καρέ.
 * 🔑 **‹ 3 / 48 ›** (ADR-912 §12.16): η σειρά του θεατή διαβάζεται από το **περιτύλιγμα της λίστας** όπως αποδόθηκε —
 *   όποια προβολή κι αν είναι — ποτέ από δεύτερη ταξινόμηση (`useFileSequence`).
 */
import { useState, type ReactNode } from 'react';

import { FilePreviewPanel } from '@/components/file-manager/FilePreviewPanel';
import { useFileSequence } from '@/components/file-manager/hooks/useFileSequence';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { MobileDetailsSlideIn } from '@/core/layouts/MobileDetailsSlideIn';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import type { FileRecord } from '@/types/file-record';

export interface FilesPreviewSplitProps {
  /** Η προβολή των αρχείων (πλέγμα · λίστα · δέντρο). */
  readonly list: ReactNode;
  /** Τα αρχεία που δείχνει η λίστα (μετά την αναζήτηση) — από εδώ ο θεατής βρίσκει τον γείτονα. */
  readonly files: readonly FileRecord[];
  readonly selectedFile: FileRecord | null;
  /** Επιλογή άλλου αρχείου μέσα από τον θεατή (‹ ›, ← →). */
  readonly onSelect: (file: FileRecord) => void;
  readonly onClose: () => void;
  readonly companyId?: string;
  readonly currentUserId?: string;
}

export function FilesPreviewSplit({ list, files, selectedFile, onSelect, onClose, companyId, currentUserId }: FilesPreviewSplitProps) {
  const viewport = useViewportClass();
  const displayNameOf = useFileDisplayName();
  const [listRoot, setListRoot] = useState<HTMLElement | null>(null);
  const sequence = useFileSequence({ root: listRoot, files, current: selectedFile, onSelect });
  const docked = viewport === 'wide' && selectedFile !== null;
  const preview = (titledByHost: boolean) => selectedFile && (
    <FilePreviewPanel
      file={selectedFile}
      onClose={onClose}
      companyId={companyId}
      currentUserId={currentUserId}
      titledByHost={titledByHost}
      sequence={sequence}
    />
  );

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="min-h-[400px] rounded-lg">
        <ResizablePanel defaultSize={docked ? 45 : 100} minSize={30}>
          {/* `contents`: κανένα κουτί στη διάταξη — μόνο η ρίζα από την οποία διαβάζεται η σειρά της λίστας. */}
          <div ref={setListRoot} data-file-sequence-root="" className="contents">
            {list}
          </div>
        </ResizablePanel>
        {docked && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={30}>
              {preview(false)}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <MobileDetailsSlideIn
        isOpen={viewport === 'narrow' && selectedFile !== null}
        onClose={onClose}
        title={selectedFile ? displayNameOf(selectedFile) : ''}
      >
        {/* `data-details-flush`: το φύλλο αφαιρεί το δικό του περιθώριο — ο θεατής φτάνει τις άκρες. */}
        <div data-details-flush="" className="flex min-h-0 flex-1 flex-col">
          {preview(true)}
        </div>
      </MobileDetailsSlideIn>
    </>
  );
}
