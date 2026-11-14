// Every act of the Coordination Contract, as one call each, with the signed-in person's own token (session.js).
// The paths and bodies are CommandAGI's contract editor's (packages/applets/contract/src/ui/api.ts), so the site and
// the workbench do each act through the same door. A read answers its data, or null when it could not be read. An
// act answers `{ ok: true, … }` or `{ ok: false, refusals: [{ code, … }] }`: word a refusal with
// `words('refusals')` (contract-words.js). To update: redesign/APP.md § the API.
import { api, ApiError } from './session.js';

async function get(path) {
  try {
    return await api(path);
  } catch {
    return null;
  }
}
async function post(path, body, pick) {
  try {
    return { ok: true, ...pick((await api(path, { method: 'POST', body })) ?? {}) };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 0) return { ok: false, refusals: [{ code: 'network' }] };
    const refused = Array.isArray(e.body?.refused) ? e.body.refused : null;
    const error = typeof e.body?.error === 'string' ? e.body.error : e.status === 401 ? 'unauthorized' : `http_${e.status}`;
    return { ok: false, refusals: refused ?? error.split(/,\s*/).map(code => ({ code })) };
  }
}
const loadOverview = () => get("/public/contract");
const loadAwaiting = () => get("/contract/awaiting");
const listRfcs = async () => (await get("/public/contract/rfcs"))?.rfcs ?? [];
const loadMe = () => get("/contract/me");
const loadRfc = (id) => get(`/contract/rfcs/${encodeURIComponent(id)}`);
const loadDetermination = async (id) => (await get(`/public/contract/determinations/${encodeURIComponent(id)}`))?.determination ?? null;
const listMyCases = async () => (await get("/contract/cases"))?.cases ?? [];
const loadCase = (id) => get(`/contract/cases/${encodeURIComponent(id)}`);
const openRfc = (draft) => post("/contract/rfcs", draft, (d) => ({ id: String(d.rfc?.id ?? "") }));
const respondToRfc = (id, parts) => post(`/contract/rfcs/${encodeURIComponent(id)}/responses`, { parts }, (d) => ({ receipt: d.receipt }));
const confirmResponse = (id, responseId, digest) => post(`/contract/rfcs/${encodeURIComponent(id)}/responses/${encodeURIComponent(responseId)}/confirm`, { digest }, () => ({}));
const contestInterpretation = (id) => post(`/contract/rfcs/${encodeURIComponent(id)}/contest`, {}, () => ({}));
const fileCase = (filing) => post("/contract/cases", filing, (d) => ({ id: String(d.case?.id ?? "") }));
const submitEvidence = (id, parts, counter) => post(`/contract/cases/${encodeURIComponent(id)}/submissions`, { parts, ...counter ? { counter } : {} }, () => ({}));
const appealCase = (id) => post(`/contract/cases/${encodeURIComponent(id)}/appeal`, {}, () => ({}));
const raiseStakes = (id, floorCents) => post(`/contract/cases/${encodeURIComponent(id)}/stakes`, { floorCents }, () => ({}));
const requestFreeze = (id, amountCents) => post(`/contract/cases/${encodeURIComponent(id)}/interim`, { amountCents }, () => ({}));
async function uploadMedia(file) {
  try {
    const data = await api('/contract/media', { method: 'POST', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } });
    return data?.part ? { ok: true, part: data.part } : { ok: false, refusals: [{ code: 'http_200' }] };
  } catch (e) {
    return { ok: false, refusals: [{ code: e instanceof ApiError && e.status ? (e.code ?? `http_${e.status}`) : 'network' }] };
  }
}
const registerCommitment = (commitment) => post("/contract/anonymity/commitment", { commitment }, (d) => ({ rotated: d.rotated === true }));
const loadMyCommitment = async () => (await get("/contract/anonymity/commitment"))?.commitment ?? null;
const loadIntents = async (agreementId) => (await get(`/services/contracts/${encodeURIComponent(agreementId)}/intents`))?.intents ?? null;
const listNotices = async () => (await get("/contract/notices"))?.notices ?? [];
const markNoticeRead = (id) => post(`/contract/notices/${encodeURIComponent(id)}/read`, {}, () => ({}));
const listMandates = async () => (await get("/public/contract/mandates"))?.mandates ?? [];
const createMandate = (mandate) => post("/contract/mandates", mandate, (d) => ({ id: String(d.mandate?.id ?? "") }));
const closeMandate = (id) => post(`/contract/mandates/${encodeURIComponent(id)}/close`, {}, () => ({}));
const drawFacility = (mandateId, principalCents, purpose) => post("/contract/facilities", { mandateId, principalCents, purpose }, (d) => ({ id: String(d.facility?.id ?? "") }));
const loadMyCredit = () => get("/contract/facilities");
const loadFacility = (id) => get(`/contract/facilities/${encodeURIComponent(id)}`);
const repayFacility = (id, amountCents) => post(`/contract/facilities/${encodeURIComponent(id)}/repay`, { amountCents }, () => ({}));
const offerTransfer = (id, to, units, priceCents) => post(`/contract/facilities/${encodeURIComponent(id)}/offers`, { to, units, priceCents }, () => ({}));
const acceptOffer = (id) => post(`/contract/offers/${encodeURIComponent(id)}/accept`, {}, () => ({}));
const withdrawOffer = (id) => post(`/contract/offers/${encodeURIComponent(id)}/withdraw`, {}, () => ({}));
// Stripe Identity's hosted flow (a government ID and a live selfie); the person comes back to `returnPath` on this
// origin. The contract keeps only a one-way voice key derived from the verified identity, never the identity.
async function startIdentityVerification(returnPath = '/desk.html') {
  try {
    const data = await api('/identity/verify', { method: 'POST', body: { origin: location.origin, returnPath } });
    return data?.url ? { url: data.url } : { error: data?.error ?? 'http_200' };
  } catch (e) {
    return { error: e instanceof ApiError && e.status ? (e.code ?? `http_${e.status}`) : 'network' };
  }
}
export {
  acceptOffer,
  appealCase,
  closeMandate,
  confirmResponse,
  contestInterpretation,
  createMandate,
  drawFacility,
  fileCase,
  listMandates,
  listMyCases,
  listNotices,
  listRfcs,
  loadAwaiting,
  loadCase,
  loadDetermination,
  loadFacility,
  loadIntents,
  loadMe,
  loadMyCommitment,
  loadMyCredit,
  loadOverview,
  loadRfc,
  markNoticeRead,
  offerTransfer,
  openRfc,
  raiseStakes,
  registerCommitment,
  repayFacility,
  requestFreeze,
  respondToRfc,
  startIdentityVerification,
  submitEvidence,
  uploadMedia,
  withdrawOffer
};
