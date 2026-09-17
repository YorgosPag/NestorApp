/**
 * useEntityFilesSearch — αναζήτηση στη λίστα αρχείων οντότητας (Google Drive/Dropbox/OneDrive pattern).
 *
 * Εξήχθη από το `EntityFilesManager.tsx` (N.7.1 — 499 γρ. πριν δεχτεί κάτοχο «εταιρεία Ή άνθρωπος»,
 * ADR-866 §2.6.8). Συμπεριφορά **αμετάβλητη**: `*.ext` ⇒ φίλτρο επέκτασης, αλλιώς ελληνικά-ανεκτική
 * αναζήτηση σε όνομα, αρχικό όνομα, κατηγορία, τομέα, σκοπό, περιγραφή.
 *
 * @module components/shared/files/hooks/useEntityFilesSearch
 */

import { useMemo } from 'react';

import type { FileRecord } from '@/types/file-record';
import { normalizeForSearch } from '@/utils/greek-text';

export function useEntityFilesSearch<T extends FileRecord>(files: T[], searchTerm: string): T[] {
  return useMemo(() => {
    if (!searchTerm.trim()) return files;

    const raw = searchTerm.trim();
    const extMatch = raw.match(/^\*\.(\w+)$/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      return files.filter(f =>
        (f.originalFilename ?? '').toLowerCase().endsWith(`.${ext}`) ||
        (f.displayName ?? '').toLowerCase().endsWith(`.${ext}`) ||
        f.ext?.toLowerCase() === ext
      );
    }

    const norm = (s?: string | null) => (s ? normalizeForSearch(s) : '');
    const query = norm(raw);

    return files.filter((file) => {
      const searchableFields = [
        file.displayName, file.originalFilename,
        file.category, file.domain, file.purpose, file.description,
      ].filter(Boolean);
      return searchableFields.some((field) => norm(field).includes(query));
    });
  }, [files, searchTerm]);
}
