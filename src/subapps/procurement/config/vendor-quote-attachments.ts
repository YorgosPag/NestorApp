/**
 * Τα όρια συνημμένων της πύλης προμηθευτή (ADR-327 §17 Q25) — ΕΝΑ σημείο για τη φόρμα (client) και το
 * `POST /api/vendor/quote` (server). Ήταν δύο αντίγραφα που μπορούσαν να αποκλίνουν σιωπηλά.
 *
 * @module subapps/procurement/config/vendor-quote-attachments
 */

export const VENDOR_QUOTE_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per Q25
export const VENDOR_QUOTE_MAX_IMAGES = 5;
export const VENDOR_QUOTE_MAX_PDFS = 1;
export const VENDOR_QUOTE_ALLOWED_MIME: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
