// @ts-check
/**
 * 음성 출력: Web Speech 음성 합성, 발화 대기열(최대 1건), 조작 중 보류, 효과음 (기획서 v2 2-2절, 3-3절, 3-4절).
 *
 * 발화는 두 종류입니다.
 *  - 직접 발화(auto: false): 사용자가 버튼을 누른 동작 안에서 바로 말합니다. 진행 중인 발화를 끊고 시작합니다.
 *  - 자동 발화(auto: true): 설명·상태·오류처럼 앱이 스스로 말하는 것. 사용자가 화면을 만지는 동안과 그 뒤 2초는 말하지 않고,
 *    대기열은 1건뿐이라 새 것이 오면 아직 말하지 않은 이전 것은 버립니다(우선순위가 낮은 새 것은 스스로 버려짐).
 *
 * @typedef {'app'|'screenreader'|'silent'} OutputMode
 * @typedef {(ok:boolean, reason:string)=>void} OnEnd  reason: done|touch|replaced|dropped|cancel|silent|nostart|error
 * @typedef {{parts:string[], auto:boolean, priority:number, onend?:OnEnd, clearWatch?:()=>void}} Item
 */

export class Speech {
  /**
   * @param {typeof import('./config.js').CONFIG} cfg
   * @param {{get:(k:string, d:any)=>any, set:(k:string, v:any)=>void}} store
   */
  constructor(cfg, store) {
    this.cfg = cfg;
    this.store = store;
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    /** @type {OutputMode} */ this.outputMode = store.get('outputMode', 'app');
    this.muted = !!store.get('muted', false);
    this.rateIndex = clampIndex(store.get('rateIndex', cfg.RATE_DEFAULT_INDEX), cfg.RATE_STEPS.length);
    this.volumeIndex = clampIndex(store.get('volumeIndex', cfg.VOLUME_DEFAULT_INDEX), cfg.VOLUME_STEPS.length);
    /** @type {Item|null} */ this.current = null;
    /** @type {Item|null} */ this.pending = null;
    this.holdUntil = 0;
    this._flushTimer = 0;
    this._waitTimer = 0;
    /** @type {AudioContext|null} */ this.audio = null;
    this._utter = null; // 발화 객체가 도중에 회수되어 이벤트가 사라지는 브라우저 문제를 피하려고 붙잡아 둠
  }

  /** 앱이 직접 소리 내어 말하는 상태인가. 아니면 글자 영역(알림 영역)만 갱신됩니다. */
  get voiceOn() { return !!this.synth && this.outputMode === 'app' && !this.muted; }

  /** 사용자 동작 안에서 한 번 불러 효과음 재생을 개통합니다. */
  unlock() {
    try {
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!this.audio && AC) this.audio = new AC();
      if (this.audio && this.audio.state === 'suspended') this.audio.resume();
    } catch { /* 효과음은 없어도 동작합니다 */ }
  }

  /**
   * @param {string} text
   * @param {{auto?:boolean, priority?:number, onend?:OnEnd}} [opt] priority: 오류 3, 설명 2, 상태 1
   */
  speak(text, opt = {}) {
    /** @type {Item} */
    const item = { parts: splitForSpeech(text), auto: !!opt.auto, priority: opt.priority ?? 1, onend: opt.onend };
    if (!this.voiceOn || !item.parts.length) { queueMicrotask(() => item.onend && item.onend(false, 'silent')); return; }
    if (!item.auto) {
      this._dropPending('replaced');
      this._interrupt('replaced');
      this._start(item);
      return;
    }
    if (this.pending && this.pending.priority > item.priority) { queueMicrotask(() => item.onend && item.onend(false, 'dropped')); return; }
    const old = this.pending;
    this.pending = item;
    if (old && old.onend) old.onend(false, 'dropped');
    if (item.priority >= 3) this._interrupt('replaced'); // 오류·일시정지 안내는 진행 중인 발화를 끊고 먼저 말합니다(조작 중 보류는 그대로)
    this._tryFlush();
  }

  /** 진행 중·대기 중 발화를 모두 멈춥니다(일시정지·종료·소리 끄기). */
  cancel(reason = 'cancel') {
    this._dropPending(reason);
    this._interrupt(reason);
  }

  /** 사용자가 화면을 만짐: 진행 중 발화 즉시 중단, 마지막 조작 후 TOUCH_HOLD_MS 동안 자동 발화 보류 (3-4절). */
  noteUserTouch() {
    this.holdUntil = performance.now() + this.cfg.TOUCH_HOLD_MS;
    this._interrupt('touch');
    this._tryFlush();
  }

  _dropPending(reason) {
    const p = this.pending;
    this.pending = null;
    if (p && p.onend) p.onend(false, reason);
  }

  _interrupt(reason) {
    const c = this.current;
    if (!c) return;
    this.current = null;
    if (c.clearWatch) c.clearWatch();
    if (this.synth) this.synth.cancel();
    if (c.onend) c.onend(false, reason);
  }

  _tryFlush() {
    clearTimeout(this._flushTimer);
    if (!this.pending || this.current) return;
    const wait = this.holdUntil - performance.now();
    if (wait > 0) { this._flushTimer = window.setTimeout(() => this._tryFlush(), wait + 20); return; }
    const p = this.pending;
    this.pending = null;
    if (!this.voiceOn) { if (p.onend) p.onend(false, 'silent'); return; }
    this._start(p);
  }

  /** @param {Item} item */
  _start(item) {
    this.current = item;
    this._speakPart(item, 0);
  }

  /** 긴 글은 문장 단위 발화로 나눠 차례로 말합니다(긴 발화가 도중에 끊기는 브라우저 문제 회피). */
  _speakPart(item, i) {
    if (this.current !== item || !this.synth) return;
    if (i >= item.parts.length) { this._finish(item, true, 'done'); return; }
    const u = new SpeechSynthesisUtterance(item.parts[i]);
    u.lang = 'ko-KR';
    const voice = this.synth.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('ko'));
    if (voice) u.voice = voice;
    u.rate = this.cfg.RATE_STEPS[this.rateIndex];
    u.volume = this.cfg.VOLUME_STEPS[this.volumeIndex];
    let started = false;
    const watch = window.setTimeout(() => {
      if (!started && this.current === item) { if (this.synth) this.synth.cancel(); this._finish(item, false, 'nostart'); }
    }, this.cfg.SPEECH_START_TIMEOUT_MS);
    item.clearWatch = () => clearTimeout(watch);
    u.onstart = () => { started = true; clearTimeout(watch); };
    u.onend = () => { clearTimeout(watch); if (this.current === item) this._speakPart(item, i + 1); };
    u.onerror = () => { clearTimeout(watch); if (this.current === item) this._finish(item, false, 'error'); };
    this._utter = u;
    this.synth.speak(u);
  }

  _finish(item, ok, reason) {
    if (this.current === item) this.current = null;
    if (item.clearWatch) item.clearWatch();
    if (item.onend) item.onend(ok, reason);
    this._tryFlush();
  }

  // ── 실행 화면에 항상 보이는 조절 버튼 (3-3절 11~13번) ───────────────────
  /** @param {1|-1} dir @returns {boolean} 바뀌었으면 true */
  changeRate(dir) {
    const next = this.rateIndex + dir;
    if (next < 0 || next >= this.cfg.RATE_STEPS.length) return false;
    this.rateIndex = next;
    this.store.set('rateIndex', next);
    return true;
  }

  /** @param {1|-1} dir @returns {boolean} */
  changeVolume(dir) {
    const next = this.volumeIndex + dir;
    if (next < 0 || next >= this.cfg.VOLUME_STEPS.length) return false;
    this.volumeIndex = next;
    this.store.set('volumeIndex', next);
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    this.store.set('muted', muted);
    if (muted) { this.cancel(); this.stopWaiting(); }
  }

  /** @param {OutputMode} mode */
  setOutputMode(mode) {
    this.outputMode = mode;
    this.store.set('outputMode', mode);
    if (mode !== 'app') this.cancel();
  }

  // ── 비언어 신호 (3-4절): 침묵이 고장인지 대기인지 구분 ──────────────────
  /** @param {'capture'|'wait'} kind */
  earcon(kind) {
    if (this.muted) return;
    if (kind === 'capture' && navigator.vibrate) { try { navigator.vibrate(30); } catch { /* 되는 기기에서만 */ } }
    const ac = this.audio;
    if (!ac || ac.state !== 'running') return;
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.frequency.value = kind === 'capture' ? 880 : 220;
    const vol = 0.2 * this.cfg.VOLUME_STEPS[this.volumeIndex];
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.13);
  }

  /** 분석 대기 중: WAIT_EARCON_MS마다 낮은 효과음. 응답이 오면 stopWaiting(). */
  startWaiting() {
    this.stopWaiting();
    this._waitTimer = window.setInterval(() => this.earcon('wait'), this.cfg.WAIT_EARCON_MS);
  }

  stopWaiting() { clearInterval(this._waitTimer); this._waitTimer = 0; }
}

function clampIndex(i, len) {
  const n = Number.isInteger(i) ? i : 0;
  return Math.min(len - 1, Math.max(0, n));
}

/** 문장 단위로 나눕니다. */
function splitForSpeech(text) {
  return String(text || '').split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
