/**
 * ADR-923 §5.5 — ο αναγνώστης κειμένου με διαχωριστή ζει στον γενικό πυρήνα πινακοειδούς εισαγωγής, κοινός με τον
 * κατάλογο. Ίδιο σώμα, ίδια σημασία για την τοπογραφία. Άλλαξε το αρχείο του πυρήνα, όχι αυτό.
 */
export {
  detectDelimiter,
  readDelimitedText,
  splitDelimitedLine,
  type ReadDelimitedOptions,
} from '@/lib/tabular-import/delimited-reader';
