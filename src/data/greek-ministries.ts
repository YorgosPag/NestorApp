/**
 * @fileoverview Greek Ministries & Supervising Bodies
 * @description Official list of Greek ministries (Υπουργεία) for the supervisionMinistry field.
 * @source https://gslegal.gov.gr/kyvernisi/ypourgiko-symvoulio/seira-taksis-ypourgeion/
 * @generated 2026-03-06
 */

export interface Ministry {
  /** Unique ID (e.g. "GR-MIN-01") */
  id: string;
  /** Official name in Greek */
  name: string;
}

export const GREEK_MINISTRIES: Ministry[] = [
  { id: 'GR-MIN-01', name: 'Υπουργείο Εθνικής Οικονομίας και Οικονομικών' },
  { id: 'GR-MIN-02', name: 'Υπουργείο Εξωτερικών' },
  { id: 'GR-MIN-03', name: 'Υπουργείο Εθνικής Άμυνας' },
  { id: 'GR-MIN-04', name: 'Υπουργείο Εσωτερικών' },
  { id: 'GR-MIN-05', name: 'Υπουργείο Παιδείας, Θρησκευμάτων και Αθλητισμού' },
  { id: 'GR-MIN-06', name: 'Υπουργείο Υγείας' },
  { id: 'GR-MIN-07', name: 'Υπουργείο Προστασίας του Πολίτη' },
  { id: 'GR-MIN-08', name: 'Υπουργείο Υποδομών και Μεταφορών' },
  { id: 'GR-MIN-09', name: 'Υπουργείο Περιβάλλοντος και Ενέργειας' },
  { id: 'GR-MIN-10', name: 'Υπουργείο Ανάπτυξης' },
  { id: 'GR-MIN-11', name: 'Υπουργείο Εργασίας και Κοινωνικής Ασφάλισης' },
  { id: 'GR-MIN-12', name: 'Υπουργείο Δικαιοσύνης' },
  { id: 'GR-MIN-13', name: 'Υπουργείο Πολιτισμού' },
  { id: 'GR-MIN-14', name: 'Υπουργείο Μετανάστευσης και Ασύλου' },
  { id: 'GR-MIN-15', name: 'Υπουργείο Κοινωνικής Συνοχής και Οικογένειας' },
  { id: 'GR-MIN-16', name: 'Υπουργείο Αγροτικής Ανάπτυξης και Τροφίμων' },
  { id: 'GR-MIN-17', name: 'Υπουργείο Ναυτιλίας και Νησιωτικής Πολιτικής' },
  { id: 'GR-MIN-18', name: 'Υπουργείο Τουρισμού' },
  { id: 'GR-MIN-19', name: 'Υπουργείο Ψηφιακής Διακυβέρνησης' },
  { id: 'GR-MIN-20', name: 'Υπουργείο Κλιματικής Κρίσης και Πολιτικής Προστασίας' },
  { id: 'GR-ORG-PRESIDENCY-01', name: 'Προεδρία της Κυβέρνησης' },
];
