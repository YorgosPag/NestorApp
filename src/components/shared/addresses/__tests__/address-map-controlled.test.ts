/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΕΙΝΑΙ ΕΛΕΓΧΟΜΕΝΟΣ** — ADR-332 D27 **Β10 + Β12**.
 * @related components/shared/addresses/useAddressMapGeocoding · useAddressMapGeocoding.helpers
 *
 * 🔴 **Β12 (μετρημένο ζωντανά, 2026-09-10)**: μετά την αποθήκευση τα props του `AddressMap` είχαν
 * `40.66424640925561` (νέα θέση) και η πινέζα `40.66424604959212` (παλιά). Το `dragPositions`
 * γέμιζε με **κάθε** γεωκωδικοποιημένη θέση και ανανεωνόταν «μόνο όσα λείπουν».
 *
 * 🔴 **Β10**: αμέσως μετά την αποθήκευση πινέζας ανθρώπου εμφανιζόταν «Παλιές συντεταγμένες» +
 * «Ανανέωση χάρτη». Το `trim` της οδού από τον διακομιστή μετρούσε ως «αλλαγή πεδίου» σε διεύθυνση
 * **με** σημείο — δηλαδή σε θέση που ο διακομιστής **είχε ήδη κρίνει**. Δεύτερος κριτής.
 *
 * ⚠️ Εκτελείται ο **πραγματικός** hook· mock μόνο στα σύνορα (δίκτυο, WebGL).
 */

import { renderHook, act } from '@testing-library/react';
import type { ProjectAddress } from '@/types/project/addresses';

jest.mock('@/lib/maps/maplibre', () => ({ LngLatBounds: class {} }));
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn(),
  reverseGeocodeDetailed: jest.fn(),
}));

import { geocodeAddress, reverseGeocodeDetailed } from '@/lib/geocoding/geocoding-service';
import { useAddressMapGeocoding } from '../useAddressMapGeocoding';
import { displayedPosition } from '../useAddressMapGeocoding.helpers';

/** Οι δύο τιμές που μετρήθηκαν ζωντανά στο ERGO TEST (Β12). */
const BEFORE = { lat: 40.66424604959212, lng: 22.8975135251753 };
const AFTER = { lat: 40.66424640925561, lng: 22.8975135251753 };
/** Εκεί που άφησε ο άνθρωπος την πινέζα. */
const DROP = { lat: 40.6641899, lng: 22.8974273 };

const address = (over: Partial<ProjectAddress> = {}): ProjectAddress => ({
  id: 'addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
  coordinates: BEFORE,
  ...over,
});

function mount(initial: ProjectAddress[]) {
  return renderHook(
    ({ addresses }: { addresses: ProjectAddress[] }) =>
      useAddressMapGeocoding({
        addresses,
        draggableMarkers: true,
        mapRef: { current: null },
        mapReady: false,
        onAddressDragUpdate: jest.fn(),
      }),
    { initialProps: { addresses: initial } },
  );
}

type Mounted = ReturnType<typeof mount>;

/** Η γεωκωδικοποίηση οθόνης έχει debounce 500 ms. */
async function settle(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
}

async function dropAt(mounted: Mounted, point: { lat: number; lng: number }): Promise<void> {
  jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'not-found' });
  await act(async () => {
    await mounted.result.current.handleDragEnd({ lngLat: { lng: point.lng, lat: point.lat } }, 'addr-16', 0);
  });
}

/** Πού ζωγραφίζει ο `AddressMap` την πινέζα — ο ίδιος κανόνας που τρέχει στην οθόνη. */
function shown(mounted: Mounted, addr: ProjectAddress) {
  const { dragPositions, geocodedAddresses } = mounted.result.current;
  return displayedPosition(addr, dragPositions.get(addr.id), geocodedAddresses.get(addr.id));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(geocodeAddress).mockReset();
  jest.mocked(reverseGeocodeDetailed).mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Β12 — ο χάρτης δείχνει ό,τι λέει ο γονιός', () => {
  it('Γ1 — 🔴 μετά τη γεωκωδικοποίηση ΚΑΜΙΑ υπερίσχυση: το `dragPositions` δεν γεμίζει πια με κάθε θέση', async () => {
    const mounted = mount([address()]);
    await settle();

    expect(mounted.result.current.dragPositions.size).toBe(0);
  });

  it('Γ2 — 🔴 η μετρημένη βλάβη: ο γονιός δίνει ΝΕΟ σημείο (αποθήκευση) ⇒ η πινέζα πάει ΕΚΕΙ', async () => {
    const mounted = mount([address()]);
    await settle();

    const saved = address({ coordinates: AFTER });
    mounted.rerender({ addresses: [saved] });
    // Ούτε στο διάστημα του debounce δεν επιτρέπεται να φανεί το παλιό σημείο.
    expect(shown(mounted, saved)).toEqual(AFTER);
    await settle();
    expect(shown(mounted, saved)).toEqual(AFTER);
  });

  it('Γ3 — σύρσιμο ⇒ υπερίσχυση · ο γονιός υιοθετεί ΑΛΛΟ σημείο ⇒ η υπερίσχυση σβήνει', async () => {
    const mounted = mount([address()]);
    await settle();
    await dropAt(mounted, DROP);
    expect(mounted.result.current.dragPositions.get('addr-16')).toEqual({ lng: DROP.lng, lat: DROP.lat });

    mounted.rerender({ addresses: [address({ coordinates: AFTER })] });

    expect(mounted.result.current.dragPositions.has('addr-16')).toBe(false);
  });

  it('Γ4 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο γονιός ξαναποδίδει με το ΙΔΙΟ σημείο (διάλογος ανοιχτός) ⇒ η πινέζα ΜΕΝΕΙ στην αφή', async () => {
    const mounted = mount([address()]);
    await settle();
    await dropAt(mounted, DROP);

    const relabelled = address({ label: 'Είσοδος' });
    mounted.rerender({ addresses: [relabelled] });

    expect(shown(mounted, relabelled)).toEqual({ lng: DROP.lng, lat: DROP.lat });
  });

  it('Γ5 — ΠΑΡΟΝΟΜΑΣΤΗΣ (επαφές): διεύθυνση ΧΩΡΙΣ σημείο — αλλάζει το κείμενο, η πινέζα μένει στην αφή', async () => {
    jest.mocked(geocodeAddress).mockResolvedValue(null);
    const mounted = mount([address({ coordinates: undefined })]);
    await dropAt(mounted, DROP);

    mounted.rerender({ addresses: [address({ coordinates: undefined, street: 'Θάσου' })] });

    expect(mounted.result.current.dragPositions.get('addr-16')).toEqual({ lng: DROP.lng, lat: DROP.lat });
  });
});

describe('Β10 — ένας κριτής θέσης: ο διακομιστής', () => {
  it('Κ1 — 🔴 ο διακομιστής έκοψε το κενό της οδού ⇒ ΚΑΜΙΑ δεύτερη ερώτηση, ΚΑΜΙΑ «Παλιές συντεταγμένες»', async () => {
    const mounted = mount([address({ street: 'Σαμοθράκης ' })]);
    await settle();

    mounted.rerender({ addresses: [address()] });
    await settle();

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(mounted.result.current.geocodingStatus).toBe('success');
    expect('staleAddressIds' in mounted.result.current).toBe(false);
    expect('forceRegeocodeAll' in mounted.result.current).toBe(false);
  });

  it('Κ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: διεύθυνση ΧΩΡΙΣ σημείο ρωτιέται για την ΟΘΟΝΗ (δεν είναι κρίση θέσης)', async () => {
    jest.mocked(geocodeAddress).mockResolvedValue(null);
    mount([address({ coordinates: undefined })]);
    await settle();

    expect(geocodeAddress).toHaveBeenCalledTimes(1);
  });
});

describe('displayedPosition — η σειρά είναι συμβόλαιο', () => {
  const MACHINE = { lat: 40.1, lng: 22.1 };

  it('χειρονομία > σημείο γονιού > γεωκωδικοποίηση οθόνης', () => {
    expect(displayedPosition(address(), DROP, MACHINE)).toEqual(DROP);
    expect(displayedPosition(address(), undefined, MACHINE)).toEqual(BEFORE);
    expect(displayedPosition(address({ coordinates: undefined }), undefined, MACHINE)).toEqual(MACHINE);
    expect(displayedPosition(address({ coordinates: undefined }), undefined, undefined)).toBeNull();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: το `0` είναι υπαρκτή τιμή — δεν πέφτει στη μηχανή', () => {
    expect(displayedPosition(address({ coordinates: { lat: 0, lng: 0 } }), undefined, MACHINE)).toEqual({ lat: 0, lng: 0 });
  });
});
