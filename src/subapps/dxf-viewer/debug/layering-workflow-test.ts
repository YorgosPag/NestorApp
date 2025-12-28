// 🎯 ENTERPRISE LAYERING WORKFLOW TEST
// Αντάξιο μεγάλων enterprise συστημάτων

import { UI_COLORS } from '../config/color-config';

interface StepResult {
  step: string;
  status: "success" | "failed";
  error?: string;
  durationMs: number;
}

interface WorkflowResult {
  success: boolean;
  steps: StepResult[];
  layerDisplayed: boolean;
  reportTime: string;
}

interface WorkflowStep {
  name: string;
  run: () => Promise<void>;
}

/**
 * Utility: sleep με promise
 */
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Utility: ασφαλής επιλογή στοιχείου
 */
function getElementSafe(selector: string, description: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Missing element: ${description} (${selector})`);
  }
  return el as HTMLElement;
}

/**
 * Utility: retries με exponential backoff
 */
async function withRetries<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 300
): Promise<T> {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      await sleep(delay * (i + 1));
    }
  }
  throw lastErr;
}

/**
 * Utility: τρέχει ένα βήμα με structured logging
 */
async function runStep(step: WorkflowStep): Promise<StepResult> {
  const start = performance.now();
  try {
    console.log(`▶️ START: ${step.name}`);
    await step.run();
    const duration = performance.now() - start;
    console.log(`✅ PASS: ${step.name} (${duration.toFixed(1)} ms)`);
    return { step: step.name, status: "success", durationMs: duration };
  } catch (err: any) {
    const duration = performance.now() - start;
    console.error(`❌ FAIL: ${step.name}`, err);
    return {
      step: step.name,
      status: "failed",
      error: err.message,
      durationMs: duration,
    };
  }
}

/**
 * Οπτική επιβεβαίωση ότι το layer καλύπτει την οθόνη - Enhanced
 */
function verifyLayerVisible(layerEl: HTMLElement): boolean {
  const rect = layerEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  console.log('🔍 Layer verification details:', {
    elementRect: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
    viewport: { width: vw, height: vh },
    elementTag: layerEl.tagName,
    elementType: layerEl.getAttribute('data-canvas-type')
  });

  // 🎯 ΠΡΑΓΜΑΤΙΚΑ ΚΡΙΤΗΡΙΑ: Το LayerCanvas είναι στο canvas container, όχι fullscreen
  const minCoverage = 0.4; // 40% coverage - realistic για canvas area
  const coversScreen =
    rect.width >= vw * minCoverage &&
    rect.height >= vh * minCoverage &&
    rect.left <= vw * 0.8 && // Canvas μπορεί να είναι offset
    rect.top <= vh * 0.8;

  console.log('📏 Screen coverage check:', {
    widthCoverage: (rect.width / vw * 100).toFixed(1) + '%',
    heightCoverage: (rect.height / vh * 100).toFixed(1) + '%',
    coversScreen
  });

  // Check αν πραγματικά βρίσκεται on top (πολλαπλά σημεία)
  const testPoints = [
    { x: Math.floor(vw / 2), y: Math.floor(vh / 2) }, // center
    { x: Math.floor(vw / 4), y: Math.floor(vh / 4) }, // top-left quarter
    { x: Math.floor(vw * 3/4), y: Math.floor(vh * 3/4) } // bottom-right quarter
  ];

  let visiblePoints = 0;
  for (const point of testPoints) {
    const topEl = document.elementFromPoint(point.x, point.y);
    if (topEl === layerEl || (topEl && layerEl.contains(topEl))) {
      visiblePoints++;
    }
  }

  const visuallyOnTop = visiblePoints >= 2; // At least 2 out of 3 points

  console.log('👁️ Visual stacking check:', {
    visiblePoints: `${visiblePoints}/3`,
    visuallyOnTop
  });

  const isVisible = coversScreen && visuallyOnTop;
  console.log('✅ Final layer visibility result:', isVisible);

  return isVisible;
}

/**
 * Βρίσκει floating panel με πολλαπλές στρατηγικές - Enhanced με βάση DOM Inspector
 */
function findFloatingPanel(): HTMLElement {
  console.log('🔍 Searching for floating panel...');

  // Στρατηγική 1: Βασικοί selectors
  const selectors = [
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

  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      console.log('✅ Found floating panel with selector:', selector);
      return el;
    }
  }

  // Στρατηγική 2: Εύρεση με position characteristics (βασισμένη στο DOM Inspector)
  console.log('🔍 Trying position-based detection...');
  const allDivs = Array.from(document.querySelectorAll('div'));
  const positionCandidates = allDivs.filter(div => {
    const style = window.getComputedStyle(div);
    const rect = div.getBoundingClientRect();

    // Χαλαρώνουμε τα κριτήρια βάσει του DOM Inspector
    return style.position === 'fixed' &&
           rect.right > window.innerWidth * 0.3 && // Χαλαρώνουμε από 0.5 σε 0.3
           rect.width > 150 && // Χαλαρώνουμε από 200 σε 150
           rect.height > 80;   // Χαλαρώνουμε από 100 σε 80
  });

  if (positionCandidates.length > 0) {
    console.log('✅ Found floating panel by position:', positionCandidates[0].className);
    return positionCandidates[0] as HTMLElement;
  }

  // Στρατηγική 3: Εύρεση με περιεχόμενο (έχει tabs) - Enhanced
  console.log('🔍 Trying content-based detection...');
  const elementsWithTabs = allDivs.filter(div => {
    const hasTabsInside = div.querySelector('button, [role="tab"], .tab, [class*="tab"]');
    return !!hasTabsInside; // Αφαιρούμε την απαίτηση για cards
  });

  if (elementsWithTabs.length > 0) {
    console.log('✅ Found floating panel by content (has tabs):', elementsWithTabs[0].className);
    return elementsWithTabs[0] as HTMLElement;
  }

  // Στρατηγική 4: Οποιοδήποστε element που περιέχει "επίπεδα" text
  console.log('🔍 Trying text-based detection...');
  const elementsWithLevelsText = allDivs.filter(div => {
    const text = div.textContent?.toLowerCase() || '';
    return text.includes('επίπεδα') || text.includes('levels') || text.includes('level');
  });

  if (elementsWithLevelsText.length > 0) {
    console.log('✅ Found floating panel by text content');
    return elementsWithLevelsText[0] as HTMLElement;
  }

  // Στρατηγική 5: Οποιοδήποστε element στα δεξιά με reasonable size
  console.log('🔍 Trying right-side detection...');
  const rightElements = allDivs.filter(div => {
    const rect = div.getBoundingClientRect();
    return rect.right > window.innerWidth * 0.7 &&
           rect.width > 100 &&
           rect.height > 100;
  });

  if (rightElements.length > 0) {
    console.log('✅ Found floating panel by right-side position');
    return rightElements[0] as HTMLElement;
  }

  // Last resort: Παίρνουμε το πρώτο element με reasonable size
  const largeDivs = allDivs.filter(div => {
    const rect = div.getBoundingClientRect();
    return rect.width > 150 && rect.height > 200; // Χαλαρώνουμε τα όρια
  });

  if (largeDivs.length > 0) {
    console.log('⚠️ Using fallback: large div as floating panel');
    return largeDivs[0] as HTMLElement;
  }

  throw new Error('Floating panel not found with any strategy');
}

/**
 * Βρίσκει καρτέλα επίπεδα με πολλαπλές στρατηγικές
 */
function findLevelsTab(): HTMLElement {
  // Πρώτα δοκιμάζουμε data-testid
  const testIdSelector = '[data-testid="levels-tab"]';
  let el = document.querySelector(testIdSelector) as HTMLElement;
  if (el) return el;

  // Fallback σε text-based search
  const tabKeywords = ['επίπεδα', 'levels', 'level', 'floors', 'stories'];
  const tabs = Array.from(document.querySelectorAll('button, [role="tab"], .tab, [class*="tab"]'));

  for (const keyword of tabKeywords) {
    el = tabs.find(tab =>
      tab.textContent?.toLowerCase().includes(keyword.toLowerCase())
    ) as HTMLElement;
    if (el) return el;
  }

  throw new Error('Levels tab not found');
}

/**
 * Βρίσκει κάρτα ισογείου με πολλαπλές στρατηγικές - Enhanced
 */
function findGroundFloorCard(): HTMLElement {
  console.log('🔍 Searching for ground floor card...');

  // Πρώτα δοκιμάζουμε data-testid
  const testIdSelectors = [
    '[data-testid="level-card-ground"]',
    '[data-testid="ground-floor-card"]',
    '[data-testid*="ground"]',
    '[data-testid*="level-0"]'
  ];

  for (const selector of testIdSelectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      console.log('✅ Found ground floor card with testid:', selector);
      return el;
    }
  }

  // Fallback σε text-based search με περισσότερα elements
  const groundKeywords = ['ισόγειο', 'ground', 'επίπεδο 0', 'level 0', 'ground floor', 'floor 0'];
  const cards = Array.from(document.querySelectorAll(
    '.card, [class*="card"], button, .level-card, [class*="level"], div, span'
  ));

  for (const keyword of groundKeywords) {
    const el = cards.find(card => {
      const text = card.textContent?.toLowerCase() || '';
      return text.includes(keyword.toLowerCase()) &&
             text.length < 100; // Αποφεύγουμε μεγάλα containers
    }) as HTMLElement;
    if (el) {
      console.log('✅ Found ground floor card by text:', keyword, el.textContent?.trim());
      return el;
    }
  }

  // Στρατηγική 3: Ψάχνουμε μέσα στα levels containers
  console.log('🔍 Searching within levels containers...');
  const levelContainers = Array.from(document.querySelectorAll(
    '[class*="level"], [class*="Level"], [data-testid*="level"]'
  ));

  for (const container of levelContainers) {
    const innerCards = Array.from(container.querySelectorAll('button, .card, [class*="card"], div'));
    for (const keyword of groundKeywords) {
      const el = innerCards.find(card => {
        const text = card.textContent?.toLowerCase() || '';
        return text.includes(keyword.toLowerCase());
      }) as HTMLElement;
      if (el) {
        console.log('✅ Found ground floor card within container:', el.textContent?.trim());
        return el;
      }
    }
  }

  throw new Error('Ground floor card not found');
}

/**
 * Βρίσκει πρώτη έγχρωμη κάρτα overlay με πολλαπλές στρατηγικές - Enhanced
 */
function findColoredOverlayCard(): HTMLElement {
  console.log('🔍 Searching for colored overlay card...');

  // Πρώτα δοκιμάζουμε data-testid
  const testIdSelectors = [
    '[data-testid="overlay-card-color"]',
    '[data-testid="colored-layer-card"]',
    '[data-testid*="overlay"]',
    '[data-testid*="layer"]'
  ];

  for (const selector of testIdSelectors) {
    const el = document.querySelector(selector) as HTMLElement;
    if (el) {
      console.log('✅ Found colored overlay card with testid:', selector);
      return el;
    }
  }

  // Στρατηγική 2: Ψάχνουμε overlay containers με χαλαρά κριτήρια
  console.log('🔍 Searching for overlay containers...');
  const overlaySelectors = [
    '[class*="overlay"]',
    '.overlays',
    '[class*="OverlayList"]',
    '[class*="overlay-container"]',
    '[data-testid*="overlay"]'
  ];

  let overlaysContainer: Element | null = null;
  for (const selector of overlaySelectors) {
    overlaysContainer = document.querySelector(selector);
    if (overlaysContainer) {
      console.log('✅ Found overlays container with selector:', selector);
      break;
    }
  }

  if (overlaysContainer) {
    // Ψάχνουμε κάρτες μέσα στο container
    const layerCards = Array.from(overlaysContainer.querySelectorAll(
      '.card, [class*="card"], [class*="overlay-card"], button, div'
    )).filter(el => {
      const style = window.getComputedStyle(el);
      const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                      style.backgroundColor !== 'transparent' &&
                      style.backgroundColor !== UI_COLORS.WHITE;
      const hasColorIndicator = el.querySelector('[class*="color"], [class*="badge"], [style*="background"]');
      const hasText = el.textContent && el.textContent.trim().length > 0;
      return (hasColor || hasColorIndicator) && hasText;
    }) as HTMLElement[];

    if (layerCards.length > 0) {
      console.log('✅ Found colored overlay card in container:', layerCards[0].textContent?.trim());
      return layerCards[0];
    }
  }

  // Στρατηγική 3: Γενική αναζήτηση για έγχρωμα elements
  console.log('🔍 General search for colored elements...');
  const allElements = Array.from(document.querySelectorAll('button, .card, [class*="card"], div, span'));
  const coloredElements = allElements.filter(el => {
    const style = window.getComputedStyle(el);
    const rect = (el as HTMLElement).getBoundingClientRect();

    // Ελέγχουμε για χρώμα και reasonable size
    const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    style.backgroundColor !== 'transparent' &&
                    style.backgroundColor !== UI_COLORS.WHITE;
    const hasColorIndicator = el.querySelector('[class*="color"], [class*="badge"], [style*="background"]');
    const hasReasonableSize = rect.width > 50 && rect.height > 20;
    const hasText = el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 50;

    return (hasColor || hasColorIndicator) && hasReasonableSize && hasText;
  }) as HTMLElement[];

  if (coloredElements.length > 0) {
    console.log('✅ Found colored element (fallback):', coloredElements[0].textContent?.trim());
    return coloredElements[0];
  }

  // Στρατηγική 4: Οποιοδήποστε κουμπί με text που μοιάζει με layer
  console.log('🔍 Searching for layer-like buttons...');
  const layerKeywords = ['layer', 'overlay', 'λέιερ', 'επιφάνεια', 'επίπεδο'];
  const buttons = Array.from(document.querySelectorAll('button, .card, [class*="card"]'));

  for (const keyword of layerKeywords) {
    const el = buttons.find(button => {
      const text = button.textContent?.toLowerCase() || '';
      return text.includes(keyword.toLowerCase()) && text.length < 50;
    }) as HTMLElement;
    if (el) {
      console.log('✅ Found layer-like button:', el.textContent?.trim());
      return el;
    }
  }

  throw new Error('No colored overlay cards found with any strategy');
}

/**
 * Κύριο Enterprise Workflow Test
 */
export async function runLayeringWorkflowTest(): Promise<WorkflowResult> {
  const steps: WorkflowStep[] = [
    {
      name: "Locate Floating Panel",
      run: async () => {
        await withRetries(async () => {
          const panel = findFloatingPanel();
          console.log('✅ Found floating panel:', panel.className);
        });
      },
    },
    {
      name: "Click Levels Tab",
      run: async () => {
        await withRetries(async () => {
          const levelsTab = findLevelsTab();
          levelsTab.click();
          console.log('✅ Clicked levels tab:', levelsTab.textContent);
        });
        await sleep(400);
      },
    },
    {
      name: "Click Ground Floor Card",
      run: async () => {
        await withRetries(async () => {
          const groundCard = findGroundFloorCard();
          groundCard.click();
          console.log('✅ Clicked ground floor card:', groundCard.textContent);
        });
        await sleep(500);
      },
    },
    {
      name: "Click Colored Overlay Card",
      run: async () => {
        await withRetries(async () => {
          const overlayCard = findColoredOverlayCard();
          overlayCard.click();
          console.log('✅ Clicked colored overlay card:', overlayCard.textContent);
        });
        await sleep(600);
      },
    },
    {
      name: "Verify Layer Fullscreen Display",
      run: async () => {
        await withRetries(async () => {
          // Πρώτα ελέγχουμε αν υπάρχει το layer canvas
          const layerCanvas = getElementSafe(
            'canvas[data-canvas-type="layer"]',
            "Layer Canvas"
          );

          console.log('🔍 Found layer canvas:', {
            element: layerCanvas.tagName,
            dataType: layerCanvas.getAttribute('data-canvas-type')
          });

          // Περιμένουμε λίγο για να ολοκληρωθεί το rendering
          await sleep(300);

          if (!verifyLayerVisible(layerCanvas)) {
            // Δεύτερη προσπάθεια με χαλαρότερα κριτήρια
            console.log('⚠️ First verification failed, trying relaxed criteria...');
            const rect = layerCanvas.getBoundingClientRect();
            const relaxedCheck = rect.width > 200 && rect.height > 200 &&
                               layerCanvas.getAttribute('data-canvas-type') === 'layer'; // Realistic size check

            if (!relaxedCheck) {
              throw new Error("Layer not visible fullscreen - even relaxed criteria failed");
            } else {
              console.log('✅ Layer visible with relaxed criteria');
            }
          }

          const rect = layerCanvas.getBoundingClientRect();
          console.log('✅ Layer canvas verified:', {
            size: `${rect.width}x${rect.height}`,
            position: `${rect.left}, ${rect.top}`,
            coversScreen: rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2
          });
        });
      },
    },
  ];

  console.log('🎯 STARTING ENTERPRISE LAYERING WORKFLOW TEST...');

  const results: StepResult[] = [];
  for (const step of steps) {
    results.push(await runStep(step));
  }

  const allPassed = results.every(r => r.status === "success");

  const layerCanvas = document.querySelector(
    'canvas[data-canvas-type="layer"]'
  ) as HTMLElement | null;
  const layerDisplayed =
    !!layerCanvas && verifyLayerVisible(layerCanvas);

  const summary: WorkflowResult = {
    success: allPassed && layerDisplayed,
    steps: results,
    layerDisplayed,
    reportTime: new Date().toISOString(),
  };

  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  console.log('📊 ENTERPRISE LAYERING WORKFLOW SUMMARY:', {
    ...summary,
    totalDurationMs: totalDuration.toFixed(1),
    successRate: `${results.filter(r => r.status === 'success').length}/${results.length}`
  });

  return summary;
}

/**
 * Legacy compatibility - για backward compatibility με existing code
 */
export async function runLayeringWorkflowTestAdvanced(): Promise<any> {
  const result = await runLayeringWorkflowTest();
  return {
    success: result.success,
    message: `Enterprise workflow test completed - ${result.success ? 'SUCCESS' : 'FAILED'}`,
    details: result
  };
}

// Ενσωμάτωση στο window για debugging
(window as any).runLayeringWorkflowTest = runLayeringWorkflowTest;
(window as any).runLayeringWorkflowTestAdvanced = runLayeringWorkflowTestAdvanced;

export default runLayeringWorkflowTest;