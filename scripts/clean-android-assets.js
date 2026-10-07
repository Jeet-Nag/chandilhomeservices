import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const androidPublicDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');

export function cleanAndroidAssets() {
  if (!fs.existsSync(androidPublicDir)) {
    console.log('[Clean Assets] Android public directory does not exist, skipping.');
    return;
  }

  let removedCount = 0;

  // 1. Remove admin.html from native Android public directory
  const adminHtmlPath = path.join(androidPublicDir, 'admin.html');
  if (fs.existsSync(adminHtmlPath)) {
    fs.unlinkSync(adminHtmlPath);
    console.log('[Clean Assets] Removed android/app/src/main/assets/public/admin.html');
    removedCount++;
  }

  // 2. Remove any admin chunks and sourcemaps from native assets directory
  const assetsDir = path.join(androidPublicDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const file of files) {
      const isMap = file.endsWith('.map');
      const isAdminChunk = file.startsWith('admin-') || file.startsWith('admin.');
      if (isAdminChunk || isMap) {
        fs.unlinkSync(path.join(assetsDir, file));
        console.log(`[Clean Assets] Removed android asset: ${file}`);
        removedCount++;
      }
    }
  }

  console.log(`[Clean Assets] Total native assets cleaned: ${removedCount}`);
}

cleanAndroidAssets();
