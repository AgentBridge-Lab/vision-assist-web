// @ts-check
/**
 * 기기 내 OCR — PaddleOCR PP-OCRv5 (onnxruntime-web) 래퍼.
 *
 * 2026-11-16 결정사항 D-4로 Tesseract.js를 대신해 채택했습니다. 같은 42장 합성 열화 세트에서
 * 정확 일치율 57.1% → 92.9%, 글자 오류율 15.3% → 0.6%, 기울기 15° 조건 0/6 → 6/6이었습니다.
 * 사진과 글자는 기기 밖으로 나가지 않습니다. 밖에서 받아 오는 것은 엔진과 모델뿐입니다.
 *
 * 알고리즘은 test/paddle-bench.html(92.9%를 낸 바로 그 코드)을 옮긴 것입니다.
 * 전처리 상수는 전부 각 모델의 공식 inference.yml에서 읽은 값이며 models/manifest.json에 적어 두었습니다.
 *
 * @typedef {{text:string, confidence:number}} OcrLine
 * @typedef {{text:string, confidence:number, lines:OcrLine[]}} OcrResult
 * @typedef {{received:number, total:number, phase:string}} OcrProgress
 */

import { normalizeWidth } from './ocr.js';

// 이 모듈 파일을 기준으로 풉니다. 페이지 주소 기준으로 두면 test/ 아래에서 부를 때 /test/models/...를 찾습니다
const MANIFEST_URL = new URL('../models/manifest.json', import.meta.url).href;
const DICT_BASE = new URL('../models/dict/', import.meta.url).href;
const CACHE_NAME = 'vision-ocr-v1';

/** @type {any} */
let ortRef = null;

// ── 내려받기와 보관 ────────────────────────────────────────────────────────

/** Cache API를 쓸 수 있는가. 비공개 모드나 저장소 차단에서는 못 씁니다 — 그래도 동작은 해야 합니다 */
async function openCache() {
  try { return await caches.open(CACHE_NAME); } catch { return null; }
}

/**
 * 한 건을 받아 ArrayBuffer로. 받은 바이트를 그때그때 알려 줍니다.
 * 세는 것은 **압축을 푼 본문 크기**입니다(진행률용). 사용자에게 말할 통신량은 manifest의 transferBytes를 씁니다.
 * @param {string} url
 * @param {(delta:number)=>void} onDelta
 */
async function fetchCounted(url, onDelta) {
  const cache = await openCache();
  if (cache) {
    const hit = await cache.match(url);
    if (hit) { const buf = await hit.arrayBuffer(); onDelta(buf.byteLength); return buf; }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`내려받기 실패 ${res.status}: ${url}`);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onDelta(buf.byteLength);
    if (cache) { try { await cache.put(url, new Response(buf, { headers: res.headers })); } catch { /* 저장 공간 부족 */ } }
    return buf;
  }
  // 먼저 흘려 받으며 진행률을 알리고, 다 받은 뒤에 캐시에 넣습니다.
  // 순서를 바꾸면(= res.clone()을 먼저 cache.put) 8~16MB 파일이 다 받아질 때까지 0%에 멈춰 있습니다
  const reader = res.body.getReader();
  const parts = []; let len = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); len += value.byteLength; onDelta(value.byteLength);
  }
  const out = new Uint8Array(len); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  if (cache) { try { await cache.put(url, new Response(out, { headers: res.headers })); } catch { /* 저장 공간 부족 */ } }
  return out.buffer;
}

/** onnxruntime-web을 그때 불러옵니다. 문서 읽기를 쓰지 않는 사람에게는 받지 않습니다 */
async function loadOrt(distUrl, onDelta) {
  if (ortRef) return ortRef;
  if (/** @type {any} */ (window).ort) { ortRef = /** @type {any} */ (window).ort; return ortRef; }
  const buf = await fetchCounted(distUrl + 'ort.min.js', onDelta);
  const url = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.onload = () => resolve(null); s.onerror = () => reject(new Error('onnxruntime을 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
  URL.revokeObjectURL(url);
  ortRef = /** @type {any} */ (window).ort;
  if (!ortRef) throw new Error('onnxruntime이 올라오지 않았습니다');
  return ortRef;
}

/**
 * 글자 사전을 읽습니다.
 * **줄을 trim()하지 마십시오.** cjk.txt의 0번 항목이 U+3000(전각 공백)이고 JS trim()은 이 글자를 지웁니다.
 * 지우면 18,383자 색인이 전부 한 칸씩 밀려 중국어·일본어가 높은 신뢰도로 엉뚱한 글자를 냅니다.
 * @param {string} file @param {number} expect @param {(d:number)=>void} onDelta
 */
async function loadDict(file, expect, onDelta) {
  const buf = await fetchCounted(DICT_BASE + file, onDelta);
  const lines = new TextDecoder().decode(buf).split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop(); // 파일 끝 줄바꿈 하나만 버립니다
  if (lines.length !== expect) throw new Error(`사전 ${file}의 줄 수 ${lines.length}이 예상 ${expect}과 다릅니다`);
  return lines;
}

// ── 검출: DB 후처리 (paddle-bench.html에서 옮김) ──────────────────────────

/** 볼록 껍질(단조 사슬). pts: [x,y][] */
function convexHull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/** 최소 넓이 회전 사각형. 기울어진 글줄을 기울어진 채로 감쌉니다(= 기울기 보정의 입력) */
function minAreaRect(hull) {
  if (hull.length < 3) {
    const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
    return { pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], w: x1 - x0, h: y1 - y0 };
  }
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const w = maxU - minU, h = maxV - minV;
    if (!best || w * h < best.area) best = { area: w * h, ux, uy, minU, maxU, minV, maxV, w, h };
  }
  const { ux, uy, minU, maxU, minV, maxV } = best;
  const at = (u, v) => [u * ux - v * uy, u * uy + v * ux];
  return { pts: [at(minU, minV), at(maxU, minV), at(maxU, maxV), at(minU, maxV)], w: best.w, h: best.h };
}

/** [코드] get_mini_boxes: 꼭짓점을 왼위·오른위·오른아래·왼아래 순서로 */
function orderBox(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0]);
  const [l1, l2] = s[0][1] <= s[1][1] ? [s[0], s[1]] : [s[1], s[0]];
  const [r1, r2] = s[2][1] <= s[3][1] ? [s[2], s[3]] : [s[3], s[2]];
  return [l1, r1, r2, l2];
}

/** 사각형을 바깥으로 넓힙니다. [코드] unclip: d = 넓이 × unclip_ratio / 둘레 */
function unclip(box, ratio) {
  const [tl, tr, br, bl] = box;
  const w = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), h = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  if (!w || !h) return box;
  const d = (w * h * ratio) / (2 * (w + h));
  const ux = (tr[0] - tl[0]) / w, uy = (tr[1] - tl[1]) / w, vx = (bl[0] - tl[0]) / h, vy = (bl[1] - tl[1]) / h;
  const mv = (p, a, b) => [p[0] + a * ux * d + b * vx * d, p[1] + a * uy * d + b * vy * d];
  return [mv(tl, -1, -1), mv(tr, 1, -1), mv(br, 1, 1), mv(bl, -1, 1)];
}

/** 검출기 실행 → 원본 좌표의 글줄 사각형 목록 */
async function detect(ort, session, det, canvas) {
  const sw = canvas.width, sh = canvas.height;
  const ratio = det.resizeLong / Math.max(sw, sh);
  const rw = Math.max(det.stride, Math.round((sw * ratio) / det.stride) * det.stride);
  const rh = Math.max(det.stride, Math.round((sh * ratio) / det.stride) * det.stride);
  const c = document.createElement('canvas'); c.width = rw; c.height = rh;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(canvas, 0, 0, rw, rh);
  const px = ctx.getImageData(0, 0, rw, rh).data;
  const n = rw * rh, input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    // [yml] img_mode: BGR, scale 1/255, CHW
    input[i] = (px[i * 4 + 2] / 255 - det.mean[0]) / det.std[0];
    input[n + i] = (px[i * 4 + 1] / 255 - det.mean[1]) / det.std[1];
    input[2 * n + i] = (px[i * 4] / 255 - det.mean[2]) / det.std[2];
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, rh, rw]) });
  const prob = out[session.outputNames[0]].data;

  const seen = new Uint8Array(n), boxes = [], stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (seen[start] || prob[start] <= det.thresh) continue;
    let top = 0; stack[top++] = start; seen[start] = 1;
    const pts = []; let sum = 0;
    while (top) {
      const p = stack[--top], x = p % rw, y = (p - x) / rw;
      pts.push([x, y]); sum += prob[p];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue;
        const q = ny * rw + nx;
        if (!seen[q] && prob[q] > det.thresh) { seen[q] = 1; stack[top++] = q; }
      }
    }
    const score = sum / pts.length;
    const rect = minAreaRect(convexHull(pts));
    if (Math.min(rect.w, rect.h) < det.minSize || score < det.boxThresh) continue;
    const big = unclip(orderBox(rect.pts), det.unclipRatio);
    const w = Math.hypot(big[1][0] - big[0][0], big[1][1] - big[0][1]);
    const h = Math.hypot(big[3][0] - big[0][0], big[3][1] - big[0][1]);
    if (Math.min(w, h) < det.minSize + 2) continue;
    boxes.push({ score, pts: orderBox(big.map(([x, y]) => [(x * sw) / rw, (y * sh) / rh])) });
  }
  // [코드] sorted_boxes: 위에서 아래로, 같은 줄(10px 이내)은 왼쪽부터
  boxes.sort((a, b) => a.pts[0][1] - b.pts[0][1] || a.pts[0][0] - b.pts[0][0]);
  for (let i = 0; i < boxes.length - 1; i++) for (let j = i; j >= 0; j--) {
    if (Math.abs(boxes[j + 1].pts[0][1] - boxes[j].pts[0][1]) < 10 && boxes[j + 1].pts[0][0] < boxes[j].pts[0][0]) {
      [boxes[j], boxes[j + 1]] = [boxes[j + 1], boxes[j]];
    } else break;
  }
  return boxes;
}

/**
 * 기울기 보정: 기울어진 사각형을 똑바로 편 조각으로 잘라 냅니다. [코드] get_rotate_crop_image
 * 주의: 180° 뒤집힌 글줄을 바로잡는 방향 분류기는 넣지 않았습니다.
 */
function cropBox(canvas, pts) {
  const [tl, tr, , bl] = pts;
  const W = Math.max(1, Math.round(Math.hypot(tr[0] - tl[0], tr[1] - tl[1])));
  const H = Math.max(1, Math.round(Math.hypot(bl[0] - tl[0], bl[1] - tl[1])));
  const ux = (tr[0] - tl[0]) / W, uy = (tr[1] - tl[1]) / W, vx = (bl[0] - tl[0]) / H, vy = (bl[1] - tl[1]) / H;
  const dt = ux * vy - uy * vx;
  if (!dt) return { canvas: null, angle: 0 };
  const a = vy / dt, b = -uy / dt, c2 = -vx / dt, d = ux / dt;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(a, b, c2, d, -(a * tl[0] + c2 * tl[1]), -(b * tl[0] + d * tl[1]));
  ctx.drawImage(canvas, 0, 0);
  const angle = (Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180) / Math.PI;
  if (H / W < 1.5) return { canvas: c, angle };
  const r = document.createElement('canvas'); r.width = H; r.height = W;
  const rc = /** @type {CanvasRenderingContext2D} */ (r.getContext('2d'));
  rc.translate(0, W); rc.rotate(-Math.PI / 2); rc.drawImage(c, 0, 0);
  return { canvas: r, angle: angle - 90 };
}

/**
 * 조각 하나 → 글자와 신뢰도. [코드] CTCLabelDecode
 * 신뢰도는 남긴 글자 위치들의 최대 확률 평균(0~1)입니다.
 * 주의: 2026-11-16 측정에서 42줄 전부 0.93~1.00이었고 틀린 3건도 0.96~1.00이었습니다.
 *       이 값은 맞고 틀림을 가르지 못합니다. 숫자 안전장치를 여기에 기대지 마십시오.
 */
async function recognize(ort, session, rec, chars, crop) {
  const ratio = crop.width / crop.height;
  const imgW = Math.max(rec.baseWidth, Math.ceil(rec.height * ratio));
  const rw = Math.min(imgW, Math.max(1, Math.ceil(rec.height * ratio)));
  const c = document.createElement('canvas'); c.width = rw; c.height = rec.height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(crop, 0, 0, rw, rec.height);
  const px = ctx.getImageData(0, 0, rw, rec.height).data;
  const plane = rec.height * imgW, input = new Float32Array(3 * plane); // 남는 오른쪽은 0 [코드]
  for (let y = 0; y < rec.height; y++) for (let x = 0; x < rw; x++) {
    const s = (y * rw + x) * 4, t = y * imgW + x;
    input[t] = (px[s + 2] / 255 - rec.mean) / rec.std;            // B [yml] img_mode: BGR
    input[plane + t] = (px[s + 1] / 255 - rec.mean) / rec.std;    // G
    input[2 * plane + t] = (px[s] / 255 - rec.mean) / rec.std;    // R
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, rec.height, imgW]) });
  const t = out[session.outputNames[0]];
  const [, T, C] = t.dims, data = t.data;
  if (C !== chars.length) throw new Error(`인식기 출력 클래스 수 ${C} ≠ 글자표 ${chars.length}`);
  let text = '', sum = 0, kept = 0, prev = 0;
  for (let i = 0; i < T; i++) {
    let best = 0, bestP = -Infinity, total = 0;
    for (let k = 0; k < C; k++) { const p = data[i * C + k]; total += p; if (p > bestP) { bestP = p; best = k; } }
    if (i === 0 && Math.abs(total - 1) > 0.05) throw new Error(`인식기 출력이 확률이 아닙니다(첫 위치 합 ${total.toFixed(3)})`);
    if (best !== 0 && best !== prev) { text += chars[best]; sum += bestP; kept++; }
    prev = best;
  }
  return { text, conf: kept ? sum / kept : 0 };
}

// ── 바깥에서 쓰는 것 ───────────────────────────────────────────────────────

export class PaddleOcr {
  /** @param {typeof import('./config.js').CONFIG} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    /** @type {any} */ this.manifest = null;
    /** @type {any} */ this.det = null;
    /** @type {any} */ this.rec = null;
    /** @type {string[]} */ this.chars = [];
    this.lang = '';
    this.modelKey = '';
    /** @type {Promise<void>|null} */ this._preparing = null;
  }

  /** 이 브라우저가 엔진을 돌릴 수 있는가 */
  get available() {
    return typeof WebAssembly !== 'undefined' && typeof fetch === 'function' && typeof document !== 'undefined';
  }

  isReady(lang) { return !!this.rec && this.lang === lang; }

  async _manifest() {
    if (!this.manifest) {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) throw new Error(`모델 목록을 읽지 못했습니다 (${res.status})`);
      this.manifest = await res.json();
    }
    return this.manifest;
  }

  /**
   * 동의 화면에 쓸 값. 받기 전에 사용자에게 알릴 크기입니다.
   * transferBytes = 실제 통신량(압축된 채로 오가는 양). bodyBytes = 압축을 푼 크기.
   * 사용자에게 말할 때는 **transferBytes**를 쓰십시오.
   * @param {string} lang
   */
  async plan(lang) {
    const m = await this._manifest();
    const key = m.langMap[lang];
    if (!key) throw new Error(`지원하지 않는 언어입니다: ${lang}`);
    const size = m._내려받기량[lang];
    return {
      modelKey: key,
      transferBytes: size.transferBytes,
      bodyBytes: size.bodyBytes,
      transferMB: Math.round(size.transferBytes / 1048576),
      /** 이미 받아 둔 것이 있으면 다시 받지 않습니다 */
      cached: await this._cached(lang),
    };
  }

  /** 이 언어에 필요한 파일이 전부 캐시에 있는가 */
  async _cached(lang) {
    const cache = await openCache();
    if (!cache) return false;
    const m = await this._manifest();
    for (const url of this._urls(m, lang)) {
      if (!(await cache.match(url))) return false;
    }
    return true;
  }

  _urls(m, lang) {
    const key = m.langMap[lang];
    const rec = m.rec.models[key];
    const hf = (r) => `https://huggingface.co/${r.repo}/resolve/${r.commit}/inference.onnx`;
    return [m.runtime.dist + 'ort.min.js', m.runtime.dist + m.runtime.wasmFile, hf(m.det), hf(rec), DICT_BASE + rec.dict];
  }

  /**
   * 모델을 받아 올리고 **계약을 점검**합니다.
   * 계약 점검은 더미 추론 한 번으로 인식기 출력 클래스 수가 글자표와 같은지 보는 것입니다.
   * 사전 색인이 한 칸이라도 밀리면 글자가 조용히 엉뚱해지므로, 이것이 마지막 그물입니다.
   * @param {string} lang
   * @param {(p:OcrProgress)=>void} [onProgress]
   */
  async prepare(lang, onProgress) {
    if (this.isReady(lang)) return;
    if (this._preparing) await this._preparing.catch(() => {});
    this._preparing = this._prepare(lang, onProgress);
    try { await this._preparing; } finally { this._preparing = null; }
  }

  async _prepare(lang, onProgress) {
    const m = await this._manifest();
    const key = m.langMap[lang];
    if (!key) throw new Error(`지원하지 않는 언어입니다: ${lang}`);
    const recInfo = m.rec.models[key];
    const total = m.runtime.bodyBytes + m.det.bytes + recInfo.bytes;
    let got = 0;
    const tick = (phase) => (d) => { got += d; if (onProgress) onProgress({ received: got, total, phase }); };

    const ort = await loadOrt(m.runtime.dist, tick('runtime'));
    const wasm = await fetchCounted(m.runtime.dist + m.runtime.wasmFile, tick('runtime'));
    // 스레드 1개 고정: GitHub Pages는 COOP/COEP를 못 붙여 SharedArrayBuffer가 없습니다.
    // 92.9%·180ms 측정도 스레드 1개 기준입니다.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = m.runtime.dist;
    ort.env.wasm.wasmBinary = wasm;

    const hf = (r) => `https://huggingface.co/${r.repo}/resolve/${r.commit}/inference.onnx`;
    const detBuf = await fetchCounted(hf(m.det), tick('det'));
    const recBuf = await fetchCounted(hf(recInfo), tick('rec'));
    const dict = await loadDict(recInfo.dict, recInfo.dictChars, tick('dict'));

    const opt = { executionProviders: ['wasm'] };
    const detSession = await ort.InferenceSession.create(new Uint8Array(detBuf), opt);
    const recSession = await ort.InferenceSession.create(new Uint8Array(recBuf), opt);
    const chars = ['', ...dict, ' ']; // 0번 = CTC 빈칸, 마지막 = 띄어쓰기 [코드] use_space_char

    // 계약 점검 — 흰 조각 하나를 넣어 출력 클래스 수를 봅니다
    const probe = document.createElement('canvas');
    probe.width = 320; probe.height = m.rec.height;
    const pctx = /** @type {CanvasRenderingContext2D} */ (probe.getContext('2d'));
    pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, probe.width, probe.height);
    await recognize(ort, recSession, m.rec, chars, probe); // 클래스 수가 다르면 여기서 멈춥니다

    this.det = { session: detSession, params: m.det };
    this.rec = { session: recSession, params: m.rec };
    this.chars = chars;
    this.lang = lang;
    this.modelKey = key;
  }

  /**
   * 사진 한 장을 읽습니다.
   * 글줄을 찾지 못하면 **빈 결과**를 냅니다. 지어내지 않습니다.
   * @param {HTMLCanvasElement|HTMLImageElement|ImageBitmap} source
   * @returns {Promise<OcrResult>}
   */
  async read(source) {
    if (!this.rec) throw new Error('문서 읽기가 아직 준비되지 않았습니다');
    const canvas = toCanvas(source);
    const ort = ortRef;
    const boxes = await detect(ort, this.det.session, this.det.params, canvas);
    /** @type {OcrLine[]} */ const lines = [];
    const keepFullWidth = this.lang === 'zh-CN' || this.lang === 'ja';
    for (const box of boxes) {
      const crop = cropBox(canvas, box.pts);
      if (!crop.canvas) continue;
      const r = await recognize(ort, this.rec.session, this.rec.params, this.chars, crop.canvas);
      const text = normalizeWidth(r.text, keepFullWidth).normalize('NFC');
      if (!text.trim()) continue;
      lines.push({ text, confidence: Math.round(r.conf * 100) });
    }
    const text = lines.map((l) => l.text).join(' ');
    const confidence = lines.length ? Math.round(lines.reduce((s, l) => s + l.confidence, 0) / lines.length) : 0;
    return { text, confidence, lines };
  }

  /**
   * 기존 OCR 모듈과 같은 모양의 쓰임새. main.js가 이 두 가지만 씁니다.
   * @param {string} lang @param {(pct:number)=>void} [onPct]
   */
  async init(lang, onPct) {
    await this.prepare(lang, onPct ? (p) => onPct(Math.min(99, Math.round((p.received / p.total) * 100))) : undefined);
    if (onPct) onPct(100);
  }

  /** @param {any} source @param {string} lang */
  async recognize(source, lang) {
    if (!this.isReady(lang)) await this.prepare(lang);
    return this.read(source);
  }

  dispose() {
    try { this.det && this.det.session.release && this.det.session.release(); } catch { /* 이미 정리됨 */ }
    try { this.rec && this.rec.session.release && this.rec.session.release(); } catch { /* 이미 정리됨 */ }
    this.det = null; this.rec = null; this.chars = []; this.lang = '';
  }
}

/** @param {any} src */
function toCanvas(src) {
  if (src instanceof HTMLCanvasElement) return src;
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(src, 0, 0);
  return c;
}
