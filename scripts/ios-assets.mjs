import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Keep iOS version tied to package.json, without changing other platform versions.
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const project = new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url);
await writeFile(project, (await readFile(project, 'utf8')).replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));
await sharp(await readFile(new URL('../public/app-icon.svg', import.meta.url)), { density: 384 })
  .resize(1024, 1024).flatten({ background: '#246B60' }).png()
  .toFile(fileURLToPath(new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url)));
