// 🔍 DOM INSPECTOR για διάγνωση UI elements

/**
 * Ελέγχει όλα τα διαθέσιμα UI elements στο DOM
 */
export function inspectDOMElements(): {
  floatingPanels: Array<{ selector: string; found: boolean; element?: HTMLElement }>;
  tabs: Array<{ text: string; element: HTMLElement; className: string }>;
  cards: Array<{ text: string; element: HTMLElement; className: string }>;
  canvases: Array<{ type: string; element: HTMLCanvasElement; rect: DOMRect }>;
  overlayContainers: Array<{ selector: string; found: boolean; element?: HTMLElement }>;
} {
  console.log('🔍 DOM INSPECTOR STARTING...');

  // 1. Ελέγχουμε floating panels με όλους τους πιθανούς selectors
  const floatingPanelSelectors = [
    '[data-testid="floating-panel"]',
    '[class*="floating-panel"]',
    '[class*="FloatingPanel"]',
    '.fixed.right-4.top-4',
    '[class*="panel-container"]',
    '.panel',
    '.floating',
    '[class*="floating"]',
    '.right-4',
    '.fixed'
  ];

  const floatingPanels = floatingPanelSelectors.map(selector => {
    const el = document.querySelector(selector) as HTMLElement;
    return {
      selector,
      found: !!el,
      element: el || undefined
    };
  });

  // 2. Ελέγχουμε όλα τα tabs/buttons που μπορεί να είναι καρτέλες
  const allTabs = Array.from(document.querySelectorAll('button, [role="tab"], .tab, [class*="tab"]'))
    .map(el => ({
      text: el.textContent?.trim() || '',
      element: el as HTMLElement,
      className: el.className
    }))
    .filter(item => item.text.length > 0);

  // 3. Ελέγχουμε όλες τις κάρτες
  const allCards = Array.from(document.querySelectorAll('.card, [class*="card"], button, [class*="level"]'))
    .map(el => ({
      text: el.textContent?.trim() || '',
      element: el as HTMLElement,
      className: el.className
    }))
    .filter(item => item.text.length > 0);

  // 4. Ελέγχουμε τα canvas elements
  const allCanvases = Array.from(document.querySelectorAll('canvas'))
    .map(el => ({
      type: el.getAttribute('data-canvas-type') || 'unknown',
      element: el,
      rect: el.getBoundingClientRect()
    }));

  // 5. Ελέγχουμε overlay containers
  const overlaySelectors = [
    '[data-testid="overlays-container"]',
    '[class*="overlay"]',
    '.overlays',
    '[class*="OverlayList"]',
    '[class*="overlay-container"]'
  ];

  const overlayContainers = overlaySelectors.map(selector => {
    const el = document.querySelector(selector) as HTMLElement;
    return {
      selector,
      found: !!el,
      element: el || undefined
    };
  });

  const result = {
    floatingPanels,
    tabs: allTabs,
    cards: allCards,
    canvases: allCanvases,
    overlayContainers
  };

  console.log('🔍 DOM INSPECTION RESULTS:', result);
  return result;
}

/**
 * Βρίσκει το floating panel με εναλλακτικές μεθόδους
 */
export function findFloatingPanelAdvanced(): HTMLElement | null {
  console.log('🔍 ADVANCED FLOATING PANEL SEARCH...');

  // Μέθοδος 1: Με CSS selectors
  const basicSelectors = [
    '[data-testid="floating-panel"]',
    '[class*="floating-panel"]',
    '[class*="FloatingPanel"]',
    '.fixed.right-4.top-4'
  ];

  for (const selector of basicSelectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      console.log('✅ Found floating panel with selector:', selector);
      return el;
    }
  }

  // Μέθοδος 2: Εύρεση με position και size characteristics
  const allDivs = Array.from(document.querySelectorAll('div'));
  const candidates = allDivs.filter(div => {
    const style = window.getComputedStyle(div);
    const rect = div.getBoundingClientRect();

    // Ψάχνουμε για div που είναι:
    // - Fixed position
    // - Στα δεξιά (right > 50% του viewport)
    // - Έχει reasonable width/height
    return style.position === 'fixed' &&
           rect.right > window.innerWidth * 0.5 &&
           rect.width > 200 &&
           rect.height > 100;
  });

  if (candidates.length > 0) {
    console.log('✅ Found floating panel candidate by position:', candidates[0]);
    return candidates[0] as HTMLElement;
  }

  // Μέθοδος 3: Εύρεση με περιεχόμενο
  const elementsWithTabs = allDivs.filter(div => {
    const hasTabsInside = div.querySelector('button, [role="tab"], .tab');
    return !!hasTabsInside;
  });

  if (elementsWithTabs.length > 0) {
    console.log('✅ Found floating panel by content (has tabs):', elementsWithTabs[0]);
    return elementsWithTabs[0] as HTMLElement;
  }

  console.log('❌ No floating panel found with any method');
  return null;
}

/**
 * Εμφανίζει λεπτομερή στοιχεία για debugging
 */
export function showDetailedDOMInfo(): void {
  console.log('🔍 DETAILED DOM ANALYSIS');

  // Εμφάνιση όλων των fixed elements
  const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return style.position === 'fixed';
  });

  console.log('📌 Fixed position elements:', fixedElements.map(el => ({
    tagName: el.tagName,
    className: el.className,
    rect: el.getBoundingClientRect(),
    textContent: el.textContent?.substring(0, 50)
  })));

  // Εμφάνιση elements με right positioning
  const rightElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.right > window.innerWidth * 0.7; // Στα δεξιά 70%
  });

  console.log('➡️ Right-side elements:', rightElements.slice(0, 10).map(el => ({
    tagName: el.tagName,
    className: el.className,
    rect: el.getBoundingClientRect()
  })));

  // Εμφάνιση elements που περιέχουν "επίπεδα" ή "levels"
  const levelElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const text = el.textContent?.toLowerCase() || '';
    return text.includes('επίπεδα') || text.includes('levels') || text.includes('level');
  });

  console.log('📊 Level-related elements:', levelElements.map(el => ({
    tagName: el.tagName,
    className: el.className,
    textContent: el.textContent?.trim()
  })));
}

// Export στο window για εύκολη πρόσβαση
(window as any).inspectDOMElements = inspectDOMElements;
(window as any).findFloatingPanelAdvanced = findFloatingPanelAdvanced;
(window as any).showDetailedDOMInfo = showDetailedDOMInfo;

export default { inspectDOMElements, findFloatingPanelAdvanced, showDetailedDOMInfo };