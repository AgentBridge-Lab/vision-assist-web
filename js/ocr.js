// @ts-check
/**
 * 기기 내 OCR — Tesseract.js 래퍼 (기획서 v2 1-2절, 로드맵 3단계).
 * 사진과 글자는 기기 밖으로 나가지 않습니다. 밖에서 받아 오는 것은 OCR 엔진과 언어 자료뿐입니다.
 * Tesseract.js(Apache-2.0)는 index.html의 CDN <script>가 window.Tesseract로 올립니다. 버전은 config.js에 고정했습니다.
 *
 * 언어 자료는 고른 언어의 것만 그때 받습니다. 상품 포장에는 자국어와 영문이 섞이는 일이 많아 "<언어>+eng"로 읽고,
 * 영어를 골랐을 때는 eng만 씁니다.
 *
 * @typedef {{text:string, confidence:number}} OcrLine
 * @typedef {{text:string, confidence:number, lines:OcrLine[]}} OcrResult
 */

/**
 * 전각 영숫자·기호를 반각으로 바꿉니다(예: "1.5Ｌ" → "1.5L"). 2026-11-16 측정에서 반복해 나온 계통 오류입니다.
 * - 글자의 폭만 바꿉니다. 한글과 한자, 가나는 건드리지 않고, 읽히지 않은 글자를 채우거나 고치지도 않습니다.
 * - 중국어·일본어 문서(keepPunctuation)는 전각 문장부호가 원문의 정상 표기이므로 영숫자만 바꾸고,
 *   기호는 숫자에 붙은 것(１．５ ／ ５０％ 등)만 바꿉니다.
 * @param {string} text
 * @param {boolean} [keepPunctuation]
 */
export function normalizeWidth(text, keepPunctuation = false) {
  const half = (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  let s = String(text || '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, half);
  if (keepPunctuation) return s.replace(/(?<=\d)[．，：／－～](?=\d)|(?<=\d)％/g, half);
  return s.replace(/[！-～]/g, half).replace(/　/g, ' ');
}

export class Ocr {
  /** @param {typeof import('./config.js').CONFIG} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    /** @type {any} */ this.worker = null;
    this.lang = '';
    /** @type {Promise<void>|null} */ this._init = null;
    this._initLang = '';
  }

  /** CDN 스크립트가 올라왔는가 */
  get available() { return typeof (/** @type {any} */ (window).Tesseract) !== 'undefined'; }

  /** @param {string} lang tesseract 언어 코드(kor, chi_sim, eng, spa, fra, deu, tha, jpn) */
  isReady(lang) { return !!this.worker && this.lang === lang; }

  /**
   * Tesseract.js가 쓰는 브라우저 저장소(IndexedDB 'keyval-store' / 'keyval', 열쇠 './<언어>.traineddata').
   * 언어 자료를 여기에 넣어 두면 Tesseract.js가 통신 없이 그것을 읽습니다.
   * 이렇게 하는 이유: 언어 자료가 언어마다 다른 CDN 꾸러미에 있는데 Tesseract.js 5.1.1은 내려받기 주소를 하나만 받습니다.
   * (자료를 직접 넘기는 방식은 5.1.1의 초기화 단계 결함으로 실패하는 것을 확인했습니다.)
   * 열쇠 이름은 5.1.1 내부 규칙이므로 버전을 올릴 때 다시 확인해야 합니다.
   */
  _store(mode) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('keyval-store');
      open.onupgradeneeded = () => open.result.createObjectStore('keyval');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        try { resolve(open.result.transaction('keyval', mode).objectStore('keyval')); } catch (e) { reject(e); }
      };
    });
  }

  async _cached(code) {
    const store = await this._store('readonly');
    return new Promise((resolve) => {
      const req = store.count(`./${code}.traineddata`);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  }

  async _seed(code, bytes) {
    const store = await this._store('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(bytes, `./${code}.traineddata`);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    });
  }

  /** 언어 자료 한 개를 받습니다. 받은 바이트 수를 onBytes로 알립니다. */
  async _download(lang, onBytes) {
    const res = await fetch(this.cfg.OCR_DATA_URL.replaceAll('{lang}', lang));
    if (!res.ok) throw new Error('ocr-data-' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body) { const all = new Uint8Array(await res.arrayBuffer()); onBytes(all.length, total || all.length); return all; }
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onBytes(got, total);
    }
    const all = new Uint8Array(got);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    return all;
  }

  /**
   * 엔진과 언어 자료를 준비합니다. 같은 언어로 여러 번 불러도 한 번만 실행됩니다. 실패하면 다음에 다시 시도할 수 있습니다.
   * @param {string} lang
   * @param {(percent:number)=>void} [onProgress] 내려받기 진행률(0~100). 이미 받아 둔 자료면 불리지 않습니다
   */
  init(lang, onProgress) {
    if (this.isReady(lang)) return Promise.resolve();
    if (this._init && this._initLang === lang) return this._init;
    this._initLang = lang;
    this._init = (async () => {
      if (!this.available) throw new Error('tesseract-not-loaded');
      if (this.worker) { try { await this.worker.terminate(); } catch { /* 이미 끝남 */ } this.worker = null; this.lang = ''; }
      let codes = lang === 'eng' ? ['eng'] : [lang, 'eng'];
      try {
        // 아직 받지 않은 언어 자료만 받습니다(고른 언어 + 영어)
        const missing = [];
        for (const code of codes) if (!(await this._cached(code))) missing.push(code);
        const got = missing.map(() => 0), totals = missing.map(() => 0);
        await Promise.all(missing.map(async (code, i) => {
          const bytes = await this._download(code, (g, t) => {
            got[i] = g; totals[i] = t;
            if (onProgress && totals.every((x) => x > 0)) onProgress(Math.min(100, Math.floor((100 * got.reduce((a, b) => a + b, 0)) / totals.reduce((a, b) => a + b, 0))));
          });
          await this._seed(code, bytes);
        }));
      } catch {
        // 저장소를 쓸 수 없는 브라우저: 고른 언어 하나만 Tesseract.js가 직접 받게 합니다(영문 혼용 인식은 빠짐)
        codes = [lang];
      }
      const T = /** @type {any} */ (window).Tesseract;
      const worker = await T.createWorker(codes.join('+'), 1, {
        workerPath: this.cfg.OCR_WORKER_PATH,
        corePath: this.cfg.OCR_CORE_PATH,
        // 저장소에 없을 때만 쓰이는 내려받기 주소(고른 언어의 고정 버전 꾸러미)
        langPath: this.cfg.OCR_DATA_URL.replaceAll('{lang}', lang).replace(/\/[^/]+$/, ''),
      });
      if (this._initLang !== lang) { try { await worker.terminate(); } catch { /* 무시 */ } throw new Error('ocr-superseded'); }
      this.worker = worker;
      this.lang = lang;
    })().finally(() => { if (this._initLang === lang) this._init = null; });
    return this._init;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} lang
   * @returns {Promise<OcrResult>}
   */
  async recognize(canvas, lang) {
    await this.init(lang);
    const { data } = await this.worker.recognize(canvas);
    const keep = lang === 'chi_sim' || lang === 'jpn';
    /** @type {OcrLine[]} */
    const lines = (data.lines || []).map((l) => ({ text: normalizeWidth(l.text, keep).trim(), confidence: Number(l.confidence) || 0 })).filter((l) => l.text);
    return { text: normalizeWidth(data.text, keep).trim(), confidence: Number(data.confidence) || 0, lines };
  }
}
