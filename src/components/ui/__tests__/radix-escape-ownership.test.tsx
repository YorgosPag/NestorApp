/**
 * @jest-environment jsdom
 *
 * ΑΓΚΥΡΕΣ — ADR-364 §10.15 (κατηγορία `Κ3`): **τα κοινά Radix wrappers δηλώνουν ιδιοκτησία ESC**.
 *
 * ## Τι κλειδώνει, και γιατί δεν είναι «σβήσιμο θορύβου»
 * Ο έλεγχος ESC (`escape-dev-audit`) κρίνει `shadow-owner` κάθε ESC που καταναλώθηκε χωρίς slot του
 * bus. Τα Radix modals **είναι** νόμιμοι ιδιοκτήτες — το αποθετήριο το δηλώνει **γραπτά** σε δύο
 * σημεία (`DimStyleCreateDialog.tsx:67`, `LayerStateDropdown.tsx:147`, και τα δύο με αναφορά
 * ADR-364) — απλώς δεν είχαν **τρόπο** να το πουν. Ένας έλεγχος που φωνάζει σε **κάθε** διάλογο
 * της εφαρμογής εκπαιδεύει στην αγνόηση, δηλαδή υπονομεύει τον εαυτό του.
 *
 * ## 🔑 Η `Κ0` είναι η ΑΠΟΔΕΙΞΗ ΖΩΗΣ — χωρίς αυτήν η δήλωση θα ήταν φρουρός χωρίς εύρημα
 * Το προηγούμενο handoff **συνήγαγε** ότι «κάθε Radix dialog τυπώνει SHADOW-OWNER» από **ένα**
 * παρατηρημένο περιστατικό. Μια αλλαγή σε **κοινή UI ολόκληρης της εφαρμογής** δεν επιτρέπεται να
 * στηριχτεί σε συναγωγή: η `Κ0` **παράγει** την κατάσταση με τα ίδια εργαλεία που την κρίνουν
 * (ADR-749 §5 — φρουρός χωρίς απόδειξη ζωής).
 */

import React from 'react';
import { render, act } from '@testing-library/react';

import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { Popover, PopoverContent } from '../popover';
import { Sheet, SheetContent, SheetTitle } from '../sheet';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '../alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '../dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';
import {
  __judgeForTests,
  __resetAuditForTests,
  installEscapeAuditSentinel,
  noteLocalEscapeOwner,
} from '@/subapps/dxf-viewer/systems/escape-bus/escape-dev-audit';
import { noteBusDispatch } from '@/subapps/dxf-viewer/systems/escape-bus/escape-dev-audit';

/**
 * Ο bus **πρέπει** να έχει κληθεί, αλλιώς η ετυμηγορία είναι `starved` και δεν μαθαίνουμε τίποτα
 * για την ιδιοκτησία. Εδώ προσομοιώνεται ο bus που τρέχει και **δεν διεκδικεί** — ακριβώς η
 * κατάσταση μέσα στον viewer όταν ανοίγει ένας Radix διάλογος.
 *
 * ⚠️ Η ρίψη γίνεται στο **`document.body`** και **όχι** στο `window`: ένα `window.dispatchEvent`
 * έχει στόχο το ίδιο το `window`, άρα η διαδρομή διάδοσης είναι **μόνο** αυτό — οι ακροατές του
 * `document` (δηλαδή ο Radix) **δεν τρέχουν καθόλου**. Η πρώτη γραφή αυτού του βοηθού το έκανε
 * έτσι και ανέφερε «καμία βλάβη»: το ίδιο σχήμα «0 = κανείς δεν κοίταξε» που κυνηγά ο έλεγχος.
 */
function dispatchEscapeWithIdleBus(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  noteBusDispatch(event, { consumed: false, consumedBy: null }, false);
  return event;
}

beforeEach(() => {
  __resetAuditForTests();
  installEscapeAuditSentinel();
});

afterEach(() => {
  __resetAuditForTests();
});

describe('Κ — ιδιοκτησία ESC των κοινών Radix wrappers', () => {
  test('Κ0: ΑΠΟΔΕΙΞΗ ΖΩΗΣ — αδήλωτος καταναλωτής ESC κρίνεται `shadow-owner`', () => {
    // Κάποιος έξω από τον bus καταναλώνει το ESC και δεν το δηλώνει πουθενά.
    const swallow = (e: Event): void => e.preventDefault();
    document.addEventListener('keydown', swallow);
    const event = dispatchEscapeWithIdleBus();
    document.removeEventListener('keydown', swallow);

    expect(__judgeForTests(event)?.verdict).toBe('shadow-owner');
  });

  test('Κ0β: η ΙΔΙΑ περίπτωση, δηλωμένη ως Κ3, κρίνεται `ok` — η δήλωση είναι η θεραπεία', () => {
    const swallow = (e: Event): void => {
      noteLocalEscapeOwner(e as KeyboardEvent, 'test/declared');
      e.preventDefault();
    };
    document.addEventListener('keydown', swallow);
    const event = dispatchEscapeWithIdleBus();
    document.removeEventListener('keydown', swallow);

    const finding = __judgeForTests(event);
    expect(finding?.verdict).toBe('ok');
    expect(finding?.record.localOwner).toBe('test/declared');
  });

  test('Κ1: ένας ανοιχτός `DialogContent` δηλώνει τοπικό ιδιοκτήτη ESC', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>δοκιμή</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    let event!: KeyboardEvent;
    act(() => { event = dispatchEscapeWithIdleBus(); });

    const finding = __judgeForTests(event);
    expect(finding?.record.localOwner).toBe('ui/dialog-content');
    expect(finding?.verdict).toBe('ok');
  });

  test('Κ2: ένα ανοιχτό `PopoverContent` δηλώνει τοπικό ιδιοκτήτη ESC', () => {
    render(
      <Popover open>
        <PopoverContent>δοκιμή</PopoverContent>
      </Popover>,
    );

    let event!: KeyboardEvent;
    act(() => { event = dispatchEscapeWithIdleBus(); });

    expect(__judgeForTests(event)?.record.localOwner).toBe('ui/popover-content');
  });

  /**
   * ⚠️ Η κλάση **δεν** ήταν δύο αρχεία. Μετρήθηκε 2026-08-10 ότι **επτά** κοινά wrappers
   * παράγουν `shadow-owner`: `dialog` · `popover` · `sheet` · `alert-dialog` · `dropdown-menu` ·
   * `context-menu` · `select` · `tooltip`. Κλείνοντας μόνο τα δύο που ονόμαζε το handoff, η
   * κλάση θα έμενε ανοιχτή και ο έλεγχος θα συνέχιζε να εκπαιδεύει στην αγνόηση.
   */
  test.each([
    ['sheet', 'ui/sheet-content', <Sheet open key="s"><SheetContent><SheetTitle>δ</SheetTitle></SheetContent></Sheet>],
    ['alert-dialog', 'ui/alert-dialog-content', <AlertDialog open key="a"><AlertDialogContent><AlertDialogTitle>δ</AlertDialogTitle></AlertDialogContent></AlertDialog>],
    ['dropdown-menu', 'ui/dropdown-menu-content', <DropdownMenu open key="d"><DropdownMenuContent><DropdownMenuItem>δ</DropdownMenuItem></DropdownMenuContent></DropdownMenu>],
    ['select', 'ui/select-content', <Select open key="e"><SelectTrigger>τ</SelectTrigger><SelectContent><SelectItem value="a">α</SelectItem></SelectContent></Select>],
    ['tooltip', 'ui/tooltip-content', <TooltipProvider key="t"><Tooltip open><TooltipTrigger>τ</TooltipTrigger><TooltipContent>δ</TooltipContent></Tooltip></TooltipProvider>],
  ])('Κ2β: το `%s` δηλώνει `%s` — ΟΛΗ η κλάση, όχι δύο αρχεία', (_label, ownerId, ui) => {
    render(ui as React.ReactElement);

    let event!: KeyboardEvent;
    act(() => { event = dispatchEscapeWithIdleBus(); });

    const finding = __judgeForTests(event);
    expect(finding?.record.localOwner).toBe(ownerId);
    expect(finding?.verdict).toBe('ok');
  });

  test('Κ3: η δήλωση ΣΥΝΘΕΤΕΙ — ο handler του καλούντα εξακολουθεί να τρέχει', () => {
    const callerHandler = jest.fn();
    render(
      <Dialog open>
        <DialogContent onEscapeKeyDown={callerHandler}>
          <DialogTitle>δοκιμή</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    act(() => { dispatchEscapeWithIdleBus(); });

    expect(callerHandler).toHaveBeenCalledTimes(1);
  });

  test('Κ4: ο καλών μπορεί ακόμη να ΑΚΥΡΩΣΕΙ το κλείσιμο — η δήλωση δεν το κλέβει', () => {
    const onOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogTitle>δοκιμή</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    act(() => { dispatchEscapeWithIdleBus(); });

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
