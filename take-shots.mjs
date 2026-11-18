#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const gameDirectory = join(root, 'game');
const shots = JSON.parse(await readFile(join(root, 'shots.json'), 'utf8'));

function readFile(path, encoding) {
  return import('node:fs/promises').then((fs) => fs.readFile(path, encoding));
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.wasm': 'application/wasm',
};

function startServer(port) {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const filePath = resolve(gameDirectory, relativePath);
      if (filePath !== gameDirectory && !filePath.startsWith(`${gameDirectory}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const stream = createReadStream(filePath);
      stream.on('open', () => {
        response.writeHead(200, {
          'content-type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        });
        stream.pipe(response);
      });
      stream.on('error', () => response.writeHead(404).end('Not found'));
    } catch {
      response.writeHead(400).end();
    }
  });
  return new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, '127.0.0.1', () => resolvePromise(server));
  });
}

function run(command, arguments_) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, arguments_, { stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('error', rejectPromise);
    child.on('exit', (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`${command} exited ${code}`)));
  });
}

async function readBytes(path, length) {
  const chunks = [];
  const stream = createReadStream(path, { start: 0, end: length - 1 });
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function capture(chromium, port, shot, pngPath) {
  await run(chromium, [
    '--headless=new', '--no-sandbox', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--enable-logging=stderr', '--v=0',
    '--virtual-time-budget=20000', '--window-size=1280,800',
    `--user-data-dir=${join(tmpdir(), `isla-ceniza-profile-${process.pid}-${shot.name}`)}`,
    `--screenshot=${pngPath}`, `http://127.0.0.1:${port}/${shot.query}`,
  ]);
}

async function encode(source, target, quality) {
  await unlink(target).catch(() => {});
  await run('/usr/bin/ffmpeg', ['-y', '-i', source, '-q:v', String(quality), target]);
}

async function pngDimensions(path) {
  const header = await readBytes(path, 24);
  if (!header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('invalid PNG');
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

async function produceShot(chromium, port, shot) {
  const temporaryDirectory = join(tmpdir(), `isla-ceniza-shots-${process.pid}`);
  await mkdir(temporaryDirectory, { recursive: true });
  const pngPath = join(temporaryDirectory, `${shot.name}.png`);
  const targetPath = join(root, 'screenshots', shot.name);
  try {
    await capture(chromium, port, shot, pngPath);
    const dimensions = await pngDimensions(pngPath);
    if (dimensions.width !== 1280 || dimensions.height !== 800) {
      throw new Error(`invalid PNG dimensions (${dimensions.width}x${dimensions.height})`);
    }
    let quality = 4;
    const qualities = [4, 6, 8, 10, 12];
    for (const candidateQuality of qualities) {
      quality = candidateQuality;
      await encode(pngPath, targetPath, quality);
      const size = (await stat(targetPath)).size;
      if (size <= 262144) break;
    }
    const bytes = await readBytes(targetPath, 2);
    const size = (await stat(targetPath)).size;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a JPEG');
    if (size < 20000) throw new Error(`suspiciously blank (${size} bytes)`);
    if (size > 262144) throw new Error(`too large after re-encoding (${size} bytes)`);
    return { ...shot, bytes: size, dimensions, status: `ok (ffmpeg -q:v ${quality})` };
  } catch (error) {
    return { ...shot, bytes: 0, dimensions: null, status: `FAILED: ${error.message}` };
  } finally {
    await unlink(pngPath).catch(() => {});
    await readdir(temporaryDirectory).then(async (files) => {
      if (files.length === 0) await unlink(temporaryDirectory).catch(() => {});
    });
  }
}

async function findChromium() {
  const cache = join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  const versions = await readdir(cache);
  const chromiumDirectories = versions.filter((name) => name.startsWith('chromium-')).sort().reverse();
  const candidates = chromiumDirectories.flatMap((name) => [
    join(cache, name, 'chrome-linux64', 'chrome'),
    join(cache, name, 'chrome-linux', 'chrome'),
  ]);
  for (const candidate of candidates) {
    if ((await stat(candidate).catch(() => null))?.isFile()) return candidate;
  }
  throw new Error('Chromium not found under ~/.cache/ms-playwright');
}

const chromium = await findChromium();
const server = await startServer(0);
const port = server.address().port;
const results = [];
try {
  await mkdir(join(root, 'screenshots'), { recursive: true });
  for (const shot of shots) {
    console.error(`Capturing ${shot.name}...`);
    results.push(await produceShot(chromium, port, shot));
  }
} finally {
  server.close();
}

console.table(results.map(({ name, bytes, dimensions, status }) => ({
  name, bytes, dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : '-', status,
})));
process.exitCode = results.every((result) => !result.status.startsWith('FAILED')) ? 0 : 1;
