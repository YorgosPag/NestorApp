const fs = require('fs');
const path = require('path');

function deleteRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Deleted: ${dirPath}`);
  }
}

console.log('Clearing Next.js cache...');

// Clear .next directory
deleteRecursive('.next');

// Clear node_modules/.cache if it exists
deleteRecursive('node_modules/.cache');

console.log('Cache cleared successfully!');