// @ts-check
/**
 * 기기 내 한국어 OCR — Tesseract.js 래퍼 (기획서 v2 1-2절, 로드맵 3단계).
 * 사진과 글자는 기기 밖으로 나가지 않습니다. 밖에서 받아 오는 것은 OCR 엔진과 한국어 학습 데이터뿐입니다(최초 1회, 약 1.6MB + 엔진).
 * Tesseract.js(Apache-2.0)는 index.html의 CDN <script>가 window.Tesseract로 올립니다. 버전은 config.js에 고정했습니다.
 *
 * @typedef {{text:string, confidence:number}} OcrLine
 * @typedef {{text:string, confidence:number, lines:OcrLine[]}} OcrResult
 */

export class Ocr {
  /** @param {typeof import('./config.js').CONFIG} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    /** @type {any} */ this.worker = null;
    /** @type {Promise<void>|null} */ this._init = null;
  }

  /** CDN 스크립트가 올라왔는가 */
  get available() { return typeof (/** @type {any} */ (window).Tesseract) !== 'undefined'; }

  get ready() { return !!this.worker; }

  /** 엔진과 한국어 데이터를 준비합니다. 여러 번 불러도 한 번만 실행됩니다. 실패하면 다음에 다시 시도할 수 있습니다. */
  init() {
    if (this.worker) return Promise.resolve();
    if (!this._init) {
      this._init = (async () => {
        if (!this.available) throw new Error('tesseract-not-loaded');
        const T = /** @type {any} */ (window).Tesseract;
        this.worker = await T.createWorker(this.cfg.OCR_LANG, 1, {
          workerPath: this.cfg.OCR_WORKER_PATH,
          corePath: this.cfg.OCR_CORE_PATH,
          langPath: this.cfg.OCR_LANG_PATH,
        });
      })().catch((e) => { this._init = null; throw e; });
    }
    return this._init;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<OcrResult>}
   */
  async recognize(canvas) {
    await this.init();
    const { data } = await this.worker.recognize(canvas);
    /** @type {OcrLine[]} */
    const lines = (data.lines || []).map((l) => ({ text: String(l.text || '').trim(), confidence: Number(l.confidence) || 0 })).filter((l) => l.text);
    return { text: String(data.text || '').trim(), confidence: Number(data.confidence) || 0, lines };
  }
}
