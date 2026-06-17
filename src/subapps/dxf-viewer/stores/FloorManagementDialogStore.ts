// Floor Management Dialog visibility store SSoT (ADR-468).
// Ανοίγει την καρτέλα «Όροφοι» (FloorsTabContent) σε modal μέσα στον DXF viewer
// (από το panel «Επίπεδα Έργου» ⚙️ ή δεξί κλικ στη γραμμή σταθμών).
//
// Χρησιμοποιεί τον κοινό `createToggleStore` factory (SSoT, zero boilerplate).

import { createToggleStore } from './createToggleStore';

export const FloorManagementDialogStore = createToggleStore();
