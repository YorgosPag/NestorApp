/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α37.9 του ADR-866 Φ1.2** — ο διαχειριστής αρχείων αποδίδεται **έξω** από το `(app)`.
 * @related ADR-866 §2.9.3 Κ2 · EntityFilesManager.tsx · EntityFilesToolbar.tsx · contexts/WorkspaceContext.tsx
 *
 * 🔴 **Η ΒΛΑΒΗ ΠΟΥ ΦΡΟΥΡΕΙ**: το `EntityFilesManager` καλούσε `useWorkspace()` στο σώμα του — και το hook **πετά** έξω
 * από `WorkspaceProvider`, που ζει **μόνο** στο `(app)/layout.tsx`. Η πρώτη σελίδα αρχείων του προσωπικού χώρου `(me)`
 * (ο φάκελος ακινήτου) θα έπεφτε ολόκληρη στο πρώτο render. Το όνομα χώρου είναι πλέον ΜΟΝΟ της γραμμής εργαλείων, και
 * ζητείται **μόνο** για εταιρική θεματοφυλακή (`showWorkspace`).
 *
 * Το mock του `useWorkspace` **πετά** ακριβώς όπως το αληθινό έξω από τον πάροχο — ώστε κάθε κλήση σε λάθος στιγμή να
 * ρίξει το render, όπως θα γινόταν στην παραγωγή.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `useWorkspace()` ξανά στο σώμα του `EntityFilesManager` | «ο διαχειριστής δεν ρωτά τον χώρο» ⇒ 🔴 |
 * | η ετικέτα χώρου αποδίδεται άνευ όρων | «προσωπική ⇒ καμία κλήση» ⇒ 🔴 (το render πετά) |
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';

const workspaceCalls = jest.fn<void, []>();
let insideProvider = false;

jest.mock('@/contexts/WorkspaceContext', () => ({
  useWorkspace: () => {
    workspaceCalls();
    if (!insideProvider) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return { activeWorkspace: { displayName: 'Γραφείο Άλφα' } };
  },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('../AddCaptureMenu', () => ({ AddCaptureMenu: () => null }));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const { EntityFilesToolbar } = require('../EntityFilesToolbar') as typeof import('../EntityFilesToolbar');

function toolbar(showWorkspace: boolean) {
  return (
    <EntityFilesToolbar
      activeTab="files"
      onTabChange={() => undefined}
      viewMode="list"
      onViewModeChange={() => undefined}
      treeViewMode="business"
      onTreeViewModeChange={() => undefined}
      displayStyle="standard"
      category="photos"
      onOpenUploadZone={() => undefined}
      onCapture={async () => undefined}
      uploading={false}
      loading={false}
      onRefresh={() => undefined}
      fullscreen={{ isFullscreen: false, toggle: () => undefined }}
      fileCount={0}
      showWorkspace={showWorkspace}
    />
  );
}

beforeEach(() => {
  workspaceCalls.mockReset();
  insideProvider = false;
});

describe('🏆 Α37.9 — ο χώρος ρωτιέται ΜΟΝΟ για εταιρική θεματοφυλακή', () => {
  it('προσωπική (`showWorkspace=false`), χωρίς πάροχο ⇒ αποδίδεται, ΚΑΜΙΑ κλήση `useWorkspace`', () => {
    expect(() => render(toolbar(false))).not.toThrow();
    expect(workspaceCalls).not.toHaveBeenCalled();
  });

  it('εταιρική, μέσα στον πάροχο ⇒ «Ανήκει σε: <χώρος>» όπως πριν', () => {
    insideProvider = true;

    render(toolbar(true));

    expect(screen.getByText('Γραφείο Άλφα')).toBeTruthy();
  });

  it('ο διαχειριστής αρχείων ΔΕΝ ρωτά τον χώρο στο σώμα του (αλλιώς πέφτει σε κάθε κόσμο πλην του `(app)`)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'EntityFilesManager.tsx'), 'utf8');

    expect(source).not.toMatch(/\buseWorkspace\s*\(/);
    expect(source).not.toMatch(/from '@\/contexts\/WorkspaceContext'/);
  });
});

/**
 * Α39.4 — ADR-866 §2.10.8 Β5 · Π4: το δέσιμο του διαχειριστή — δύο γραμμές που η ζωντανή επαλήθευση βρήκε λάθος.
 *
 * | Μετάλλαξη (`EntityFilesManager.tsx`) | Αποτέλεσμα |
 * |---|---|
 * | `onOpenUploadZone={() => setShowUploadZone(!showUploadZone)}` (Π4) | «ανοίγει, ποτέ εναλλαγή» ⇒ 🔴 |
 * | `realtime: displayStyle === 'floorplan-gallery'` (Β5) | «ο κανόνας παράδοσης είναι ο ΕΝΑΣ» ⇒ 🔴 |
 */
describe('Α39.4 — EntityFilesManager: η εντολή ανοίγει · η παράδοση έρχεται από τον ΕΝΑ κανόνα', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'EntityFilesManager.tsx'), 'utf8');

  it('«Ανέβασμα αρχείου» ΑΝΟΙΓΕΙ τη ζώνη — δεύτερο πάτημα δεν την κλείνει σιωπηλά (Π4)', () => {
    expect(source).toMatch(/onOpenUploadZone=\{\(\) => setShowUploadZone\(true\)\}/);
    expect(source).not.toMatch(/setShowUploadZone\(\s*!/);
  });

  it('ζωντανή ή όχι λίστα ⇒ `fileListIsLive(displayStyle, scopePolicy?.readScopes)` — κανένα χειρόγραφο κριτήριο (Β5)', () => {
    expect(source).toMatch(/realtime: fileListIsLive\(displayStyle, scopePolicy\?\.readScopes\)/);
    expect(source).not.toMatch(/realtime: displayStyle ===/);
  });
});
