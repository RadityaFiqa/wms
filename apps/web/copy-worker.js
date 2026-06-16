const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = path.join(__dirname, 'public', 'pdf.worker.min.mjs');

try {
  // Ensure public directory exists
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Successfully copied pdf.worker.min.mjs to public/');
  } else {
    // Try root node_modules or peer directories if not found in local node_modules
    const rootSrc = path.join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
    if (fs.existsSync(rootSrc)) {
      fs.copyFileSync(rootSrc, dest);
      console.log('Successfully copied pdf.worker.min.mjs from root node_modules to public/');
    } else {
      console.error('pdf.worker.min.mjs not found in local or root node_modules');
    }
  }
} catch (err) {
  console.error('Error copying worker:', err);
}
