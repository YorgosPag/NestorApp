/**
 * @fileoverview **Η σκηνή του βίντεο** — τι υπόσχεται στον επισκέπτη πριν και μετά το πάτημα (ADR-907 §10.6).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Σ1: το στοιχείο χάνει το `preload="none"`, αποκτά `autoPlay`, ή δείχνει εγγενή χειριστήρια (με `0:00`) πριν το πάτημα.
 * - Σ2: το κουτί δεν κρατιέται από το σχήμα (`width`/`height`) ⇒ μετατόπιση διάταξης.
 * - Σ3: η διάρκεια δεν λέγεται πριν το πάτημα, ή το `play()` δεν καλείται μέσα στη χειρονομία.
 * - Σ4: τα χειριστήρια δεν εμφανίζονται όταν αρχίσει να παίζει — ή όταν ο περιηγητής αρνηθεί το `play()`.
 * - Σ5: το εξώφυλλο γίνεται ιδιότητα `poster` (μία διεύθυνση) αντί για `<img srcset>`· χωρίς εξώφυλλο το πλαίσιο σιωπά.
 * - Σ6: αρχείο που δεν φόρτωσε αφήνει σιωπηλό κενό, ή η επανάληψη ξαναχρησιμοποιεί το στοιχείο που απέτυχε.
 *
 * Προστέθηκαν μετά το πέρασμα μεταλλάξεων (ADR-907 §10.11) — ό,τι επέζησε τότε:
 * - Σ2β: το ταβάνι `max-h-[70vh]` φεύγει από το πλαίσιο.
 * - Σ3γ: η γραμμή «φορτώνει» χάνει το `aria-live`.
 * - Σ5β: με εξώφυλλο το `src` του `<video>` δείχνει στην εικόνα (`poster?.url ?? url`).
 * - Σ5γ: το εξώφυλλο χάνει `sizes` / `src`, ή φορτώνει πρόθυμα.
 * - Σ6 (συμπλήρωση): η επανάληψη κολλά στο «φορτώνει» αντί να γυρίσει στην πρόσκληση.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { ListingImage, PublishedVideoFile } from '@/types/public-listing';

import { LEAD_SIZES } from '../../ListingGallery';
import { ListingVideoStage } from '../ListingVideoStage';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key}|${JSON.stringify(params)}` : key),
  }),
}));
jest.mock('@/lib/design-system', () => ({}), { virtual: true });

const POSTER: ListingImage = {
  url: 'https://shelf/p-960.webp',
  width: 960,
  height: 540,
  altKey: 'k',
  sources: [
    { url: 'https://shelf/p-480.webp', width: 480 },
    { url: 'https://shelf/p-960.webp', width: 960 },
  ],
} as ListingImage;

function video(overrides: Partial<PublishedVideoFile> = {}): PublishedVideoFile {
  return { url: 'https://shelf/v.mp4', altKey: 'k', width: 1080, height: 1920, durationSec: 105.4, poster: null, ...overrides };
}

const play = jest.fn<Promise<void> | undefined, []>();

beforeEach(() => {
  play.mockReset().mockReturnValue(Promise.resolve());
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
});

function element(container: HTMLElement): HTMLVideoElement {
  const found = container.querySelector('video');
  if (found === null) throw new Error('δεν αποδόθηκε <video>');
  return found;
}

describe('ListingVideoStage', () => {
  it('🔴 Σ1 πριν το πάτημα: κανένα byte, καμία αυτόματη αναπαραγωγή, κανένα εγγενές χειριστήριο', () => {
    const { container } = render(<ListingVideoStage video={video()} alt="ALT" />);
    const node = element(container);

    expect(node.getAttribute('preload')).toBe('none');
    expect(node.hasAttribute('autoplay')).toBe(false);
    expect(node.hasAttribute('controls')).toBe(false);
    expect(node.hasAttribute('playsinline')).toBe(true);
    expect(node.getAttribute('src')).toBe('https://shelf/v.mp4');
    expect(play).not.toHaveBeenCalled();
  });

  it('🔴 Σ2 το κουτί κρατιέται από τις ΜΕΤΡΗΜΕΝΕΣ διαστάσεις του εγγράφου', () => {
    const { container } = render(<ListingVideoStage video={video()} alt="ALT" />);
    const node = element(container);

    expect(node.getAttribute('width')).toBe('1080');
    expect(node.getAttribute('height')).toBe('1920');
    expect(node.getAttribute('aria-label')).toBe('ALT');
    // Σ2β: το ταβάνι ύψους είναι ΔΗΛΩΣΗ κλάσης (το jsdom δεν έχει διάταξη) — χωρίς αυτό ένα κατακόρυφο κλιπ σπρώχνει
    // τίτλο και τιμή έξω από την πρώτη οθόνη. Μετάλλαξη §10.11: η κλάση έφευγε και καμία άγκυρα δεν κοκκίνιζε.
    expect(node.className.split(/\s+/)).toContain('max-h-[70vh]');
  });

  it('🔴 Σ3 η διάρκεια λέγεται πριν το πάτημα · το `play()` καλείται ΜΕΣΑ στη χειρονομία', () => {
    render(<ListingVideoStage video={video()} alt="ALT" />);
    const button = screen.getByRole('button');

    expect(button.getAttribute('aria-label')).toBe('listing-detail:video.playLabel|{"duration":"1:45"}');
    expect(button.textContent).toContain('1:45');
    // Σ3β (browser 320px, 2026-10-09): η ετικέτα του χαπιού δεν σπάει — το jsdom δεν έχει διάταξη, άρα φυλάμε τη δήλωση.
    expect(screen.getByText('listing-detail:video.play').className).toContain('whitespace-nowrap');

    fireEvent.click(button);
    // Συγχρονισμένα: καμία αναμονή ανάμεσα στο κλικ και στον ισχυρισμό.
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button')).toBeNull();
    // Σ3γ: η γραμμή «φορτώνει» ΑΝΑΚΟΙΝΩΝΕΤΑΙ — αλλιώς ο αναγνώστης οθόνης ακούει το κουμπί να χάνεται και μετά σιωπή.
    expect(screen.getByText('listing-detail:video.loading').closest('p')?.getAttribute('aria-live')).toBe('polite');
  });

  it('🔴 Σ4 τα εγγενή χειριστήρια έρχονται όταν παίξει — και όταν ο περιηγητής αρνηθεί το `play()`', async () => {
    const first = render(<ListingVideoStage video={video()} alt="ALT" />);
    fireEvent.click(screen.getByRole('button'));
    expect(element(first.container).hasAttribute('controls')).toBe(false);
    fireEvent.playing(element(first.container));
    expect(element(first.container).hasAttribute('controls')).toBe(true);
    expect(screen.queryByText('listing-detail:video.loading')).toBeNull();
    first.unmount();

    play.mockReturnValue(Promise.reject(new DOMException('refused', 'NotAllowedError')));
    const refused = render(<ListingVideoStage video={video()} alt="ALT" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(element(refused.container).hasAttribute('controls')).toBe(true);
    refused.unmount();

    // Άλλη απόρριψη (π.χ. διακοπή φόρτωσης) ΔΕΝ είναι άρνηση: την αποτυχία τη λέει το γεγονός `error`, όχι η υπόσχεση.
    play.mockReturnValue(Promise.reject(new DOMException('aborted', 'AbortError')));
    const aborted = render(<ListingVideoStage video={video()} alt="ALT" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(element(aborted.container).hasAttribute('controls')).toBe(false);
  });

  it('🔴 Σ4β περιηγητής όπου το `play()` δεν επιστρέφει υπόσχεση δεν ρίχνει τη σκηνή', () => {
    play.mockReturnValue(undefined);
    render(<ListingVideoStage video={video()} alt="ALT" />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('🔴 Σ5 εξώφυλλο = `<img srcset>`, ποτέ ιδιότητα `poster` · χωρίς εξώφυλλο το πλαίσιο ΛΕΕΙ τι είναι', () => {
    const bare = render(<ListingVideoStage video={video()} alt="ALT" />);
    expect(bare.container.querySelector('img')).toBeNull();
    expect(screen.getByText('ALT')).toBeTruthy();
    bare.unmount();

    const { container } = render(<ListingVideoStage video={video({ poster: POSTER })} alt="ALT" />);
    const image = container.querySelector('img');
    expect(image?.getAttribute('srcset')).toBe('https://shelf/p-480.webp 480w, https://shelf/p-960.webp 960w');
    expect(image?.getAttribute('alt')).toBe('');
    expect(element(container).hasAttribute('poster')).toBe(false);
    // Σ5β: ΜΕ εξώφυλλο το `<video>` εξακολουθεί να δείχνει στο ΑΡΧΕΙΟ — `poster?.url ?? url` περνούσε, γιατί η Σ1 ρωτά
    // μόνο χωρίς εξώφυλλο (μετάλλαξη §10.11).
    expect(element(container).getAttribute('src')).toBe('https://shelf/v.mp4');
    // Σ5γ: το `srcset` χωρίς `sizes` διαλέγει παράγωγο σαν η εικόνα να πιάνει όλο το πλάτος της οθόνης· και το εξώφυλλο
    // ζει σε καρτέλα που δεν είναι η πρώτη, άρα δεν κατεβαίνει πριν χρειαστεί.
    expect(image?.getAttribute('src')).toBe('https://shelf/p-960.webp');
    expect(image?.getAttribute('sizes')).toBe(LEAD_SIZES);
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('decoding')).toBe('async');
    // Με εξώφυλλο η πρόταση δεν τυπώνεται δεύτερη φορά πάνω στην εικόνα.
    expect(screen.queryByText('ALT')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    expect(container.querySelector('img')).not.toBeNull();
    fireEvent.playing(element(container));
    expect(container.querySelector('img')).toBeNull();
  });

  it('🔴 Σ6 αποτυχία ⇒ ονομασμένη, με επανάληψη σε ΝΕΟ στοιχείο', () => {
    const { container } = render(<ListingVideoStage video={video()} alt="ALT" />);
    const failedNode = element(container);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.error(failedNode);

    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByText('listing-detail:video.failed')).toBeTruthy();
    // Η σκηνή που έδινε αναλογία δεν υπάρχει πια: το κουτί της αποτυχίας δηλώνει τη δική του, αλλιώς καταρρέει σε μία γραμμή.
    expect(container.querySelector('.aspect-video')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'listing-detail:video.retry' }));
    expect(element(container)).not.toBe(failedNode);
    expect(element(container).hasAttribute('controls')).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
    // Η επανάληψη γυρίζει στην ΠΡΟΣΚΛΗΣΗ, όχι σε «φορτώνει» χωρίς τέλος: τίποτα δεν ζητήθηκε ακόμη από το νέο στοιχείο.
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('listing-detail:video.playLabel|{"duration":"1:45"}');
    expect(screen.queryByText('listing-detail:video.loading')).toBeNull();
  });
});
