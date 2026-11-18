// ISLA CENIZA entry program.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const entryDirectory = fileURLToPath(new URL('.', import.meta.url));
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDirectory, { recursive: true });
cpSync(join(entryDirectory, 'game'), join(outputDirectory, 'game'), {
  recursive: true,
});

const screenshotSource = join(entryDirectory, 'screenshots');
if (existsSync(screenshotSource)) {
  cpSync(screenshotSource, join(outputDirectory, 'screenshots'), {
    recursive: true,
  });
} else {
  mkdirSync(join(outputDirectory, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDirectory, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDirectory, 'dossier.json'), dossier);
