'use client';
/**
 * @fileoverview **Άλλαξε εικόνα χωρίς να αναβοσβήσει** — η παλιά μένει ώσπου η νέα να είναι έτοιμη για βάψιμο.
 * @related ADR-884 Φ2στ-γ Γ2 (η κάτοψη ζητά μεγαλύτερο παράγωγο όταν μεγεθύνεις ή πλαταίνεις τη στήλη)
 * @module hooks/media/useDecodedImageUrl
 *
 * 🏆 **Όπως οι χάρτες** (Google Maps · Mapbox): το πλακίδιο χαμηλής ανάλυσης μένει στη θέση του μέχρι να αποκωδικοποιηθεί το
 *   καλύτερο — ποτέ κενό ανάμεσα. Ένα ωμό άλλαγμα του `href` σε `<image>`/`<img>` σβήνει την παλιά εικόνα αμέσως και
 *   δείχνει **τίποτα** για όσο κατεβαίνει η νέα.
 * 🔑 Χωρίς `HTMLImageElement.decode` (jsdom · πολύ παλιός browser) ή σε σφάλμα ⇒ η νέα διεύθυνση περνά **αμέσως**: η
 *   εφεδρεία είναι η παλιά συμπεριφορά, ποτέ «κολλημένη» εικόνα.
 */
import { useEffect, useState } from 'react';

/** Η διεύθυνση που **δείχνεται** — ακολουθεί το `url` μόλις η νέα εικόνα αποκωδικοποιηθεί. */
export function useDecodedImageUrl(url: string | null): string | null {
  const [shown, setShown] = useState(url);

  useEffect(() => {
    if (url === null || typeof Image === 'undefined') {
      setShown(url);
      return;
    }
    let live = true;
    const image = new Image();
    image.src = url;
    const settle = () => { if (live) setShown(url); };
    if (typeof image.decode === 'function') image.decode().then(settle, settle);
    else settle();
    return () => { live = false; };
  }, [url]);

  return shown;
}
