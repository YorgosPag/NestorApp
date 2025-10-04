/**
 * DEBUG SCRIPT: Detect Infinite Loop Source
 * Run this in browser console to find which component is causing infinite re-renders
 */

// Track component render counts
const renderCounts = new Map<string, number>();
let lastLogTime = Date.now();
const LOG_INTERVAL = 1000; // Log every 1 second

// Override console.log to track components
const originalLog = console.log;
console.log = function(...args: any[]) {
  const message = args.join(' ');

  // Track component names from render logs
  const componentMatch = message.match(/🔍|🎯|✅|🔧|📊|🏢|🔥/);
  if (componentMatch) {
    const component = args[0] || 'unknown';
    const count = (renderCounts.get(component) || 0) + 1;
    renderCounts.set(component, count);

    // Log suspects every second
    const now = Date.now();
    if (now - lastLogTime > LOG_INTERVAL) {
      originalLog('\n🚨 SUSPECT COMPONENTS (rendered > 10 times in last second):');
      Array.from(renderCounts.entries())
        .filter(([_, count]) => count > 10)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 10)
        .forEach(([comp, count]) => {
          originalLog(`   ${comp}: ${count} renders`);
        });

      // Reset counts
      renderCounts.clear();
      lastLogTime = now;
    }
  }

  return originalLog.apply(console, args);
};

originalLog('🔍 Infinite Loop Detector Active - Will report suspects every 1 second');
