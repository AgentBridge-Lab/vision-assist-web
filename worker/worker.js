// @ts-check
/**
 * 운영자 프록시 — Cloudflare Workers 형식 (기획서 v2 1-1절, 2-4절, D-2).
 * 하는 일은 둘뿐입니다: API 키 보관과 한도 집행. 계정·대화 저장·분석은 없습니다. 사진은 저장하지 않고 계수만 기록합니다.
 *
 * 기본은 목(mock) 응답입니다. 실제 모델 호출은 환경변수 두 개가 모두 있을 때만 켜집니다.
 *   USE_OPENAI = "1"   그리고   OPENAI_API_KEY = (시크릿)
 * 키는 코드에 넣지 않습니다. `wrangler secret put OPENAI_API_KEY`로만 넣습니다(사용자 승인 필요).
 *
 * 이 파일은 의존성이 없는 ES 모듈이라 세 곳에서 그대로 돕니다.
 *   1) Cloudflare Workers (배포)   2) Node (worker/dev-server.mjs)   3) 브라우저(프런트의 내장 목 모드)
 *
 * 환경변수(모두 선택):
 *   USE_OPENAI, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_REASONING_EFFORT,
 *   ALLOWED_ORIGIN, MONTHLY_BUDGET_USD,
 *   SESSION_LIMIT, DEVICE_DAILY_LIMIT, DEVICE_DAILY_LIMIT_REDUCED, IP_DAILY_LIMIT,
 *   PRICE_INPUT_PER_M, PRICE_OUTPUT_PER_M
 * 바인딩(선택): LIMITS = Durable Object 네임스페이스(클래스 LimitCounter). 없으면 메모리에 셉니다(목·개발용).
 */

// ── 설정 (2-4절의 [가정] 초기값) ────────────────────────────────────────────
const DEFAULTS = Object.freeze({
  SESSION_LIMIT: 40,               // [가정] 세션당 호출
  DEVICE_DAILY_LIMIT: 100,         // [가정] 기기당 일일 호출
  DEVICE_DAILY_LIMIT_REDUCED: 40,  // 월 예산 80% 도달 시
  IP_DAILY_LIMIT: 600,             // [가정] 같은 IP 일일 호출
  MONTHLY_BUDGET_USD: 30,          // [가정] D-1 미결정. 기획서 권고값(공개 초기 30달러)
  BUDGET_REDUCE_RATIO: 0.8,
  MAX_IMAGE_BYTES: 400 * 1024,     // [가정] 이미지 1장 400KB 이하
  MAX_BODY_BYTES: 600 * 1024,      // base64로 부푼 400KB + 글자
  MAX_TEXT_CHARS: 6000,            // [구현 가정] 문서 요약용 글자·질문 길이 상한
  OPENAI_MODEL: 'gpt-5.6-luna',    // 2-1절 비용 추정의 기준 모델. 최종 선정은 로드맵 1단계 V4
  OPENAI_REASONING_EFFORT: 'low',  // [모름] 1-3절 "가장 낮은 설정". 모델별 최저값 이름은 V5에서 확인
  PRICE_INPUT_PER_M: 0.20,         // 1-3절 단가 (100만 토큰당 달러)
  PRICE_OUTPUT_PER_M: 1.20,
  MOCK_COST_BASIC_USD: 0.00043,    // 2-1절 추정치. 목 모드에서 예산 계수를 시험하기 위한 값
  MOCK_COST_DETAIL_USD: 0.00076,
  UPSTREAM_TIMEOUT_MS: 20000,      // [구현 가정]
});

function config(env) {
  const num = (k) => (env && env[k] !== undefined && env[k] !== '' && !Number.isNaN(Number(env[k])) ? Number(env[k]) : DEFAULTS[k]);
  return {
    ...DEFAULTS,
    SESSION_LIMIT: num('SESSION_LIMIT'),
    DEVICE_DAILY_LIMIT: num('DEVICE_DAILY_LIMIT'),
    DEVICE_DAILY_LIMIT_REDUCED: num('DEVICE_DAILY_LIMIT_REDUCED'),
    IP_DAILY_LIMIT: num('IP_DAILY_LIMIT'),
    MONTHLY_BUDGET_USD: num('MONTHLY_BUDGET_USD'),
    PRICE_INPUT_PER_M: num('PRICE_INPUT_PER_M'),
    PRICE_OUTPUT_PER_M: num('PRICE_OUTPUT_PER_M'),
    OPENAI_MODEL: (env && env.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL,
    OPENAI_REASONING_EFFORT: (env && env.OPENAI_REASONING_EFFORT) || DEFAULTS.OPENAI_REASONING_EFFORT,
  };
}

const useOpenAI = (env) => !!env && env.USE_OPENAI === '1' && typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0;

// ── 한도 계수 (2-4절) ───────────────────────────────────────────────────────
/** 일일 한도의 기준 시각은 한국 시간 자정입니다. */
export function kstDay(now) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 메모리 저장소(목·개발용). Durable Object의 storage와 같은 모양(get/put/deleteAll)입니다. */
class MemoryStore {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.get(k); }
  async put(k, v) { this.m.set(k, v); }
  async deleteAll() { this.m.clear(); }
}
const memoryStore = new MemoryStore();

/**
 * 한도 확인과 계수를 한 번에 합니다. 통과하면 세 계수(세션·기기·IP)를 1씩 올립니다.
 * 순서: 월 예산 → 세션 → 기기 일일 → IP 일일.
 * @returns {Promise<{ok:true, device_remaining:number, session_remaining:number, month:string}
 *                  |{ok:false, code:'BUDGET_EXHAUSTED'|'LIMIT_SESSION'|'LIMIT_DEVICE'|'LIMIT_IP'}>}
 */
export async function admit(store, cfg, who, now) {
  const day = kstDay(now), month = day.slice(0, 7);
  const meta = await store.get('meta');
  if (!meta || meta.day !== day) {
    // 날짜가 바뀌면 일일·세션 계수를 모두 지우고, 같은 달의 누적 비용만 남깁니다
    const cost = meta && meta.month === month ? (await store.get('cost')) || 0 : 0;
    await store.deleteAll();
    await store.put('meta', { day, month });
    await store.put('cost', cost);
  }
  const spent = (await store.get('cost')) || 0; // 100만분의 1달러 단위
  const budget = cfg.MONTHLY_BUDGET_USD * 1e6;
  if (spent >= budget) return { ok: false, code: 'BUDGET_EXHAUSTED' };
  const deviceLimit = spent >= budget * cfg.BUDGET_REDUCE_RATIO ? cfg.DEVICE_DAILY_LIMIT_REDUCED : cfg.DEVICE_DAILY_LIMIT;
  const ks = `s:${who.sessionId}`, kd = `d:${who.deviceId}`, ki = `i:${who.ip}`;
  const s = (await store.get(ks)) || 0, d = (await store.get(kd)) || 0, i = (await store.get(ki)) || 0;
  if (s >= cfg.SESSION_LIMIT) return { ok: false, code: 'LIMIT_SESSION' };
  if (d >= deviceLimit) return { ok: false, code: 'LIMIT_DEVICE' };
  if (i >= cfg.IP_DAILY_LIMIT) return { ok: false, code: 'LIMIT_IP' };
  await store.put(ks, s + 1); await store.put(kd, d + 1); await store.put(ki, i + 1);
  return { ok: true, device_remaining: deviceLimit - d - 1, session_remaining: cfg.SESSION_LIMIT - s - 1, month };
}

export async function addCost(store, microUsd) {
  await store.put('cost', ((await store.get('cost')) || 0) + Math.max(0, Math.round(microUsd)));
}

/**
 * Durable Object: 한도 계수 저장 (1-4절). 전체를 한 인스턴스("global")가 맡아 확인과 증가가 섞이지 않게 합니다.
 * [구현 가정] 하루 사용자 1,000명 규모에서는 한 인스턴스로 충분하다고 보았습니다. 실측하지 않았습니다.
 */
export class LimitCounter {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    const { op, who, microUsd } = await request.json();
    if (op === 'admit') return Response.json(await admit(this.state.storage, config(this.env), who, Date.now()));
    if (op === 'cost') { await addCost(this.state.storage, microUsd); return Response.json({ ok: true }); }
    return new Response('bad op', { status: 400 });
  }
}

/** 바인딩이 있으면 Durable Object, 없으면 메모리. */
function limiter(env) {
  if (env && env.LIMITS && typeof env.LIMITS.idFromName === 'function') {
    const stub = env.LIMITS.get(env.LIMITS.idFromName('global'));
    const call = async (body) => (await stub.fetch('https://limits.internal/', { method: 'POST', body: JSON.stringify(body) })).json();
    return { admit: (who) => call({ op: 'admit', who }), addCost: (microUsd) => call({ op: 'cost', microUsd }) };
  }
  const store = (env && env.__STORE) || memoryStore; // __STORE: 시험에서 격리된 저장소를 넣기 위한 자리
  return { admit: (who) => admit(store, config(env), who, Date.now()), addCost: (microUsd) => addCost(store, microUsd) };
}

// ── 응답 형식 (1-3절의 구조화 항목 ①~⑧) ────────────────────────────────────
const ENUMS = Object.freeze({
  confidence: ['certain', 'inferred', 'unknown'],                       // ⑥ 확신 정도(3단계 고정)
  target: ['present', 'absent', 'uncertain', 'na'],                     // ⑦ 대상 유무
  high_risk: ['none', 'medicine', 'medical_value', 'panel', 'important_doc'], // ⑧ 고위험 대상
  out_of_scope: ['none', 'navigation', 'identity', 'usage', 'medicine_advice', 'moving', 'absence', 'display_off', 'small_object'],
  unread: ['none', 'cut', 'occluded'],
  quality_issue: ['none', 'blur', 'dark', 'cut', 'glare', 'far'],       // ⑤ 사진 품질 문제
  quality_action: ['none', 'closer', 'farther', 'up', 'down', 'brighter', 'angle'],
});

export const RESULT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['is_new', 'subject', 'read_text', 'details', 'answer', 'unread', 'quality', 'confidence', 'target', 'high_risk', 'out_of_scope'],
  properties: {
    is_new: { type: 'boolean', description: '직전 설명 요약과 비교해 새 정보가 있으면 true' },                 // ①
    subject: { type: 'string', description: '대상의 종류·이름을 나타내는 짧은 명사구. 문장으로 쓰지 않음. 예: 우유 팩' }, // ②
    read_text: { type: 'array', items: { type: 'string' }, description: '사진에서 실제로 읽힌 글자 원문. 보완·해석 금지' }, // ③
    details: { type: 'array', items: { type: 'string' }, description: '추정 내용. 각 문장은 "…로 보입니다."로 끝냄' },    // ④
    answer: { type: 'string', description: '질문이 있을 때의 답. 없으면 빈 문자열' },
    unread: { type: 'string', enum: ENUMS.unread, description: '글자가 잘렸는지(cut), 가려졌는지(occluded)' },
    quality: {                                                                                                 // ⑤
      type: 'object', additionalProperties: false, required: ['issue', 'action'],
      properties: { issue: { type: 'string', enum: ENUMS.quality_issue }, action: { type: 'string', enum: ENUMS.quality_action } },
    },
    confidence: { type: 'string', enum: ENUMS.confidence },                                                    // ⑥
    target: { type: 'string', enum: ENUMS.target, description: '질문받은 대상이 화면에 있는지. 질문이 없으면 na' }, // ⑦
    high_risk: { type: 'string', enum: ENUMS.high_risk },                                                      // ⑧
    out_of_scope: { type: 'string', enum: ENUMS.out_of_scope, description: '담당 밖 요청이면 그 종류' },
  },
});

/** 구조화 응답 검증. 프록시와 프런트가 같은 검사를 합니다(프런트는 js/api.js). */
export function isValidResult(r) {
  return !!r && typeof r === 'object'
    && typeof r.is_new === 'boolean' && typeof r.subject === 'string' && typeof r.answer === 'string'
    && Array.isArray(r.read_text) && r.read_text.every((x) => typeof x === 'string')
    && Array.isArray(r.details) && r.details.every((x) => typeof x === 'string')
    && ENUMS.unread.includes(r.unread)
    && !!r.quality && ENUMS.quality_issue.includes(r.quality.issue) && ENUMS.quality_action.includes(r.quality.action)
    && ENUMS.confidence.includes(r.confidence) && ENUMS.target.includes(r.target)
    && ENUMS.high_risk.includes(r.high_risk) && ENUMS.out_of_scope.includes(r.out_of_scope);
}

// ── 지시문 (1-3절, 4-4절, 4-5절, 4-6절) ─────────────────────────────────────
const COMMON_RULES = [
  '당신은 앞이 보이지 않거나 잘 보이지 않는 사용자를 위해 사진 한 장을 설명합니다. 한국어로만 답합니다.',
  '정해진 JSON 항목만 채웁니다.',
  'subject에는 대상의 종류나 이름을 짧은 명사구로만 씁니다(예: "우유 팩"). 문장으로 쓰지 않습니다.',
  'read_text에는 사진에서 실제로 읽힌 글자만 원문 그대로 넣습니다. 안 읽힌 부분을 보완하거나 뜻을 풀지 않습니다. 숫자·날짜·금액·용량은 표기 그대로 둡니다.',
  'details의 모든 문장은 "…로 보입니다."로 끝냅니다. 읽은 글자와 추정을 섞지 않습니다.',
  '확신 정도는 certain, inferred, unknown 가운데 하나만 씁니다. 모르면 unknown으로 두고 지어내지 않습니다.',
  '글자가 잘렸거나 가려졌으면 unread에 표시합니다. 사진이 흐리거나 어둡거나 반사되면 quality에 표시합니다.',
  '금지: 이동 방향, 보행 가능 여부, 안전 판단, 장애물 회피를 말하지 않습니다.',
  '금지: 기기 사용법이나 조작 순서를 지시하지 않습니다. 버튼·조작판은 적힌 글자와 위치만 말합니다.',
  '금지: 약의 효능·부작용·복용법을 덧붙이지 않습니다. 약은 적힌 글자만 read_text에 넣고 high_risk를 medicine으로 둡니다.',
  '금지: 사람이 누구인지, 얼굴의 신원을 말하지 않습니다. 사람이 보인다는 것까지만 말합니다.',
  '금지: 사과·동정 표현, "보시면", "저기", "여기" 같은 시각을 전제한 지시어를 쓰지 않습니다.',
  '좌우를 말할 때는 반드시 "카메라 기준 왼쪽", "카메라 기준 오른쪽"이라고 씁니다.',
  '"없다", "깨끗하다", "안전하다"고 단정하지 않습니다. 보이는 범위에서만 말합니다.',
  '혈당계·체온계·혈압계 같은 숫자 표시창이면 high_risk를 medical_value로, 가전 조작판이면 panel로, 금액·날짜·계좌가 있는 문서면 important_doc으로 둡니다.',
  '길·이동, 신원, 사용법, 약의 효능·복용을 묻는 질문에는 내용으로 답하지 않고 out_of_scope에 종류만 표시합니다.',
  '질문이 특정 대상을 찾는 것이면 target에 present, absent, uncertain 가운데 하나를 넣습니다. 질문이 없으면 na입니다.',
].join('\n');

const MODE_RULES = Object.freeze({
  object: '모드: 물건 설명. 손에 들었거나 앞에 놓인 물건 하나의 종류와 포장 글자를 말합니다.',
  scene: '모드: 주변 살펴보기. 사용자는 멈춰 서 있습니다. 보이는 것의 종류와 카메라 기준 위치만 말합니다. 어디로 가라거나 지나갈 수 있다는 말은 하지 않습니다.',
  doc_read: '모드: 문서 판독. 사진 속 글자를 read_text에 줄 단위로 원문 그대로 옮깁니다. 요약하지 않습니다.',
  doc_summary: '모드: 문서 요약. 아래 글자는 기기에서 읽어 낸 문서 원문입니다. subject에 문서 종류를, details에 무슨 문서인지를 두 문장 이내로 씁니다. 숫자는 원문 표기 그대로 인용합니다.',
});

function buildInput(body) {
  const user = [];
  const parts = [MODE_RULES[body.mode]];
  parts.push(body.detail ? '요청: 자세히. details를 네 문장 이내로 채웁니다.' : '요청: 기본. details는 한 문장 이내로 씁니다.');
  if (body.prevSummary) parts.push(`직전 설명 요약: ${body.prevSummary}\n같은 대상이고 새로 말할 것이 없으면 is_new를 false로 둡니다.`);
  if (body.question) parts.push(`사용자 질문: ${body.question}`);
  if (body.text) parts.push(`문서 원문:\n${body.text}`);
  user.push({ type: 'input_text', text: parts.join('\n') });
  if (body.image) user.push({ type: 'input_image', image_url: body.image });
  return [{ role: 'system', content: COMMON_RULES }, { role: 'user', content: user }];
}

/**
 * 실제 모델 호출 (OpenAI Responses API). USE_OPENAI=1 이고 키가 있을 때만 실행됩니다.
 * 주의: 이 경로는 키 없이 작성했으며 실제 호출로 검증하지 않았습니다. 요청·응답 필드 이름은 로드맵 1단계에서 확인해야 합니다.
 * @returns {Promise<{result:any, microUsd:number}>}
 */
async function callOpenAI(env, cfg, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: cfg.OPENAI_MODEL,
        store: false, // 1-3절: 호출마다 저장 비활성 명시
        reasoning: { effort: cfg.OPENAI_REASONING_EFFORT },
        max_output_tokens: body.detail ? 900 : 500, // [구현 가정]
        input: buildInput(body),
        text: { format: { type: 'json_schema', name: 'vision_description', strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    let text = '';
    for (const item of data.output || []) for (const c of item.content || []) if (c.type === 'output_text') text += c.text;
    const usage = data.usage || {};
    const microUsd = (usage.input_tokens || 0) * cfg.PRICE_INPUT_PER_M + (usage.output_tokens || 0) * cfg.PRICE_OUTPUT_PER_M; // 토큰×(달러/100만) = 100만분의 1달러
    return { result: JSON.parse(text), microUsd };
  } finally {
    clearTimeout(timer);
  }
}

// ── 목 응답 ─────────────────────────────────────────────────────────────────
const base = (o) => ({
  is_new: true, subject: '', read_text: [], details: [], answer: '', unread: 'none',
  quality: { issue: 'none', action: 'none' }, confidence: 'certain', target: 'na', high_risk: 'none', out_of_scope: 'none', ...o,
});

const MOCK_OBJECTS = [
  base({ subject: '우유 팩', read_text: ['서울우유', '1L', '2026.11.20'], details: ['흰색과 초록색 종이 팩으로 보입니다.'] }),
  base({ subject: '컵라면', read_text: ['신라면', '큰사발면', '114g'], details: ['빨간색 뚜껑이 덮인 종이 용기로 보입니다.'] }),
  base({ subject: '생수병', read_text: ['제주 삼다수', '500mL'], details: ['투명한 플라스틱 병으로 보입니다.'], confidence: 'inferred' }),
  base({ subject: '리모컨', read_text: ['전원', '음량', '채널'], details: ['검은색 긴 막대 모양으로 보입니다. 카메라 기준 위쪽에 전원 글자가 있는 것으로 보입니다.'] }),
];
const MOCK_SCENES = [
  base({ subject: '편의점 음료 매대', read_text: ['2+1'], details: ['왼쪽 칸에 생수가 놓인 것으로 보입니다.', '오른쪽 칸에 캔 음료가 놓인 것으로 보입니다.'] }),
  base({ subject: '식탁', details: ['카메라 기준 왼쪽에 밥그릇이, 가운데에 국그릇이 놓인 것으로 보입니다.'], confidence: 'inferred' }),
  base({ subject: '사무실 책상', read_text: [], details: ['사람이 한 명 있는 것으로 보입니다.', '오른쪽에 모니터가 있는 것으로 보입니다.'] }),
];

/** 시험용 시나리오. 목 모드에서만, 요청 머리말 x-mock-scenario로 고릅니다. */
const MOCK_SCENARIOS = Object.freeze({
  medicine: base({ subject: '약 봉투', read_text: ['홍길동 귀하', '1일 3회 식후 30분', '아세트아미노펜 500mg'], details: ['해열제로 보입니다. 두통에 효과가 있습니다.'], high_risk: 'medicine' }),
  medicine_unread: base({ subject: '약 봉투', read_text: [], confidence: 'inferred', high_risk: 'medicine' }),
  panel: base({ subject: '세탁기 조작판', read_text: ['전원', '표준', '헹굼', '탈수'], details: ['전원 버튼을 누르면 켜집니다. 표준 코스를 선택하세요.', '카메라 기준 오른쪽 끝에 전원 글자가 있는 것으로 보입니다.'], high_risk: 'panel' }),
  value: base({ subject: '체온계', read_text: ['36.5'], high_risk: 'medical_value' }),
  guidance: base({ subject: '복도', details: ['앞이 비어 있으니 직진하세요.', '오른쪽에 문이 있는 것으로 보입니다.', '장애물이 없어 안전합니다.'] }),
  glare: base({ subject: '과자 봉지', read_text: ['새우'], unread: 'cut', quality: { issue: 'glare', action: 'angle' }, confidence: 'inferred' }),
  far: base({ subject: '안내판', quality: { issue: 'far', action: 'closer' }, confidence: 'inferred' }),
  unknown: base({ subject: '', confidence: 'unknown' }),
  notnew: base({ is_new: false, subject: '우유 팩' }),
  absent: base({ subject: '음료 매대', target: 'absent' }),
  uncertain: base({ subject: '음료 매대', target: 'uncertain' }),
  moving: base({ out_of_scope: 'moving' }),
  absence: base({ out_of_scope: 'absence' }),
  important: base({ subject: '고지서', read_text: ['납부 금액 15,000원', '납기 2026.11.30'], high_risk: 'important_doc' }),
  malformed: { subject: 12, hello: 'world' },
});

function pick(list, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += Math.max(1, Math.floor(seed.length / 64))) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @returns {Promise<{result:any, microUsd:number, status?:number}>} */
async function mockRespond(request, cfg, body) {
  const scenario = request.headers.get('x-mock-scenario') || '';
  const delay = Math.min(60000, Number(request.headers.get('x-mock-delay')) || 0);
  if (delay) await sleep(delay);
  const microUsd = (body.detail ? cfg.MOCK_COST_DETAIL_USD : cfg.MOCK_COST_BASIC_USD) * 1e6;
  if (scenario === 'error500') return { result: null, microUsd: 0, status: 500 };
  let r;
  if (scenario && MOCK_SCENARIOS[scenario]) r = MOCK_SCENARIOS[scenario];
  else if (body.mode === 'doc_summary') r = base({ subject: '문서', details: ['글자 수가 ' + body.text.length + '자인 문서로 보입니다.'], confidence: 'inferred' });
  else if (body.mode === 'doc_read') r = base({ subject: '문서', read_text: ['(목 응답) 판독 글자 예시'], confidence: 'inferred' });
  else r = pick(body.mode === 'scene' ? MOCK_SCENES : MOCK_OBJECTS, body.image || '');
  r = JSON.parse(JSON.stringify(r));
  if (scenario !== 'malformed') {
    if (body.question && !scenario) {
      // 목 응답의 질문 처리: 글자 맞추기로 흉내만 냅니다
      if (/없(어|나|는지|습니까)/.test(body.question)) r.out_of_scope = 'absence';
      else if (/(버스|움직)/.test(body.question)) r.out_of_scope = 'moving';
      else { r.target = 'present'; r.answer = '질문하신 것이 가운데에 있는 것으로 보입니다.'; }
    }
    if (!scenario && body.prevSummary && r.subject && body.prevSummary.startsWith(r.subject) && !body.detail && !body.question && !body.recheck) r.is_new = false;
  }
  return { result: r, microUsd };
}

// ── 요청 검증 ───────────────────────────────────────────────────────────────
const MODES = ['object', 'scene', 'doc_read', 'doc_summary'];
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** @returns {string|null} 문제가 있으면 오류 코드 */
function validateBody(b, cfg) {
  if (!b || typeof b !== 'object') return 'BAD_REQUEST';
  if (!MODES.includes(b.mode)) return 'BAD_REQUEST';
  if (!ID_RE.test(b.deviceId || '') || !ID_RE.test(b.sessionId || '')) return 'BAD_REQUEST';
  for (const k of ['question', 'prevSummary', 'text']) {
    if (b[k] !== undefined && typeof b[k] !== 'string') return 'BAD_REQUEST';
    if (b[k] && b[k].length > cfg.MAX_TEXT_CHARS) return 'TOO_LARGE';
  }
  if (b.mode === 'doc_summary') {
    if (!b.text || b.image) return 'BAD_REQUEST'; // 요약은 사진이 아니라 글자만 받음 (1-2절)
  } else {
    // 이미지 1장, 400KB 이하
    if (typeof b.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image)) return 'BAD_REQUEST';
    const b64 = b.image.slice(b.image.indexOf(',') + 1);
    if ((b64.length * 3) / 4 > cfg.MAX_IMAGE_BYTES) return 'TOO_LARGE';
  }
  return null;
}

function cors(request, env) {
  const allowed = (env && env.ALLOWED_ORIGIN) || '*'; // 배포 시 프런트 주소로 좁히십시오
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type, x-mock-scenario, x-mock-delay',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const STATUS_BY_CODE = Object.freeze({
  BAD_REQUEST: 400, NOT_FOUND: 404, TOO_LARGE: 413,
  LIMIT_SESSION: 429, LIMIT_DEVICE: 429, LIMIT_IP: 429, BUDGET_EXHAUSTED: 429,
  UPSTREAM_ERROR: 502, UPSTREAM_FORMAT: 502,
});

export default {
  /** @param {Request} request @param {any} [env] */
  async fetch(request, env = {}) {
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(request, env) };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers });
    const fail = (code) => json({ ok: false, error: { code } }, STATUS_BY_CODE[code] || 500);
    const cfg = config(env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, backend: useOpenAI(env) ? 'openai' : 'mock' });
    if (request.method !== 'POST' || url.pathname !== '/v1/describe') return fail('NOT_FOUND');

    // 요청 크기 제한 → 형식 검증 (2-4절)
    if (Number(request.headers.get('content-length') || 0) > cfg.MAX_BODY_BYTES) return fail('TOO_LARGE');
    const raw = await request.text();
    if (raw.length > cfg.MAX_BODY_BYTES) return fail('TOO_LARGE');
    let body;
    try { body = JSON.parse(raw); } catch { return fail('BAD_REQUEST'); }
    const bad = validateBody(body, cfg);
    if (bad) return fail(bad);

    // 한도 집행: 브라우저가 우회당했을 때의 최종 방어선 (1-1절)
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const lim = limiter(env);
    const adm = await lim.admit({ deviceId: body.deviceId, sessionId: body.sessionId, ip });
    if (!adm.ok) return fail(adm.code);

    let out;
    try {
      out = useOpenAI(env) ? await callOpenAI(env, cfg, body) : await mockRespond(request, cfg, body);
    } catch {
      return fail('UPSTREAM_ERROR'); // 원인 문자열을 응답에 싣지 않음
    }
    if (out.status && out.status >= 500) return fail('UPSTREAM_ERROR');
    if (out.microUsd) await lim.addCost(out.microUsd);
    if (!useOpenAI(env) && request.headers.get('x-mock-scenario') === 'malformed') {
      // 시험용: 프런트의 "응답 형식 이상" 분기를 유발하려고 검증을 건너뛰고 그대로 보냄
      return json({ ok: true, result: out.result, limits: { device_remaining: adm.device_remaining, session_remaining: adm.session_remaining } });
    }
    if (!isValidResult(out.result)) return fail('UPSTREAM_FORMAT');
    return json({ ok: true, result: out.result, limits: { device_remaining: adm.device_remaining, session_remaining: adm.session_remaining } });
  },
};
