// @ts-check
/**
 * 카메라: getUserMedia, 프레임 추출, 생존 판정 (기획서 v2 1-5절, 4-1절).
 * 마이크는 요청하지 않습니다(audio: false).
 */

/** @typedef {'unsupported'|'denied'|'notfound'|'busy'|'stalled'} CameraErrorKind */

export class CameraError extends Error {
  /** @param {CameraErrorKind} kind */
  constructor(kind) { super(`camera:${kind}`); this.kind = kind; }
}

export class Camera {
  /**
   * @param {HTMLVideoElement} video
   * @param {typeof import('./config.js').CONFIG} cfg
   */
  constructor(video, cfg) {
    this.video = video;
    this.cfg = cfg;
    /** @type {MediaStream|null} */ this.stream = null;
    this.small = document.createElement('canvas');
    this.small.width = this.small.height = cfg.SAMPLE_SIZE;
    this.smallCtx = /** @type {CanvasRenderingContext2D} */ (this.small.getContext('2d', { willReadFrequently: true }));
    this._lastGray = /** @type {Uint8Array|null} */ (null);
    this._lastTime = -1;
    this._lastChangeAt = 0;
  }

  /**
   * 카메라를 켭니다. 실패는 오류 이름으로 종류를 나눕니다(1-5절).
   * @throws {CameraError}
   */
  async start() {
    // 비보안 환경(HTTP)에서는 접근 객체 자체가 없음 → 권한 요청 전에 분기
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new CameraError('unsupported');
    this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
    } catch (e) {
      const name = /** @type {any} */ (e) && /** @type {any} */ (e).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied');
      if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('notfound');
      throw new CameraError('busy'); // NotReadableError, AbortError: 다른 앱 점유·하드웨어 오류
    }
    this.video.srcObject = this.stream;
    try { await this.video.play(); } catch { /* 자동 재생이 막혀도 프레임 판정으로 다시 확인합니다 */ }
    this._lastGray = null;
    this._lastTime = -1;
    this._lastChangeAt = performance.now();
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  get ready() { return !!this.stream && this.video.readyState >= 2 && this.video.videoWidth > 0; }

  /** 64×64 흑백 축소 프레임. 준비되지 않았으면 null. @returns {Uint8Array|null} */
  sampleGray() {
    if (!this.ready) return null;
    const n = this.cfg.SAMPLE_SIZE;
    this.smallCtx.drawImage(this.video, 0, 0, n, n);
    const rgba = this.smallCtx.getImageData(0, 0, n, n).data;
    const gray = new Uint8Array(n * n);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
    return gray;
  }

  /**
   * 생존 판정 (1-5절): 트랙 상태값을 믿지 않고 실제 프레임으로 봅니다.
   * 영상 시각이 멈추고 축소 프레임이 한 화소도 바뀌지 않은 채 CAMERA_STALL_MS가 지나면 'stalled'.
   * [구현 가정] 영상 시각은 흐르는데 화면만 검은 경우는 여기서 잡지 못합니다(그 경우 게이트 1이 "어둡습니다"로 안내). V2에서 실기기 확인 필요.
   * @param {Uint8Array} gray @param {number} now
   * @returns {'ok'|'stalled'}
   */
  checkAlive(gray, now) {
    const t = this.video.currentTime;
    let changed = t !== this._lastTime || !this._lastGray;
    if (!changed && this._lastGray) {
      for (let i = 0; i < gray.length; i++) if (gray[i] !== this._lastGray[i]) { changed = true; break; }
    }
    this._lastTime = t;
    this._lastGray = gray;
    if (changed) this._lastChangeAt = now;
    return now - this._lastChangeAt >= this.cfg.CAMERA_STALL_MS ? 'stalled' : 'ok';
  }

  /** 긴 변·짧은 변 제한 안에 들어가게 줄인 캔버스. @returns {HTMLCanvasElement|null} */
  grabCanvas(longSide, shortSide = longSide) {
    if (!this.ready) return null;
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const scale = Math.min(1, longSide / Math.max(vw, vh), shortSide / Math.min(vw, vh));
    const c = document.createElement('canvas');
    c.width = Math.round(vw * scale);
    c.height = Math.round(vh * scale);
    /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(this.video, 0, 0, c.width, c.height);
    return c;
  }

  /**
   * 전송용 사진 한 장(JPEG data URL). 1024×768 이하, 400KB 이하가 되도록 화질을 낮춥니다(2-1절, 2-4절).
   * @returns {string|null}
   */
  grabJpeg() {
    const c = this.grabCanvas(this.cfg.IMAGE_LONG_SIDE, this.cfg.IMAGE_SHORT_SIDE);
    if (!c) return null;
    let url = '';
    for (const q of this.cfg.IMAGE_JPEG_QUALITIES) {
      url = c.toDataURL('image/jpeg', q);
      if (((url.length - url.indexOf(',') - 1) * 3) / 4 <= this.cfg.IMAGE_MAX_BYTES) return url;
    }
    return url; // 그래도 크면 프록시가 거부합니다
  }
}
