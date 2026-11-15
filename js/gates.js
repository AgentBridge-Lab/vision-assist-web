// @ts-check
/**
 * 5중 게이트 (기획서 v2 2-2절).
 * 관찰은 자주, 호출은 드물게. 이 파일은 DOM을 쓰지 않으므로 Node에서도 그대로 시험할 수 있습니다.
 *
 * @typedef {'ok'|'dark'|'blur'} Quality
 * @typedef {{brightness:number, sharpness:number, hash:bigint}} FrameMetrics
 * @typedef {{quality:Quality, stable:boolean, stableMs:number, movingMs:number, changed:boolean,
 *            hash:bigint, brightness:number, sharpness:number, motion:number}} Observation
 * @typedef {'quality'|'unstable'|'unchanged'|'cooldown'|'inflight'|'session'} BlockReason
 */

const N = 32; // 지각 해시용 축소 크기
const COS = (() => {
  // 8개 저주파 × 32 위치의 DCT-II 코사인 표
  const t = new Float64Array(8 * N);
  for (let u = 0; u < 8; u++) for (let x = 0; x < N; x++) t[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
  return t;
})();

/**
 * 64비트 지각 해시(pHash). 64×64 흑백 → 32×32 평균 → DCT 저주파 8×8 → 중앙값 기준 0/1.
 * 저주파 계수는 화면 전체 평균이라 센서 잡음에 잘 흔들리지 않습니다.
 * @param {Uint8Array|Uint8ClampedArray} gray 길이 size*size
 * @param {number} size
 * @returns {bigint}
 */
export function perceptualHash(gray, size = 64) {
  const step = size / N;
  const small = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0;
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) s += gray[(y * step + dy) * size + x * step + dx];
    small[y * N + x] = s / (step * step);
  }
  // 행 방향 DCT(저주파 8개) 후 열 방향
  const rows = new Float64Array(N * 8);
  for (let y = 0; y < N; y++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += small[y * N + x] * COS[u * N + x];
    rows[y * 8 + u] = s;
  }
  const coef = new Float64Array(64);
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += rows[y * 8 + u] * COS[v * N + y];
    coef[v * 8 + u] = s;
  }
  const sorted = Array.from(coef.subarray(1)).sort((a, b) => a - b); // DC 제외 63개
  const median = sorted[31];
  let h = 0n;
  for (let i = 0; i < 64; i++) h = (h << 1n) | (coef[i] > median ? 1n : 0n);
  return h;
}

/** @param {bigint} a @param {bigint} b @returns {number} 다른 비트 수 */
export function hamming(a, b) {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

/**
 * 축소 프레임 한 장의 밝기·선명도·해시.
 * @param {Uint8Array|Uint8ClampedArray} gray @param {number} size @returns {FrameMetrics}
 */
export function analyzeFrame(gray, size = 64) {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const brightness = sum / gray.length;
  // 선명도: 라플라시안의 분산
  let ls = 0, ls2 = 0, n = 0;
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x;
    const l = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - size] - gray[i + size];
    ls += l; ls2 += l * l; n++;
  }
  const sharpness = ls2 / n - (ls / n) ** 2;
  return { brightness, sharpness, hash: perceptualHash(gray, size) };
}

/** 두 축소 프레임의 평균 절대 차(0~255). */
export function frameDiff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

export class GateKeeper {
  /**
   * @param {typeof import('./config.js').CONFIG} cfg
   * @param {'object'|'scene'|'doc'} mode
   */
  constructor(cfg, mode) {
    this.cfg = cfg;
    this.mode = mode;
    /** @type {Uint8Array|Uint8ClampedArray|null} */ this.prev = null;
    this.stableSince = /** @type {number|null} */ (null);
    this.movingSince = /** @type {number|null} */ (null);
    this.lastSentHash = /** @type {bigint|null} */ (null);
    this.lastCallAt = -Infinity;
    this.inFlight = 0;
    this.sessionCalls = 0;
  }

  /** 관찰 한 번(0.5초마다). 호출 없이 기기에서만 계산합니다. @returns {Observation} */
  observe(gray, now) {
    const c = this.cfg;
    const m = analyzeFrame(gray, c.SAMPLE_SIZE);
    const motion = this.prev ? frameDiff(gray, this.prev) : Infinity;
    this.prev = gray;
    if (motion <= c.MOTION_DIFF_MAX) {
      if (this.stableSince === null) this.stableSince = now;
      this.movingSince = null;
    } else {
      this.stableSince = null;
      if (this.movingSince === null) this.movingSince = now;
    }
    const stableMs = this.stableSince === null ? 0 : now - this.stableSince;
    const movingMs = this.movingSince === null ? 0 : now - this.movingSince;
    /** @type {Quality} */
    const quality = m.brightness < c.QUALITY_MIN_BRIGHTNESS ? 'dark'
      : m.sharpness < c.QUALITY_MIN_SHARPNESS ? 'blur' : 'ok';
    const changed = this.lastSentHash === null || hamming(m.hash, this.lastSentHash) >= c.CHANGE_HAMMING_MIN;
    return { quality, stable: stableMs >= c.STABLE_MS, stableMs, movingMs, changed,
      hash: m.hash, brightness: m.brightness, sharpness: m.sharpness, motion };
  }

  /**
   * 게이트 1~5 직렬 판정. "다시 확인"은 skipChange·skipCooldown·skipStable로 게이트 2~4를 건너뛰고
   * 게이트 1(품질)·5(상한)는 유지합니다(3-3절 8번).
   * @param {Observation} obs
   * @param {number} now
   * @param {{skipStable?:boolean, skipChange?:boolean, skipCooldown?:boolean}} [opt]
   * @returns {{ok:true}|{ok:false, reason:BlockReason}}
   */
  canCall(obs, now, opt = {}) {
    const c = this.cfg;
    if (obs.quality !== 'ok') return { ok: false, reason: 'quality' };
    if (!opt.skipStable && !obs.stable) return { ok: false, reason: 'unstable' };
    if (!opt.skipChange && !obs.changed) return { ok: false, reason: 'unchanged' };
    if (!opt.skipCooldown && now - this.lastCallAt < c.COOLDOWN_MS[this.mode]) return { ok: false, reason: 'cooldown' };
    if (this.inFlight >= c.MAX_INFLIGHT) return { ok: false, reason: 'inflight' };
    if (this.mode !== 'doc' && this.sessionCalls >= c.SESSION_CALL_LIMIT) return { ok: false, reason: 'session' };
    return { ok: true };
  }

  /** 호출 시작 기록. hash가 null이면(고정된 사진 재사용) 변화 게이트 기준은 바꾸지 않습니다. */
  markSent(hash, now) {
    if (hash !== null) this.lastSentHash = hash;
    this.lastCallAt = now;
    this.inFlight++;
    this.sessionCalls++;
  }

  /** 기기 안에서 처리한 프레임(OCR) 기록: 변화·쿨다운 기준만 갱신하고 호출 수에는 넣지 않습니다. */
  markLocal(hash, now) { this.lastSentHash = hash; this.lastCallAt = now; }

  markDone() { this.inFlight = Math.max(0, this.inFlight - 1); }

  /**
   * 낡은 응답 판정(2-2절 발화 억제). 응답 도착 시점의 장면이 요청 시점과 문턱 이상 다르거나 시간이 지났으면 true.
   * @param {bigint} reqHash @param {number} reqAt @param {bigint} curHash @param {number} now
   */
  isStale(reqHash, reqAt, curHash, now) {
    return now - reqAt > this.cfg.STALE_MS || hamming(reqHash, curHash) >= this.cfg.CHANGE_HAMMING_MIN;
  }

  /** 다음 판정에서 변화 게이트가 통과되도록 기준을 지웁니다(오류 뒤 새 프레임 재시도용). */
  forgetLastSent() { this.lastSentHash = null; }

  /** 새 세션(재개 버튼). */
  resetSession() { this.sessionCalls = 0; }

  /** 일시정지 뒤 재개: 안정 시간을 처음부터 다시 잽니다. */
  resetMotion() { this.prev = null; this.stableSince = null; this.movingSince = null; }
}
