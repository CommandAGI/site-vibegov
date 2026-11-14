#!/usr/bin/env node
// Vendors the anonymous voice's prover into this static site (anon.js; CommandAGI docs/coordination-contract.md
// § anonymous voice). The site has no build: this script runs by hand, once per change of the pinned versions or of
// the depths shipped, and its output is committed.
//
// It writes:
//   vendor/semaphore/semaphore.js         one self-contained ES module: { Identity, Group, generateProof }
//   vendor/semaphore/artifacts/semaphore-<depth>.wasm|.zkey   the proving artifacts for tree depths 1..MAX_DEPTH
//
// What it bundles: the versions CommandAGI's contract editor pins (packages/applets/contract/package.json and
// pnpm-lock.yaml), resolved from that package's node_modules. Licences (vendor/semaphore/LICENSES.md has the notices):
//   @semaphore-protocol/identity 4.14.3, group 4.14.3, proof 4.14.3 (generateProof only), utils 4.14.3   MIT
//   @zk-kit/baby-jubjub 1.0.3, eddsa-poseidon 1.0.4, lean-imt 2.2.5, artifacts 2.0.1, utils 1.2.1/1.3.0/1.4.1   MIT
//   poseidon-lite 0.3.0, ethers 6.13.4 (keccak256 and number helpers), @noble/hashes 1.3.2   MIT
//   buffer 6.0.3, base64-js 1.5.1   MIT;   ieee754 1.2.1   BSD-3-Clause
//   snarkjs 0.7.5 (browser build; inlines fastfile 0.0.20, @iden3/binfileutils 0.0.12, r1csfile 0.0.48: GPL-3.0;
//     circom_runtime 0.1.28: Apache-2.0; blake2b-wasm 2.4.0, js-sha3 0.8.0: MIT)   GPL-3.0
//   ffjavascript 0.3.1 (browser build; inlines wasmcurves 0.2.2, wasmbuilder 0.0.16: GPL-3.0)   GPL-3.0
//   @zk-kit/semaphore-artifacts 4.13.0 (the .wasm and .zkey files, copied as they are)   MIT
//
// Reproducible: the same CommandAGI checkout (its lockfile) and esbuild 0.24.2 give the same bytes. The script prints the
// sha256 of every file it writes; LICENSES.md records them, and test/anon.test.mjs holds the files to that record.
//
//   node redesign/vendor-semaphore.mjs [--commandagi /home/brandonin/Documents/commandagi] [--depths 8]
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1]; };
const CAGI = arg('commandagi', '/home/brandonin/Documents/commandagi');
// The deepest tree the site can prove for. Keep in step with MAX_DEPTH in anon.js.
const MAX_DEPTH = Number(arg('depths', '8'));
const SITE = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(SITE, 'vendor/semaphore');
// The editor's own package folder: its node_modules resolve the exact versions the editor proves with.
const EDITOR = join(CAGI, 'packages/applets/contract');

const VERSIONS = { '@semaphore-protocol/identity': '4.14.3', '@semaphore-protocol/group': '4.14.3', '@semaphore-protocol/proof': '4.14.3' };
for (const [name, want] of Object.entries(VERSIONS)) {
  const pkg = JSON.parse(await readFile(join(EDITOR, 'node_modules', name, 'package.json'), 'utf8'));
  if (pkg.version !== want) throw new Error(`${name} is ${pkg.version} in ${EDITOR}; this script vendors ${want}. Update the header and VERSIONS together.`);
}
const esbuild = await import(pathToFileURL(join(CAGI, 'node_modules/esbuild/lib/main.js')).href);
if (esbuild.version !== '0.24.2') throw new Error(`esbuild ${esbuild.version}: this script was made with 0.24.2`);

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const written = [];

// Only what this script writes: LICENSES.md beside it is kept.
await rm(join(OUT, 'semaphore.js'), { force: true });
await rm(join(OUT, 'artifacts'), { recursive: true, force: true });
await mkdir(join(OUT, 'artifacts'), { recursive: true });

const result = await esbuild.build({
  stdin: {
    contents: [
      "export { Identity } from '@semaphore-protocol/identity';",
      "export { Group } from '@semaphore-protocol/group';",
      "export { generateProof } from '@semaphore-protocol/proof';",
    ].join('\n'),
    resolveDir: EDITOR,
    sourcefile: 'semaphore-entry.js',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  charset: 'utf8',
  write: false,
  logLevel: 'warning',
});
const bundle = result.outputFiles[0].contents;
await writeFile(join(OUT, 'semaphore.js'), bundle);
written.push(['semaphore.js', bundle]);

const ART = join(CAGI, 'node_modules/.pnpm/@zk-kit+semaphore-artifacts@4.13.0/node_modules/@zk-kit/semaphore-artifacts');
for (let d = 1; d <= MAX_DEPTH; d++) {
  for (const ext of ['wasm', 'zkey']) {
    const name = `semaphore-${d}.${ext}`;
    await copyFile(join(ART, name), join(OUT, 'artifacts', name));
    written.push([`artifacts/${name}`, await readFile(join(OUT, 'artifacts', name))]);
  }
}

let total = 0;
for (const [name, bytes] of written) {
  total += bytes.length;
  console.log(`${sha(bytes)}  ${String(bytes.length).padStart(9)}  vendor/semaphore/${name}`);
}
console.log(`${String(total).padStart(76)}  bytes in ${written.length} files`);
