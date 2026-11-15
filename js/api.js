// @ts-check
/**
 * 프록시 호출과 오류 분류 (기획서 v2 1-3절, 4-1절).
 * 오류 종류는 "어디서 실패했는가"로 정합니다. 응답 문장을 해석해 분류하지 않습니다.
 *
 * @typedef {'network'|'service'|'format'|'limit_device'|'limit_budget'|'limit_session'|'aborted'} ApiErrorKind
 *
 * @typedef {Object} DescribeResult  1-3절의 구조화 항목
 * @property {boolean} is_new           ① 새 정보 여부
 * @property {string} subject           ② 대상의 종류·이름(명사구)
 * @property {string[]} read_text       ③ 사진에서 실제로 읽힌 글자(원문)
 * @property {string[]} details         ④ 추정 내용
 * @property {string} answer            질문에 대한 답
 * @property {'none'|'cut'|'occluded'} unread
 * @property {{issue:'none'|'blur'|'dark'|'cut'|'glare'|'far', action:string}} quality  ⑤
 * @property {'certain'|'inferred'|'unknown'} confidence  ⑥
 * @property {'present'|'absent'|'uncertain'|'na'} target ⑦
 * @property {'none'|'medicine'|'medical_value'|'panel'|'important_doc'} high_risk ⑧
 * @property {'none'|'navigation'|'identity'|'usage'|'medicine_advice'|'moving'|'absence'|'display_off'|'small_object'} out_of_scope
 *
 * @typedef {Object} DescribeRequest
 * @property {'object'|'scene'|'doc_read'|'doc_summary'} mode
 * @property {string} deviceId
 * @property {string} sessionId
 * @property {string} [image]        JPEG data URL (doc_summary에는 없음)
 * @property {string} [text]         doc_summary 전용: 기기에서 읽어 낸 글자
 * @property {boolean} [detail]
 * @property {boolean} [recheck]
 * @property {string} [question]
 * @property {string} [prevSummary]
 * @property {string} lang           사용자가 고른 언어 코드(ko, zh-CN, en, es, fr, de, th, ja). 모델이 이 언어로 답합니다
 */

import { CONFIG } from './config.js';

export class ApiError extends Error {
  /** @param {ApiErrorKind} kind */
  constructor(kind) { super(`api:${kind}`); this.kind = kind; }
}

/** 익명 식별값(기기·세션). 로그인이 없으므로 브라우저 저장소의 임의 값입니다(2-4절). */
export function newId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

const ENUMS = Object.freeze({
  unread: ['none', 'cut', 'occluded'],
  issue: ['none', 'blur', 'dark', 'cut', 'glare', 'far'],
  confidence: ['certain', 'inferred', 'unknown'],
  target: ['present', 'absent', 'uncertain', 'na'],
  high_risk: ['none', 'medicine', 'medical_value', 'panel', 'important_doc'],
  out_of_scope: ['none', 'navigation', 'identity', 'usage', 'medicine_advice', 'moving', 'absence', 'display_off', 'small_object'],
});

/** 구조화 응답 검증. 통과하지 못하면 내용을 낭독하지 않습니다(4-1절 "응답 형식 이상"). */
export function isValidResult(r) {
  return !!r && typeof r === 'object'
    && typeof r.is_new === 'boolean' && typeof r.subject === 'string' && typeof r.answer === 'string'
    && Array.isArray(r.read_text) && r.read_text.every((x) => typeof x === 'string')
    && Array.isArray(r.details) && r.details.every((x) => typeof x === 'string')
    && ENUMS.unread.includes(r.unread)
    && !!r.quality && ENUMS.issue.includes(r.quality.issue)
    && ENUMS.confidence.includes(r.confidence) && ENUMS.target.includes(r.target)
    && ENUMS.high_risk.includes(r.high_risk) && ENUMS.out_of_scope.includes(r.out_of_scope);
}

/**
 * 시험용 모드: 주소에 ?demo=1 이 있을 때만 켜집니다.
 * 목 응답은 카메라에 비친 것과 관계없는 예시라서, 이 표시 없이는 절대 내보내지 않습니다.
 */
export const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';

/** 물건 설명·주변 살펴보기·AI 요약을 쓸 수 있는가: 프록시 주소가 설정됐거나 시험용 모드일 때만 */
export function cloudAvailable() { return !!CONFIG.PROXY_URL || DEMO; }

/** 시험용 모드의 내장 목: worker.js를 브라우저 안에서 직접 실행합니다. 사진은 어디로도 전송되지 않습니다. */
let localWorker = null;
async function localFetch(init) {
  if (!localWorker) localWorker = (await import('../worker/worker.js')).default;
  return localWorker.fetch(new Request('https://local.invalid/v1/describe', init), {});
}

/** 시험용 모드의 내장 목에서만 주소의 ?mock=시나리오&mockDelay=밀리초 를 프록시 머리말로 넘깁니다. */
function mockHeaders() {
  if (CONFIG.PROXY_URL || !DEMO) return {};
  const q = new URLSearchParams(location.search);
  /** @type {Record<string,string>} */ const h = {};
  if (q.get('mock')) h['x-mock-scenario'] = String(q.get('mock'));
  if (q.get('mockDelay')) h['x-mock-delay'] = String(q.get('mockDelay'));
  return h;
}

/**
 * @param {DescribeRequest} payload
 * @param {AbortSignal} [signal] 일시정지·종료 때 호출을 버리기 위한 신호
 * @returns {Promise<{result:DescribeResult, mock:boolean, limits:{device_remaining:number, session_remaining:number}}>}
 *   mock이 true면 사진을 보지 않은 예시 응답입니다. 부르는 쪽이 결과마다 시험용 고지를 붙여야 합니다
 * @throws {ApiError}
 */
export async function describe(payload, signal) {
  // 프록시도 없고 시험용 모드도 아니면 호출 자체를 하지 않습니다(목 응답이 실제 설명처럼 나가는 것을 막는 마지막 방어선)
  if (!cloudAvailable()) throw new ApiError('service');
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, CONFIG.REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) { if (signal.aborted) ctrl.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  const init = { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', ...mockHeaders() }, body: JSON.stringify(payload) };

  let res;
  try {
    // 발생 지점 1: 프록시에 닿지 못함 또는 시간 초과 → 네트워크
    const call = CONFIG.PROXY_URL ? fetch(CONFIG.PROXY_URL.replace(/\/$/, '') + '/v1/describe', init) : localFetch(init);
    res = await Promise.race([call, new Promise((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true }))]);
  } catch {
    if (signal && signal.aborted && !timedOut) throw new ApiError('aborted');
    throw new ApiError('network');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  /** @type {any} */ let data = null;
  try { data = await res.json(); } catch { data = null; }

  // 발생 지점 2: 프록시의 전용 응답 → 한도
  const code = data && data.error && data.error.code;
  if (code === 'LIMIT_DEVICE' || code === 'LIMIT_IP') throw new ApiError('limit_device');
  if (code === 'BUDGET_EXHAUSTED') throw new ApiError('limit_budget');
  if (code === 'LIMIT_SESSION') throw new ApiError('limit_session');
  // 발생 지점 3: 프록시·모델 사업자의 오류 응답 → 서비스 장애 (잘못된 요청 4xx도 사용자가 풀 수 없으므로 여기에 넣음)
  if (!res.ok) throw new ApiError('service');
  // 발생 지점 4: 정상 응답인데 구조화 검증 실패 → 형식 이상
  if (!data || data.ok !== true || !isValidResult(data.result)) throw new ApiError('format');
  // 프록시가 목으로 답했으면(mock: true) 그대로 알리고, 내장 목은 항상 목입니다
  return { result: data.result, mock: data.mock === true || !CONFIG.PROXY_URL, limits: data.limits || { device_remaining: Infinity, session_remaining: Infinity } };
}
