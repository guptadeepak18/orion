const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'frontend', 'dist');
const targets = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'public_html')
];

if (fs.existsSync(src)) {
  targets.forEach(target => {
    fs.cpSync(src, target, { recursive: true, force: true });
    console.log(`Synced build to ${target}`);
  });
  const rootIndex = path.join(__dirname, 'index.html');
  const srcIndex = path.join(src, 'index.html');
  if (fs.existsSync(srcIndex)) {
    fs.copyFileSync(srcIndex, rootIndex);
    console.log('Synced index.html to root');
  }
} else {
  console.warn('frontend/dist does not exist yet. Run vite build first.');
}
