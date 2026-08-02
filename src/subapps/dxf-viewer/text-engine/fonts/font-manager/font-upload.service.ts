/**
 * FontUploadService — company font upload/delete/list pipeline (ADR-344 Phase 2, Q18).
 *
 * Stores font files in Firebase Storage at fonts/{companyId}/{filename}.
 * Registers font metadata in Firestore COMPANY_FONTS collection using
 * enterprise IDs (fnt_*) per CLAUDE.md N.6.
 *
 * @module text-engine/fonts/font-manager/font-upload.service
 */

import { db, storage } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  deleteObject,
  getDownloadURL,
} from 'firebase/storage';
import { generateCompanyFontId } from '@/services/enterprise-id.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FONT_EXTENSION_FORMATS, fontFormatOfFileName, type FontFormat } from '../font-file-kind';

// ─── Types ────────────────────────────────────────────────────────────────────

// ADR-739 Φ.Ε/Φ2 βήμα 4 — ο τύπος και ο κατάλογος επεκτάσεων προάχθηκαν σε **φύλλο** χωρίς
// Firebase (`font-file-kind.ts`), ώστε να τα διαβάζει και η εξαγωγή DXF («SHX ή TrueType;»)
// χωρίς να σύρει το Firestore SDK. Εδώ μένει μόνο η ανακοίνωση του τύπου προς τα έξω.
export type { FontFormat };

export interface CompanyFontRecord {
  id: string;
  companyId: string;
  name: string;
  fileName: string;
  format: FontFormat;
  uploadedBy: string;
  uploadedAt: number;
  size: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function detectFormat(fileName: string): FontFormat {
  const fmt = fontFormatOfFileName(fileName);
  if (!fmt) {
    throw new Error(
      `FontUploadService: unsupported format "${fileName}" `
      + `(allowed: ${Object.keys(FONT_EXTENSION_FORMATS).join(', ')})`,
    );
  }
  return fmt;
}

function storagePath(companyId: string, fileName: string): string {
  return `fonts/${companyId}/${fileName}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a font file to Firebase Storage and register it in Firestore.
 * Throws if the file extension is not one of ttf/otf/woff/woff2/shx.
 */
export async function uploadCompanyFont(
  companyId: string,
  file: File,
  uploadedBy: string,
): Promise<CompanyFontRecord> {
  const format = detectFormat(file.name);
  const fontId = generateCompanyFontId();
  const path = storagePath(companyId, file.name);
  const storageRef = ref(storage, path);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed', undefined, reject, resolve);
  });

  const record: CompanyFontRecord = {
    id: fontId,
    companyId,
    name: file.name.replace(/\.[^.]+$/, ''), // strip extension for display name
    fileName: file.name,
    format,
    uploadedBy,
    uploadedAt: Date.now(),
    size: file.size,
  };

  await setDoc(
    doc(db, COLLECTIONS.COMPANY_FONTS, fontId),
    record,
  );

  return record;
}

/** Delete font from Storage + remove Firestore metadata document. */
export async function deleteCompanyFont(
  companyId: string,
  fontId: string,
  fileName: string,
): Promise<void> {
  const storageRef = ref(storage, storagePath(companyId, fileName));
  await deleteObject(storageRef);
  await deleteDoc(doc(db, COLLECTIONS.COMPANY_FONTS, fontId));
}

/** List all registered fonts for a company (metadata only, no binary data). */
export async function listCompanyFonts(
  companyId: string,
): Promise<CompanyFontRecord[]> {
  const q = query(
    collection(db, COLLECTIONS.COMPANY_FONTS),
    where('companyId', '==', companyId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CompanyFontRecord);
}

/** Get signed download URL for a company font (for passing to FontLoader). */
export async function getCompanyFontUrl(
  companyId: string,
  fileName: string,
): Promise<string> {
  const storageRef = ref(storage, storagePath(companyId, fileName));
  return getDownloadURL(storageRef);
}
