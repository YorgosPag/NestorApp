/**
 * @fileoverview **ΤΟ ΡΟΛΟΙ ΕΝΟΣ ΜΕΣΟΥ** — δευτερόλεπτα → `m:ss` (ή `h:mm:ss`), γραμμένο **μία** φορά.
 * @related components/shared/files/media/useVideoPlayerState · components/listing-detail/media/ListingVideoStage · ADR-907 §10.6
 * @module lib/media/media-clock
 *
 * 🔑 **Καθαρό φύλλο, χωρίς εισαγωγές — και αυτός είναι ο λόγος που ζει εδώ**: ως το ADR-907 §10.6 η συνάρτηση ζούσε
 * μέσα στο `useVideoPlayerState` (hook με `useTranslation`). Η δημόσια αγγελία τη χρειάζεται για τη διάρκεια του
 * βίντεο· εισαγωγή από το hook θα έβαζε το hook — και το namespace του — στην κλειστότητα της δημόσιας διαδρομής.
 *
 * ⚠️ **ΔΕΝ είναι το `formatTime` του `dxf-viewer/bim-3d/animation/timeline-time-format`**: εκείνο γράφει `mm:ss.mmm`
 * (timecode μοντάζ)· αυτό γράφει ό,τι δείχνει ένας player στον θεατή.
 */

/** `1:45` · `1:02:03`. Μη πεπερασμένη ή αρνητική είσοδος ⇒ `0:00`. */
export function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
