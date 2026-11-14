# vendor/semaphore: licences

The anonymous voice (`anon.js`) proves in the person's browser with Semaphore v4. This folder holds the prover as one
ES module and its proving artifacts, built by `node redesign/vendor-semaphore.mjs` from the versions CommandAGI's
contract editor pins (`packages/applets/contract/package.json`, `pnpm-lock.yaml`). Nothing here is fetched from another
host: the page loads `semaphore.js` with a dynamic `import()` when a person starts an anonymous act, and the prover reads
the artifacts from this site.

## what is here

| file | what it is | from |
|---|---|---|
| `semaphore.js` | `Identity`, `Group` and `generateProof`, bundled and minified by esbuild 0.24.2; the licence comments of the bundled code are kept at its end | the packages below |
| `artifacts/semaphore-<d>.wasm` | the Semaphore circuit's witness generator for a tree of depth `d` (1 to 8) | `@zk-kit/semaphore-artifacts` 4.13.0, copied as it is |
| `artifacts/semaphore-<d>.zkey` | the Groth16 proving key of Semaphore's trusted setup for depth `d` (1 to 8) | `@zk-kit/semaphore-artifacts` 4.13.0, copied as it is |

## the packages and their licences

| package | version | licence | in `semaphore.js` |
|---|---|---|---|
| @semaphore-protocol/identity | 4.14.3 | MIT | yes |
| @semaphore-protocol/group | 4.14.3 | MIT | yes |
| @semaphore-protocol/proof | 4.14.3 | MIT | `generateProof` only (no verifier, no verification keys) |
| @semaphore-protocol/utils | 4.14.3 | MIT | yes |
| @zk-kit/baby-jubjub | 1.0.3 | MIT | yes |
| @zk-kit/eddsa-poseidon | 1.0.4 | MIT | yes |
| @zk-kit/lean-imt | 2.2.5 | MIT | yes |
| @zk-kit/artifacts | 2.0.1 | MIT | yes (its download path is never used: the artifacts are always given) |
| @zk-kit/utils | 1.2.1, 1.3.0, 1.4.1 | MIT | yes |
| poseidon-lite | 0.3.0 | MIT | yes |
| ethers | 6.13.4 | MIT | keccak256 and number helpers only |
| @noble/hashes | 1.3.2 | MIT | yes |
| buffer | 6.0.3 | MIT | yes |
| base64-js | 1.5.1 | MIT | yes |
| ieee754 | 1.2.1 | BSD-3-Clause | yes |
| snarkjs | 0.7.5 | GPL-3.0 | its browser build `build/browser.esm.js`, which inlines fastfile 0.0.20 (GPL-3.0), @iden3/binfileutils 0.0.12 (GPL-3.0), r1csfile 0.0.48 (GPL-3.0), circom_runtime 0.1.28 (Apache-2.0), blake2b-wasm 2.4.0 (MIT) and js-sha3 0.8.0 (MIT) |
| ffjavascript | 0.3.1 | GPL-3.0 | its browser build, which inlines wasmcurves 0.2.2 (GPL-3.0) and wasmbuilder 0.0.16 (GPL-3.0) |
| @zk-kit/semaphore-artifacts | 4.13.0 | MIT | no: the `artifacts/` files |

**GPL-3.0.** snarkjs and ffjavascript are licensed under the GNU General Public License, version 3. `semaphore.js`
conveys them in object form (minified). Their complete corresponding source is the published npm packages named above,
at those exact versions (snarkjs 0.7.5: https://github.com/iden3/snarkjs/tree/v0.7.5; ffjavascript 0.3.1:
https://github.com/iden3/ffjavascript), and `redesign/vendor-semaphore.mjs` is the script that builds this file from
them. The licence text is at https://www.gnu.org/licenses/gpl-3.0.txt and in each package's `COPYING`. CommandAGI's
workbench serves the same code under the same terms.

**MIT** (the Semaphore and zk-kit packages; the other MIT packages carry the same terms under their own copyright
lines, kept in the comments at the end of `semaphore.js`):

```
MIT License

Copyright (c) 2025 Ethereum Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## the files, byte for byte

What `node redesign/vendor-semaphore.mjs` printed (sha256, path, size). `test/anon.test.mjs` holds the files to these
lines; rebuilding from the same CommandAGI checkout gives the same bytes.

```
34de0c1c43faebbe6737a3ecd2aae49450795dfd4b3147f992accb998c0563db  vendor/semaphore/semaphore.js  (454,575 bytes)
70289ef3bdfa86e97debdb227e76721b392f45b5e73d5e7136d93a04dce0dff9  vendor/semaphore/artifacts/semaphore-1.wasm  (1,798,638 bytes)
471a978875f91411b21ba5a2fbea41df30ec45eb23e3ac045edf7f30a2846a08  vendor/semaphore/artifacts/semaphore-1.zkey  (1,552,601 bytes)
877a989a8881ff6651866cfa32088f60e4abcb02a26f2e995868dfabd7f9385b  vendor/semaphore/artifacts/semaphore-2.wasm  (1,801,079 bytes)
110e2d9de78730aa4f5c78c75017cfe4d769b4b7ce60f58484fb14733d7b0f35  vendor/semaphore/artifacts/semaphore-2.zkey  (1,653,555 bytes)
48e15502f710be0a623d573d472edeeaf918fd5eee0b2ca9b407c4e4f20d12f2  vendor/semaphore/artifacts/semaphore-3.wasm  (1,802,902 bytes)
c36653c42784df35a01f3d93415af9ad8292a540f8deb134a6a34a01752a89d3  vendor/semaphore/artifacts/semaphore-3.zkey  (1,899,542 bytes)
ec0ed0ae7eb0264070b36a247cf4aad8157c5550f0731d3462019526e5e9ae4f  vendor/semaphore/artifacts/semaphore-4.wasm  (1,804,630 bytes)
90c94bad7ad97eeb9314750e443d84da783e38a21f55538d72b10d258064f6e6  vendor/semaphore/artifacts/semaphore-4.zkey  (1,852,550 bytes)
74ee373fc66bf81ca89de52602b555f16ef0e54c0e36e5b69c6e109d146acfb5  vendor/semaphore/artifacts/semaphore-5.wasm  (1,806,499 bytes)
a1431c24dc49e98d07d48e7bdacc002875bcb02a799d9156c6aa6bcbe0838926  vendor/semaphore/artifacts/semaphore-5.zkey  (1,951,788 bytes)
432293aa5c8e7d503148824ff17a8ad7318058a656af568837f30675d867827e  vendor/semaphore/artifacts/semaphore-6.wasm  (1,808,368 bytes)
24a7ef2c7f4c809a502e876cb3295535a73710ec7bc3827b5a15018e434a674a  vendor/semaphore/artifacts/semaphore-6.zkey  (2,038,580 bytes)
3ba75768d5dfbee9d52b732b69eefb1725c8c356a3de9c2f2a71dbc401a0ea61  vendor/semaphore/artifacts/semaphore-7.wasm  (1,810,182 bytes)
d77851ee4bd496c6b5f70fbfa550f113a89bad972efd4c541267e566163d0600  vendor/semaphore/artifacts/semaphore-7.zkey  (2,113,447 bytes)
4edc07444a1d48d09014c963e315d3351b6e12838d83fcb1962071614b1c94b9  vendor/semaphore/artifacts/semaphore-8.wasm  (1,811,974 bytes)
d02521afe7133a97421244374d4bc005c1ebd7d7cf7c51e88b7e99fdaf183146  vendor/semaphore/artifacts/semaphore-8.zkey  (2,231,251 bytes)
```

Total: 30,192,161 bytes in 17 files (28.8 MiB). The largest file is
2,231,251 bytes, under the host's 25 MB per file.

## the depths

A proof is made with the artifacts of its tree's depth, `max(1, ceil(log2(size)))`, where `size` is the number of
commitments in the set the proposal pinned when it opened. Depths 1 to 8 prove for sets of up to 256 members. On
2026-11-13 production's `human` set had 0 members (`GET https://api.commandagi.com/public/contract/anonymity/group?kind=human`)
and 1 person held a voice (`GET /public/contract/stats`: `people.withVoice.human` = 1). A deeper set is refused by
name (`prover_depth_missing`, naming the missing files). To add depths: `node redesign/vendor-semaphore.mjs --depths
<n>`, raise `MAX_DEPTH` in `anon.js`, and replace the list above with what the script prints. Each further depth adds
about 4 to 7 MB.
