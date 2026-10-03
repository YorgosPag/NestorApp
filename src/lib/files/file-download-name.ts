/**
 * **Το όνομα με το οποίο φτάνει ένα αρχείο στον άνθρωπο**: το ανθρώπινο όνομα, με την κατάληξη **μία** φορά.
 * Το ζητούν η λήψη αρχείου του μισθωτή (`api/files/[fileId]/download`) **και** η λήψη από υπόθεση μεταβίβασης
 * (ADR-901 Φ4). Ένα σημείο, ώστε ο ίδιος φάκελος να μη φτάνει με δύο ονόματα.
 *
 * Καθαρό (leaf): το όνομα έρχεται **από το έγγραφο**, ποτέ από το αίτημα.
 *
 * @module lib/files/file-download-name
 */

export interface FileNameFields {
  readonly displayName?: string;
  readonly originalFilename?: string;
  readonly ext?: string;
}

export function fileDownloadName(data: FileNameFields, fileId: string): string {
  const base = data.displayName ?? data.originalFilename ?? fileId;
  const ext = data.ext;
  if (ext === undefined || ext.length === 0) return base;
  return base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? base : `${base}.${ext}`;
}
