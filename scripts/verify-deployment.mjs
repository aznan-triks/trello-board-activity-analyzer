// Wait for GitHub Pages propagation and reject stale or incomplete publications.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const base = new URL(process.env.BASE_URL);
const paths = ['index.html', 'vendor/chart.umd.js'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = await Promise.all(paths.map(async path => digest(await readFile(path))));
for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    for (const [index, path] of paths.entries()) {
      const url = new URL(path, base);
      url.searchParams.set('verify', process.env.GITHUB_SHA || String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      const actual = digest(Buffer.from(await response.arrayBuffer()));
      if (actual !== expected[index]) throw new Error(`${path}: published file does not match this commit`);
      console.log(`${path}: HTTP 200, SHA-256 ${actual}`);
    }
    console.log(`Deployment verified: ${base}`);
    process.exit(0);
  } catch (error) {
    console.warn(`Verification ${attempt}/18: ${error.message}`);
    if (attempt === 18) throw error;
    await setTimeout(10000);
  }
}
