// @ts-check
/**
 * 화면 전환·초기화·모드 실행 (기획서 v2 3절, 4절).
 * 이 파일이 하는 일: 버튼과 상태를 잇고, 게이트 판정에 따라 호출하고, 결과를 "말하기 + 글자 영역"에 동시에 내보냅니다.
 */
import { CONFIG } from './config.js';
import * as P from './phrases.js';
import { Camera, CameraError } from './camera.js';
import { GateKeeper, analyzeFrame } from './gates.js';
import { Speech } from './speech.js';
import { Ocr } from './ocr.js';
import { describe, ApiError, newId } from './api.js';

/** @param {string} id @returns {any} */
const $ = (id) => document.getElementById(id);

// ── 기기에 기억하는 값 (계정 없음. 브라우저 저장소만 사용) ─────────────────
const store = {
  get(k, d) { try { const v = localStorage.getItem('va.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('va.' + k, JSON.stringify(v)); } catch { /* 저장이 막혀도 동작은 계속 */ } },
};
if (!store.get('deviceId', '')) store.set('deviceId', newId());
const deviceId = store.get('deviceId', '') || newId();

const speech = new Speech(CONFIG, store);
const camera = new Camera($('preview'), CONFIG);
const ocr = new Ocr(CONFIG);

/** @typedef {'object'|'scene'|'doc'} Mode */
const S = {
  /** @type {Mode|null} */ mode: null,
  /** @type {'idle'|'starting'|'running'|'paused'} */ phase: 'idle',
  runId: 0,                 // 모드 실행·일시정지마다 올려, 늦게 온 응답을 버리는 데 씁니다
  sessionId: newId(),
  /** @type {GateKeeper|null} */ gate: null,
  /** @type {import('./gates.js').Observation|null} */ obs: null,
  timer: 0,
  /** @type {AbortController|null} */ abort: null,
  lastInteractionAt: 0,
  startedAt: 0,
  // 물건·주변
  fixed: false,
  /** @type {string|null} */ fixedImage: null,
  /** @type {string|null} */ lastImage: null,
  /** @type {import('./phrases.js').Composed|null} */ last: null,
  recheckCount: 0,
  forceNext: false,         // 오류 뒤 새 프레임으로 한 번 다시 보낼 때 변화 게이트를 건너뜀
  /** @type {'limit_device'|'limit_budget'|null} */ cloudBlocked: null,
  cloudHalted: false,       // 재시도까지 실패해 자동 호출을 멈춘 상태
  cloudHoldUntil: 0,
  netDown: false,
  retried: { service: false, format: false, network: false },
  // 안내를 한 번만 하기 위한 표시
  noticed: { frameWait: false, noChange: false, moving: false, wakeLock: false, remainingDay: '' },
  lastSendAt: 0,
  quality: { badSince: 0, kind: '', lastNoticeAt: -Infinity, streak: 0 },
  /** @type {any} */ wakeLock: null,
  guidePending: !store.get('guideDone', false),
};

const doc = {
  fixed: false, busy: false, reading: false, failed: false,
  /** @type {string[]} */ sentences: [],
  idx: 0, rawText: '',
  /** @type {string|null} */ image: null,
  confirm: { kind: '', until: 0 },
};

const settings = {
  /** @type {'one'|'normal'|'detail'} */ length: store.get('length', 'one'),
  fontIndex: Math.min(CONFIG.FONT_STEPS.length - 1, Math.max(0, store.get('fontIndex', CONFIG.FONT_DEFAULT_INDEX))),
  /** @type {'basic'|'sharp'} */ theme: store.get('theme', 'basic'),
};

// ── 출력: 말하기와 글자 영역 (3-4절) ────────────────────────────────────────
/**
 * 알림 영역 속성을 음성 출력 방식에 맞춥니다.
 * - 앱 음성: 앱이 직접 말하므로 알림 영역을 꺼서 화면읽기가 같은 내용을 겹쳐 읽지 않게 합니다(글자는 그대로 갱신).
 * - 화면읽기에 맡기기 / 소리 없이 글자만 / 소리 끄기: 상태·설명은 공손한 알림, 오류는 즉시 알림.
 */
function applyLiveRegions() {
  const live = !speech.voiceOn;
  const set = (el, role, mode) => {
    if (live) { el.setAttribute('role', role); el.setAttribute('aria-live', mode); }
    else { el.setAttribute('aria-live', 'off'); if (role === 'region') el.setAttribute('role', 'region'); else el.removeAttribute('role'); }
  };
  set($('status'), 'status', 'polite');
  set($('select-status'), 'status', 'polite');
  set($('result'), 'region', 'polite');
  set($('error'), 'alert', 'assertive');
}

/**
 * 상태 문구를 화면에 쓰고, 필요하면 말합니다.
 * @param {string} text
 * @param {{say?:'now'|'auto'|'none', priority?:number}} [opt] now: 사용자 동작 안에서 바로 / auto: 조작이 끝난 뒤
 */
function setStatus(text, opt = {}) {
  const el = S.mode ? $('status') : $('select-status');
  el.textContent = text;
  const say = opt.say || 'auto';
  if (say === 'now') speech.speak(text);
  else if (say === 'auto') speech.speak(text, { auto: true, priority: opt.priority ?? 1 });
}

/** 설명을 글자 영역에 표시합니다. 음성과 같은 내용을 같은 시점에(D-9). @param {import('./phrases.js').Line[]} lines */
function renderResult(lines) {
  const box = $('result');
  delete box.dataset.doc;
  box.replaceChildren(...lines.map((l) => {
    const p = document.createElement('p');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = l.label;
    p.append(label, document.createTextNode(l.text));
    return p;
  }));
}

/** 설명 한 건을 내보냅니다(글자 영역 + 음성). @param {import('./phrases.js').Composed} c */
function present(c, opt = { auto: true }) {
  S.last = c;
  renderResult(c.lines);
  if (opt.auto) speech.speak(c.speech, { auto: true, priority: 2 });
  else speech.speak(c.speech);
}

// ── 오류 (4-1절): 종류마다 따로 처리. 정상 설명 경로와 섞지 않습니다 ────────
function showError(kind, opt = {}) {
  const text = P.ERRORS[kind] || P.ERRORS.service;
  $('error-text').textContent = text;
  $('error').hidden = false;
  $('btn-camera-retry').hidden = !opt.cameraRetry;
  $('btn-retry-same').hidden = !opt.retrySame;
  speech.stopWaiting();
  speech.speak(text, { auto: true, priority: 3 });
}

function clearError() {
  $('error').hidden = true;
  $('error-text').textContent = '';
  $('btn-camera-retry').hidden = true;
  $('btn-retry-same').hidden = true;
}

/** 1) 카메라 오류 @param {import('./camera.js').CameraErrorKind} kind */
function onCameraError(kind) {
  S.phase = 'idle';
  stopLoop();
  showError('camera_' + kind, { cameraRetry: kind === 'denied' || kind === 'busy' || kind === 'notfound' });
}

/** 2) 네트워크 오류: 연결이 돌아오면 새 프레임으로 한 번. 낡은 사진은 자동으로 다시 보내지 않습니다 */
function onNetworkError(auto) {
  S.netDown = true;
  showError('network', { retrySame: S.mode !== 'doc' });
  if (!auto) return;
  const runId = S.runId;
  if (navigator.onLine && !S.retried.network) {
    // 브라우저는 온라인이라고 하지만 프록시에 닿지 않은 경우: 잠시 뒤 새 프레임으로 1회
    S.retried.network = true;
    setTimeout(() => { if (runId === S.runId && S.netDown) resumeAfterNetwork(); }, CONFIG.NETWORK_RETRY_MS);
  }
}

function resumeAfterNetwork() {
  if (!S.netDown) return;
  S.netDown = false;
  S.forceNext = true; // 새 프레임으로
  if (S.gate) S.gate.forgetLastSent();
}

/** 서비스 장애: 5초 뒤 1회만 */
function onServiceError(auto, retry) {
  showError('service');
  if (S.retried.service) { S.cloudHalted = true; return; }
  S.retried.service = true;
  const runId = S.runId;
  S.cloudHoldUntil = performance.now() + CONFIG.SERVICE_RETRY_MS;
  setTimeout(() => {
    if (runId !== S.runId || S.phase !== 'running') return;
    if (auto) { S.forceNext = true; if (S.gate) S.gate.forgetLastSent(); } else retry();
  }, CONFIG.SERVICE_RETRY_MS);
}

/** 3) 한도 소진: 개인 한도와 전체 예산을 구분. 마지막 설명과 "다시 듣기"는 남깁니다(4-3절) */
function onLimitError(kind) {
  S.cloudBlocked = kind;
  showError(kind);
}

function sessionLimitPause() {
  pause('session');
}

// ── 화면 전환 ───────────────────────────────────────────────────────────────
// 코드가 옮긴 초점은 "사용자가 만짐"이 아니므로 발화를 끊지 않게 구분합니다
let programmaticFocus = false;
function focusEl(el) {
  programmaticFocus = true;
  try { el.focus(); } finally { programmaticFocus = false; }
}

function showScreen(run) {
  $('screen-select').hidden = run;
  $('screen-run').hidden = !run;
}

/** 모드 시작. 사용자의 버튼 동작 안에서 첫 안내를 말해 음성을 개통합니다(1-5절). @param {Mode} mode */
function startMode(mode) {
  speech.unlock();
  S.mode = mode;
  S.phase = 'starting';
  S.runId++;
  S.sessionId = newId();
  S.gate = new GateKeeper(CONFIG, mode);
  S.fixed = false; S.fixedImage = null; S.lastImage = null; S.last = null; S.recheckCount = 0;
  S.cloudBlocked = null; S.cloudHalted = false; S.netDown = false; S.forceNext = false; S.cloudHoldUntil = 0;
  resetDoc();
  $('run-title').textContent = P.MODES[mode].name;
  $('controls-cloud').hidden = mode === 'doc';
  $('controls-doc').hidden = mode !== 'doc';
  $('result').replaceChildren();
  clearError();
  updateButtons();
  showScreen(true);
  focusEl($('btn-pause')); // 초점 이동을 먼저 하고 말합니다(초점 이동이 발화를 끊지 않게)

  let text = P.STATUS.start[mode];
  $('status').textContent = text;
  if (S.guidePending) {
    // 첫 방문: 사용 안내 네 문장을 한 번만. 설정 단계 없이 모드 버튼을 누른 그 동작에 이어서 말합니다(3-1절 6번)
    text += ' ' + P.GUIDE.join(' ');
    S.guidePending = false;
    store.set('guideDone', true);
  }
  speech.speak(text);

  if (mode === 'doc') prepareOcr();
  startCamera();
}

async function startCamera() {
  const runId = S.runId;
  try {
    await camera.start();
  } catch (e) {
    if (runId !== S.runId) return;
    onCameraError(e instanceof CameraError ? e.kind : 'busy');
    return;
  }
  if (runId !== S.runId) { camera.stop(); return; }
  clearError();
  beginRunning();
}

function beginRunning() {
  S.phase = 'running';
  S.lastInteractionAt = S.startedAt = performance.now();
  S.lastSendAt = S.startedAt;
  S.noticed.frameWait = S.noticed.noChange = S.noticed.moving = false;
  S.quality = { badSince: 0, kind: '', lastNoticeAt: -Infinity, streak: 0 };
  S.retried = { service: false, format: false, network: false };
  if (S.gate) S.gate.resetMotion();
  updateButtons();
  requestWakeLock();
  stopLoop();
  S.timer = window.setInterval(tick, CONFIG.OBSERVE_INTERVAL_MS);
}

function stopLoop() { clearInterval(S.timer); S.timer = 0; }

async function requestWakeLock() {
  try {
    const wl = /** @type {any} */ (navigator).wakeLock;
    if (!wl) throw new Error('no wake lock');
    S.wakeLock = await wl.request('screen');
  } catch {
    if (!S.noticed.wakeLock) { S.noticed.wakeLock = true; setStatus(P.STATUS.wakeLockDenied); }
  }
}

function releaseWakeLock() {
  try { if (S.wakeLock) S.wakeLock.release(); } catch { /* 이미 풀림 */ }
  S.wakeLock = null;
}

/** 일시정지: 관찰·호출·낭독 모두 정지, 진행 중 발화 즉시 중단 (3-3절 1번) */
function pause(reason) {
  if (S.phase !== 'running' && S.phase !== 'starting') return;
  S.phase = 'paused';
  S.runId++;
  stopLoop();
  if (S.abort) S.abort.abort();
  speech.stopWaiting();
  speech.cancel();
  doc.reading = false;
  releaseWakeLock();
  updateButtons();
  if (reason === 'user') setStatus(P.STATUS.paused, { say: 'now' });
  else if (reason === 'idle') setStatus(P.STATUS.idlePaused, { priority: 3 });
  else if (reason === 'session') setStatus(P.STATUS.sessionLimit(CONFIG.SESSION_CALL_LIMIT), { priority: 3 });
  else if (reason === 'hidden') $('status').textContent = P.STATUS.returned; // 돌아왔을 때 보이도록 미리 써 둠
}

function resume() {
  if (S.phase !== 'paused') return;
  S.runId++;
  // 세션 상한에 걸려 멈췄던 경우 재개 버튼이 새 세션입니다(2-4절)
  if (S.gate && S.gate.sessionCalls >= CONFIG.SESSION_CALL_LIMIT) { S.gate.resetSession(); S.sessionId = newId(); }
  S.cloudHalted = false;
  setStatus(P.STATUS.resumed, { say: 'now' });
  if (!camera.ready) { S.phase = 'starting'; startCamera(); return; }
  beginRunning();
  if (S.mode === 'doc' && doc.fixed && doc.sentences.length) { doc.reading = true; docSpeakCurrent(); }
}

/** 종료: 카메라를 끄고 모드 선택 화면으로. 초점은 방금 쓴 모드 버튼으로 (3-3절 2번) */
function stopMode() {
  const mode = S.mode;
  S.runId++;
  S.phase = 'idle';
  stopLoop();
  if (S.abort) S.abort.abort();
  speech.stopWaiting();
  speech.cancel();
  camera.stop();
  releaseWakeLock();
  resetDoc();
  S.mode = null;
  showScreen(false);
  if (mode) focusEl($('btn-mode-' + mode));
  setStatus(P.STATUS.stopped, { say: 'now' });
}

function updateButtons() {
  $('btn-pause').textContent = S.phase === 'paused' ? '다시 시작' : '일시정지';
  $('btn-fix').textContent = S.fixed ? '고정 풀기' : '고정';
  $('btn-fix').setAttribute('aria-pressed', String(S.fixed));
  $('btn-mute').textContent = speech.muted ? '소리 켜기' : '소리 끄기';
  $('btn-mute').setAttribute('aria-pressed', String(speech.muted));
}

// ── 관찰 주기 (2-2절): 0.5초마다 기기 안에서만 계산 ─────────────────────────
function tick() {
  if (S.phase !== 'running' || !S.gate) return;
  const now = performance.now();
  // 방치 방지: 조작 없이 3분이면 자동 일시정지
  if (now - S.lastInteractionAt > CONFIG.IDLE_PAUSE_MS) { pause('idle'); return; }
  const gray = camera.sampleGray();
  if (!gray) return;
  if (camera.checkAlive(gray, now) === 'stalled') { onCameraStalled(); return; }
  // 고정 중에는 자동 관찰을 멈춥니다
  if (S.mode === 'doc' ? (doc.fixed || doc.busy) : S.fixed) return;

  const obs = S.gate.observe(gray, now);
  S.obs = obs;

  // 4) 사진 품질(전송 전, 게이트 1): 원인과 조치를 함께 말하고 계속 관찰
  if (obs.quality !== 'ok') { qualityNotice(obs.quality, now); return; }
  S.quality.badSince = 0;

  if (obs.stable) {
    S.noticed.moving = false;
  } else {
    // 프레임 대기: 시작 후 5초간 안정 프레임이 없을 때 1회
    if (!S.noticed.frameWait && S.lastSendAt === S.startedAt && now - S.startedAt > CONFIG.FRAME_WAIT_NOTICE_MS) {
      S.noticed.frameWait = true;
      setStatus(P.STATUS.frameWait);
    }
    // 주변 살펴보기: 움직임이 3초 이상 이어지면 한 번 알리고 호출하지 않음(정지 상태 한정)
    if (S.mode === 'scene' && !S.noticed.moving && obs.movingMs >= CONFIG.SCENE_MOVING_NOTICE_MS) {
      S.noticed.moving = true;
      setStatus(P.STATUS.sceneMoving);
    }
    return;
  }

  if (S.mode === 'doc') {
    if (S.gate.canCall(obs, now).ok) runOcr();
    return;
  }

  // 클라우드 호출을 쉬는 상태(한도·장애·네트워크)에서는 관찰만 계속
  if (S.cloudBlocked || S.cloudHalted || S.netDown || now < S.cloudHoldUntil) return;

  const verdict = S.gate.canCall(obs, now, { skipChange: S.forceNext });
  if (verdict.ok) {
    S.forceNext = false;
    requestDescription({ auto: true });
  } else if (verdict.reason === 'session') {
    sessionLimitPause();
  } else if (verdict.reason === 'unchanged' && !S.noticed.noChange && now - S.lastSendAt > CONFIG.NO_CHANGE_NOTICE_MS) {
    // 방치 방지: 60초 동안 변화가 없으면 한 번만 말하고 관찰만 계속
    S.noticed.noChange = true;
    setStatus(P.STATUS.noChange);
  }
}

/** 품질 안내의 반복 방지 (4-2절): 같은 안내는 10초 안에 반복하지 않고, 세 번 연속되면 안내를 바꿉니다 */
function qualityNotice(kind, now) {
  const q = S.quality;
  if (q.kind !== kind) { q.kind = kind; q.badSince = now; q.streak = 0; }
  if (!q.badSince) q.badSince = now;
  if (now - q.badSince < CONFIG.QUALITY_HOLD_MS) return;
  if (now - q.lastNoticeAt < CONFIG.QUALITY_REPEAT_MS) return;
  q.lastNoticeAt = now;
  q.streak++;
  const text = kind === 'blur' && q.streak >= CONFIG.QUALITY_ESCALATE_COUNT ? P.QUALITY.blurRepeated : P.QUALITY[kind];
  setStatus(text);
}

/** 카메라 정지(권한은 있음): 재연결 1회 (4-1절) */
async function onCameraStalled() {
  const runId = S.runId;
  stopLoop();
  try {
    await camera.start();
    if (runId !== S.runId) return;
    setStatus(P.STATUS.cameraReconnected);
    S.timer = window.setInterval(tick, CONFIG.OBSERVE_INTERVAL_MS);
    if (S.gate) S.gate.resetMotion();
  } catch {
    if (runId !== S.runId) return;
    S.phase = 'paused';
    updateButtons();
    showError('camera_stalled');
  }
}

// ── 물건 설명·주변 살펴보기: 호출 ───────────────────────────────────────────
function startWaitSignals() {
  speech.earcon('capture'); // 사진 확보: 효과음만. "성공"이라는 말을 쓰지 않습니다(4-5절 1번)
  speech.startWaiting();
  const runId = S.runId;
  const t1 = setTimeout(() => { if (runId === S.runId) setStatus(P.STATUS.analyzing); }, CONFIG.ANALYZING_NOTICE_MS);
  const t2 = setTimeout(() => { if (runId === S.runId) setStatus(P.STATUS.slow); }, CONFIG.SLOW_NOTICE_MS);
  return () => { clearTimeout(t1); clearTimeout(t2); speech.stopWaiting(); };
}

/**
 * 설명 요청 한 건.
 * @param {{auto?:boolean, detail?:boolean, question?:string, recheck?:boolean, image?:string|null,
 *          kind?:'doc_read'|'doc_summary', text?:string}} opt
 *   auto: 게이트를 통과한 자동 호출 / image: 고정된 사진·직전 사진 재사용(없으면 새 프레임)
 */
async function requestDescription(opt = {}) {
  const gate = S.gate;
  if (!gate || !S.mode) return;
  const auto = !!opt.auto;
  if (S.phase !== 'running') { if (!auto) setStatus(P.STATUS.returned, { say: 'now' }); return; }
  if (gate.inFlight >= CONFIG.MAX_INFLIGHT) { if (!auto) setStatus(P.STATUS.busy, { say: 'now' }); return; }
  if (S.cloudBlocked) { showError(S.cloudBlocked); return; }
  if (gate.sessionCalls >= CONFIG.SESSION_CALL_LIMIT) { sessionLimitPause(); return; }

  const liveFrame = !opt.image && opt.kind !== 'doc_summary';
  const image = opt.kind === 'doc_summary' ? undefined : (opt.image || camera.grabJpeg() || undefined);
  if (opt.kind !== 'doc_summary' && !image) return;
  const sentAt = performance.now();
  const reqHash = liveFrame && S.obs ? S.obs.hash : null;
  gate.markSent(reqHash, sentAt);
  S.lastSendAt = sentAt;
  S.noticed.noChange = false;
  if (image && opt.kind === undefined) S.lastImage = image;
  const stopSignals = startWaitSignals();
  const ctrl = new AbortController();
  S.abort = ctrl;
  const runId = S.runId;
  const prev = S.last;

  let out;
  try {
    out = await describe({
      mode: opt.kind || /** @type {'object'|'scene'} */ (S.mode),
      deviceId, sessionId: S.sessionId, image, text: opt.text,
      detail: !!opt.detail || settings.length === 'detail',
      recheck: !!opt.recheck, question: opt.question || undefined,
      prevSummary: prev && prev.subject ? prev.subject : undefined,
    }, ctrl.signal);
  } catch (e) {
    stopSignals(); gate.markDone(); if (S.abort === ctrl) S.abort = null;
    const kind = e instanceof ApiError ? e.kind : 'service';
    if (kind === 'aborted' || runId !== S.runId) return;
    // 발생 지점에서 정해진 종류대로 분기 (4-1절)
    if (kind === 'network') onNetworkError(auto);
    else if (kind === 'limit_device' || kind === 'limit_budget') onLimitError(kind);
    else if (kind === 'limit_session') sessionLimitPause();
    else if (kind === 'format' && !S.retried.format) { S.retried.format = true; requestDescription({ ...opt, image: image || null }); } // 1회 재시도, 내용은 낭독하지 않음
    else onServiceError(auto, () => requestDescription({ ...opt, image: image || null }));
    return;
  }
  stopSignals(); gate.markDone(); if (S.abort === ctrl) S.abort = null;
  if (runId !== S.runId || S.phase !== 'running') return; // 일시정지·종료 뒤에 온 응답은 버림

  clearError();
  S.retried = { service: false, format: false, network: false };
  S.netDown = false;
  noteRemaining(out.limits);
  const r = out.result;

  // 낡은 답은 버립니다(2-2절, 4-5절 7번). 사용자에게 알리지 않고 새 장면 판정으로 넘어갑니다.
  // 화면읽기 알림 영역에 넣은 글자는 회수할 수 없으므로 이 판정을 표시보다 먼저 끝냅니다(3-4절).
  if (auto && liveFrame && reqHash !== null) {
    const gray = camera.sampleGray();
    const cur = gray ? analyzeFrame(gray, CONFIG.SAMPLE_SIZE).hash : reqHash;
    if (gate.isStale(reqHash, sentAt, cur, performance.now())) return;
  }
  // 새 정보가 없으면 침묵
  if (auto && !r.is_new) return;

  /** @type {import('./phrases.js').Composed} */ let composed;
  if (r.high_risk === 'medical_value' && r.out_of_scope === 'none') {
    // 숫자 표시창(4-6절): 서로 다른 두 프레임에서 같은 숫자가 읽혔을 때만 말합니다
    composed = P.composeMedicalValue(r, await secondLook(runId));
    if (runId !== S.runId || S.phase !== 'running') return;
  } else {
    composed = P.composeDescription(r, {
      length: settings.length, detail: !!opt.detail, question: opt.question,
      recheck: opt.recheck && prev ? { prevSubject: prev.subject, count: ++S.recheckCount } : null,
    });
  }
  // 같은 내용을 다시 말하지 않습니다
  if (auto && prev && prev.speech === composed.speech) return;
  if (!opt.recheck) S.recheckCount = 0;
  if (r.quality.issue === 'none') S.quality.streak = 0;
  present(composed, { auto: true });
}

/** 숫자 표시창용 둘째 프레임 호출. 실패하면 null(숫자를 말하지 않음). */
async function secondLook(runId) {
  const gate = S.gate;
  const image = S.fixedImage ? null : camera.grabJpeg(); // 고정된 사진뿐이면 다른 프레임이 없으므로 맞춰 보지 못함
  if (!gate || !image || gate.sessionCalls >= CONFIG.SESSION_CALL_LIMIT) return null;
  gate.markSent(null, performance.now());
  try {
    const out = await describe({ mode: /** @type {'object'|'scene'} */ (S.mode), deviceId, sessionId: S.sessionId, image, recheck: true });
    return runId === S.runId ? out.result : null;
  } catch {
    return null;
  } finally {
    gate.markDone();
  }
}

/** 남은 횟수가 10회 이하가 되면 하루에 한 번 알립니다(4-3절) */
function noteRemaining(limits) {
  const n = limits && limits.device_remaining;
  const day = new Date().toDateString();
  if (typeof n === 'number' && n > 0 && n <= CONFIG.REMAINING_NOTICE_AT && S.noticed.remainingDay !== day) {
    S.noticed.remainingDay = day;
    setStatus(P.STATUS.remaining(n));
  }
}

function fix() {
  if (S.fixed) return true;
  const img = camera.grabJpeg();
  if (!img) return false;
  S.fixed = true;
  S.fixedImage = img;
  updateButtons();
  return true;
}

function unfix() {
  S.fixed = false;
  S.fixedImage = null;
  if (S.gate) S.gate.resetMotion();
  updateButtons();
}

// ── 글자·문서 읽기: 기기 내 OCR. 이 흐름은 프록시를 부르지 않습니다 ─────────
function resetDoc() {
  doc.fixed = doc.busy = doc.reading = doc.failed = false;
  doc.sentences = []; doc.idx = 0; doc.rawText = ''; doc.image = null;
  doc.confirm = { kind: '', until: 0 };
}

async function prepareOcr() {
  if (ocr.ready) return;
  const runId = S.runId;
  try {
    await ocr.init();
  } catch {
    if (runId === S.runId && S.mode === 'doc') { doc.failed = true; setStatus(P.STATUS.ocrUnavailable, { priority: 3 }); }
  }
}

/** 읽을 만한 프레임이 잡히면 OCR → 글자가 있으면 문서를 고정하고 낭독 시작 (3-3절) */
async function runOcr() {
  const gate = S.gate;
  if (!gate || doc.busy || doc.fixed || doc.failed || !S.obs) return;
  const first = camera.grabCanvas(CONFIG.OCR_LONG_SIDE);
  if (!first) return;
  const runId = S.runId;
  doc.busy = true;
  gate.markLocal(S.obs.hash, performance.now()); // 기기 내 처리: 호출 수에 넣지 않음
  speech.earcon('capture');
  setStatus(ocr.ready ? P.STATUS.ocrReading : P.STATUS.ocrPreparing);
  speech.startWaiting();
  try {
    const a = await ocr.recognize(first);
    if (runId !== S.runId) return;
    const usable = a.lines.filter((l) => l.confidence >= CONFIG.OCR_LINE_DROP_CONF).map((l) => l.text).join('').replace(/\s/g, '');
    if (usable.length < CONFIG.OCR_MIN_CHARS) { setStatus(P.STATUS.ocrNoText); return; }
    // 핵심 숫자는 서로 다른 두 프레임으로 맞춰 봅니다(4-5절 4번). 기기 내 처리라 추가 비용이 없습니다
    const second = camera.grabCanvas(CONFIG.OCR_LONG_SIDE);
    doc.image = first.toDataURL('image/jpeg', CONFIG.IMAGE_JPEG_QUALITIES[0]);
    let b = null;
    try { if (second) b = await ocr.recognize(second); } catch { b = null; }
    if (runId !== S.runId) return;
    const composed = P.composeDocument(a, b, CONFIG);
    if (!composed.sentences.length) { setStatus(P.STATUS.ocrNoText); return; }
    doc.sentences = [...composed.sentences, ...composed.closings];
    doc.rawText = composed.rawText;
    doc.idx = 0;
    doc.fixed = true; // 이후 카메라가 움직여도 낭독은 끊기지 않습니다
    speech.stopWaiting();
    renderDoc();
    startReading(P.STATUS.docFixed);
  } catch {
    if (runId === S.runId) { doc.failed = true; setStatus(P.STATUS.ocrUnavailable, { priority: 3 }); }
  } finally {
    doc.busy = false;
    speech.stopWaiting();
  }
}

/** 문서 문장 전체를 한 번 그리고, 이후에는 현재 문장 표시만 옮깁니다(알림 영역이 전체를 다시 읽지 않게). */
function renderDoc() {
  const box = $('result');
  if (box.dataset.doc !== '1' || box.children.length !== doc.sentences.length) {
    box.replaceChildren(...doc.sentences.map((s) => { const p = document.createElement('p'); p.textContent = s; return p; }));
    box.dataset.doc = '1';
  }
  Array.from(box.children).forEach((p, i) => {
    p.classList.toggle('current', i === doc.idx);
    if (i === doc.idx) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
  });
}

/** 안내 문구를 말한 뒤 현재 문장부터 낭독 */
function startReading(lead) {
  doc.reading = true;
  $('status').textContent = lead;
  if (!speech.voiceOn) return; // 화면읽기·글자만 방식: 전체 글자가 화면에 있고, 알림 영역이 안내를 전합니다
  speech.speak(lead, { auto: true, priority: 2, onend: (ok, reason) => { if (ok || reason === 'touch' || reason === 'replaced') docSpeakCurrent(); } });
}

function docSpeakCurrent() {
  if (S.mode !== 'doc' || !doc.fixed || !doc.sentences.length) return;
  renderDoc();
  const runId = S.runId;
  speech.speak(doc.sentences[doc.idx], {
    auto: true, priority: 2,
    onend: (ok, reason) => {
      if (runId !== S.runId || !doc.reading) return;
      if (ok) {
        if (doc.idx < doc.sentences.length - 1) { doc.idx++; docSpeakCurrent(); }
        else { doc.reading = false; setStatus(P.STATUS.docEnd); }
      } else if (reason === 'touch' || reason === 'replaced') {
        docSpeakCurrent(); // 조작이 끝나면 끊긴 문장부터 다시
      } else {
        doc.reading = false;
      }
    },
  });
}

/** 이전·다음·처음 @param {number} to */
function docGo(to) {
  if (!doc.fixed || !doc.sentences.length) { setStatus(P.STATUS.docNew, { say: 'now' }); return; }
  if (to < 0) { setStatus(P.STATUS.docFirst, { say: 'now' }); return; }
  if (to > doc.sentences.length - 1) { setStatus(P.STATUS.docLast, { say: 'now' }); return; }
  doc.idx = to;
  doc.reading = S.phase === 'running';
  renderDoc();
  if (speech.voiceOn) { speech.cancel('nav'); docSpeakCurrent(); }
  else $('status').textContent = doc.sentences[doc.idx]; // 화면읽기 방식: 상태 알림 영역으로 현재 문장을 전달
}

/** "AI에게 요약·판독 요청": 전송 안내 뒤 두 번째 누름에서만 요청이 나갑니다(3-3절, 3단계 PASS 기준) */
function docAi(kind) {
  const now = performance.now();
  if (kind === 'doc_summary' && !doc.rawText) { setStatus(P.STATUS.docNeedText, { say: 'now' }); return; }
  if (doc.confirm.kind !== kind || now > doc.confirm.until) {
    doc.confirm = { kind, until: now + CONFIG.CONFIRM_WINDOW_MS };
    doc.reading = false;
    setStatus(kind === 'doc_summary' ? P.STATUS.confirmSendText : P.STATUS.confirmSendPhoto, { say: 'now' });
    return;
  }
  doc.confirm = { kind: '', until: 0 };
  doc.reading = false;
  speech.cancel();
  if (kind === 'doc_summary') requestDescription({ kind, text: doc.rawText, detail: true });
  else requestDescription({ kind, image: doc.image || camera.grabJpeg(), detail: true });
}

// ── 설정 ────────────────────────────────────────────────────────────────────
function applyAppearance() {
  const root = document.documentElement;
  const key = CONFIG.FONT_STEPS[settings.fontIndex].key;
  if (key === 'm') root.removeAttribute('data-fs'); else root.setAttribute('data-fs', key);
  if (settings.theme === 'sharp') root.setAttribute('data-theme', 'sharp'); else root.removeAttribute('data-theme');
  $('font-status').textContent = P.STATUS.fontSize(CONFIG.FONT_STEPS[settings.fontIndex].name);
}

function changeFont(dir) {
  const next = settings.fontIndex + dir;
  if (next < 0 || next >= CONFIG.FONT_STEPS.length) { setStatus(dir < 0 ? P.STATUS.fontMin : P.STATUS.fontMax, { say: 'now' }); return; }
  settings.fontIndex = next;
  store.set('fontIndex', next);
  applyAppearance();
  setStatus(P.STATUS.fontSize(CONFIG.FONT_STEPS[next].name), { say: 'now' });
}

function showGuide() {
  $('guide-list').replaceChildren(...P.GUIDE.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
  $('guide').hidden = false;
}

// ── 초기화와 버튼 연결 ──────────────────────────────────────────────────────
function init() {
  applyAppearance();
  applyLiveRegions();
  updateButtons();
  if (S.guidePending) showGuide(); // 첫 방문: 안내 글자를 화면에 보이고, 음성은 첫 모드 시작 때 이어서 말합니다

  // 모든 기능은 이름이 붙은 버튼입니다(3-1절 1번). 쓸어 넘기기·두 손가락 동작은 없습니다.
  for (const mode of /** @type {Mode[]} */ (['object', 'scene', 'doc'])) {
    $('btn-mode-' + mode).addEventListener('click', () => startMode(mode));
  }
  $('btn-settings').addEventListener('click', () => {
    const open = $('settings').hidden;
    $('settings').hidden = !open;
    $('btn-settings').setAttribute('aria-expanded', String(open));
  });
  $('btn-guide').addEventListener('click', () => {
    showGuide();
    S.guidePending = false;
    store.set('guideDone', true);
    speech.unlock();
    speech.speak(P.GUIDE.join(' '));
  });
  for (const name of ['outputMode', 'length', 'theme']) {
    const current = name === 'outputMode' ? speech.outputMode : settings[name];
    for (const input of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(`input[name="${name}"]`))) {
      input.checked = input.value === current;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        if (name === 'outputMode') { speech.setOutputMode(/** @type {any} */ (input.value)); applyLiveRegions(); }
        else { settings[name] = input.value; store.set(name, input.value); applyAppearance(); }
      });
    }
  }
  $('btn-font-down').addEventListener('click', () => changeFont(-1));
  $('btn-font-up').addEventListener('click', () => changeFont(1));

  // 실행 화면
  $('btn-pause').addEventListener('click', () => (S.phase === 'paused' ? resume() : pause('user')));
  $('btn-stop').addEventListener('click', stopMode);
  $('btn-camera-retry').addEventListener('click', () => { clearError(); S.phase = 'starting'; S.runId++; startCamera(); });

  $('btn-replay').addEventListener('click', () => {
    // 호출 없이 마지막 설명을 다시 발화. 한도가 소진되어도 동작합니다(4-3절)
    if (S.last) speech.speak(S.last.speech); else setStatus(P.STATUS.noLast, { say: 'now' });
  });
  $('btn-detail').addEventListener('click', () => {
    // 고정된 같은 사진(없으면 직전에 설명한 사진)으로 상세 설명. 호출 1회
    requestDescription({ detail: true, image: S.fixedImage || S.lastImage });
  });
  $('btn-fix').addEventListener('click', () => {
    if (S.fixed) { unfix(); setStatus(P.STATUS.unfixed, { say: 'now' }); }
    else if (fix()) setStatus(P.STATUS.fixed, { say: 'now' });
  });
  $('btn-recheck').addEventListener('click', () => {
    // 새 프레임을 잡아 다시 분석. 게이트 3(변화)·4(쿨다운)는 건너뛰고 1(품질)·5(상한)는 유지
    if (S.phase !== 'running' || !S.gate) return;
    if (S.fixed) unfix();
    const gray = camera.sampleGray();
    if (!gray) return;
    const now = performance.now();
    const obs = S.gate.observe(gray, now);
    S.obs = obs;
    const v = S.gate.canCall(obs, now, { skipStable: true, skipChange: true, skipCooldown: true });
    if (!v.ok && v.reason === 'quality') { setStatus(P.QUALITY[obs.quality], { say: 'now' }); return; }
    if (!v.ok && v.reason === 'session') { sessionLimitPause(); return; }
    if (!v.ok) { setStatus(P.STATUS.busy, { say: 'now' }); return; }
    S.cloudHalted = false; S.netDown = false;
    requestDescription({ recheck: true });
  });
  $('btn-retry-same').addEventListener('click', () => {
    // 네트워크·시간 초과 오류 전용: 같은 사진으로 다시 시도
    if (!S.lastImage) return;
    S.netDown = false;
    clearError();
    requestDescription({ image: S.lastImage });
  });
  // 입력란에 초점이 가면 자동으로 "고정" (3-3절 10번)
  $('q-input').addEventListener('focus', () => { if (S.phase === 'running' && !S.fixed && fix()) $('status').textContent = P.STATUS.fixed; });
  $('ask').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const q = $('q-input').value.trim();
    if (!q) { setStatus(P.STATUS.needQuestion, { say: 'now' }); return; }
    // 담당 밖 요청(길·신원·사용법·약 효능)은 호출하지 않고 정해진 문구로 답합니다(1-6절)
    const out = P.classifyQuestion(q);
    if (out) { present(P.fixedPhrase(P.OUT_OF_SCOPE[out]), { auto: false }); return; }
    if (!S.fixed && !fix()) return;
    requestDescription({ question: q, image: S.fixedImage });
  });

  // 글자·문서 읽기
  $('btn-prev').addEventListener('click', () => docGo(doc.idx - 1));
  $('btn-next').addEventListener('click', () => docGo(doc.idx + 1));
  $('btn-first').addEventListener('click', () => docGo(0));
  $('btn-newdoc').addEventListener('click', () => {
    speech.cancel();
    resetDoc();
    $('result').replaceChildren();
    if (S.gate) { S.gate.forgetLastSent(); S.gate.resetMotion(); }
    setStatus(P.STATUS.docNew, { say: 'now' });
  });
  $('btn-ai-summary').addEventListener('click', () => docAi('doc_summary'));
  $('btn-ai-read').addEventListener('click', () => docAi('doc_read'));

  // 음성 조절: 실행 화면에 항상 노출 (3-3절 11~13번)
  $('btn-slower').addEventListener('click', () => setStatus(speech.changeRate(-1) ? P.STATUS.rateChanged : P.STATUS.rateLimit, { say: 'now' }));
  $('btn-faster').addEventListener('click', () => setStatus(speech.changeRate(1) ? P.STATUS.rateChanged : P.STATUS.rateLimit, { say: 'now' }));
  $('btn-quieter').addEventListener('click', () => setStatus(speech.changeVolume(-1) ? P.STATUS.volumeChanged : P.STATUS.volumeMin, { say: 'now' }));
  $('btn-louder').addEventListener('click', () => setStatus(speech.changeVolume(1) ? P.STATUS.volumeChanged : P.STATUS.volumeMax, { say: 'now' }));
  $('btn-mute').addEventListener('click', () => {
    const muted = !speech.muted;
    speech.setMuted(muted);
    applyLiveRegions();
    updateButtons();
    setStatus(muted ? P.STATUS.muted : P.STATUS.unmuted, { say: muted ? 'none' : 'now' });
  });

  // 사용자가 화면을 만지면 진행 중 발화를 즉시 멈추고 2초간 자동 발화를 보류합니다(3-4절).
  // 캡처 단계에서 먼저 받아, 같은 동작의 버튼 처리(click)가 그 뒤에 직접 발화할 수 있게 합니다.
  const touched = () => { S.lastInteractionAt = performance.now(); speech.noteUserTouch(); };
  document.addEventListener('pointerdown', touched, true);
  document.addEventListener('keydown', touched, true);
  document.addEventListener('focusin', () => { if (!programmaticFocus) touched(); }, true);

  // 화면이 가려지면 즉시 정지. 돌아와도 자동 재개하지 않습니다(1-5절: 주머니 속 호출 방지)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('hidden');
    else if (S.phase === 'paused' && S.mode) setStatus(P.STATUS.returned);
  });
  // 연결 복귀: 새 프레임으로 이어 갑니다(4-1절)
  window.addEventListener('online', () => { if (S.netDown) { clearError(); resumeAfterNetwork(); } });
}

init();
