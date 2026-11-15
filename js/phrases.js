// @ts-check
/**
 * 문구와 문장 규칙을 한 곳에 모은 파일.
 * - 문구 출처는 기획서 v2 절 번호로 표시했습니다.
 * - [구현 초안] 표시는 기획서에 문구가 없어 구현자가 임시로 쓴 것입니다. 당사자 시험(5단계)에서 다듬어야 합니다.
 * - 정상 설명(composeDescription)과 오류 안내(ERRORS)는 서로 다른 자료·다른 화면 영역을 씁니다(4-1절).
 */

/** 모드 이름과 버튼 보조 설명 (3-2절) */
export const MODES = Object.freeze({
  object: { name: '물건 설명', title: '1. 물건 설명', desc: '손에 든 물건이나 앞에 놓인 물건을 알려 드립니다' },
  scene: { name: '주변 살펴보기', title: '2. 주변 살펴보기', desc: '멈춰서 둘러보는 기능입니다. 길 안내는 하지 않습니다' },
  doc: { name: '글자·문서 읽기', title: '3. 글자·문서 읽기', desc: '문서를 적힌 그대로 읽어 드립니다. 사진은 휴대전화 밖으로 나가지 않습니다' },
});

/** 첫 사용 안내 네 문장 (3-2절) */
export const GUIDE = Object.freeze([
  '멈춰서 쓰는 도구입니다. 걸으면서 길 판단에 쓰지 마세요.',
  '물건 설명과 주변 살펴보기는 사진을 외부 AI로 보냅니다. 글자·문서 읽기는 보내지 않습니다.',
  '틀릴 수 있습니다. 약, 돈, 날짜는 한 번 더 확인해 주세요.',
  '하루에 쓸 수 있는 횟수가 정해져 있습니다.',
]);

/** 상태 안내 (3-5절) */
export const STATUS = Object.freeze({
  start: {
    object: '물건 설명을 시작합니다. 물건을 카메라 앞에 대 주세요.',
    scene: '주변 살펴보기를 시작합니다. 멈춰서 둘러보는 기능입니다. 걸으면서 길 판단에 쓰지 마세요.',
    doc: '글자·문서 읽기를 시작합니다. 문서를 카메라 앞에 대 주세요.', // [구현 초안]
  },
  frameWait: '카메라를 잠깐 멈춰 주세요.',
  analyzing: '확인하는 중입니다.',
  slow: '응답이 늦어지고 있습니다. 조금 더 기다립니다.',
  noChange: '변화가 없어 기다리는 중입니다.',
  fixed: '지금 대상을 고정했습니다. 휴대전화를 내려놓으셔도 됩니다.',
  unfixed: '고정을 풀었습니다.', // [구현 초안]
  paused: '일시정지했습니다.',
  resumed: '다시 시작했습니다.', // [구현 초안]
  idlePaused: '3분 동안 조작이 없어 일시정지했습니다. 다시 시작 버튼으로 이어서 쓸 수 있습니다.',
  returned: '일시정지 상태입니다. 다시 시작 버튼을 눌러 주세요.',
  docFixed: '문서를 고정했습니다. 원문을 읽어 드립니다.',
  stopped: '종료했습니다. 카메라를 껐습니다.',
  sceneMoving: '움직이는 동안에는 설명하지 않습니다. 멈추면 다시 살펴봅니다.', // 3-3절
  cameraReconnected: '카메라를 다시 연결했습니다.', // 4-1절
  wakeLockDenied: '화면이 꺼지면 멈춥니다.', // 1-5절
  remaining: (n) => `오늘 남은 횟수가 ${n}번입니다.`, // 4-3절
  sessionLimit: (n) => `이번 사용에서 ${n}번 설명해 일시정지했습니다. 다시 시작 버튼으로 이어서 쓸 수 있습니다.`, // [구현 초안] 2-4절 동작
  busy: '앞의 요청을 확인하는 중입니다. 잠시 뒤 다시 눌러 주세요.', // [구현 초안]
  noLast: '아직 들려 드릴 설명이 없습니다.', // [구현 초안]
  needQuestion: '질문을 먼저 적어 주세요.', // [구현 초안]
  rateChanged: '이 빠르기입니다.', // 3-3절 11번
  rateLimit: '더 바꿀 수 없는 빠르기입니다.', // [구현 초안]
  volumeChanged: '이 크기입니다.', // [구현 초안]
  volumeMax: '휴대전화 옆면의 소리 버튼을 눌러 주세요.', // 3-3절 12번
  volumeMin: '가장 작은 소리입니다.', // [구현 초안]
  muted: '소리를 껐습니다. 화면의 글자로 알려 드립니다.', // [구현 초안] 화면에만 표시
  unmuted: '소리를 켰습니다.', // [구현 초안]
  // 글자·문서 읽기
  ocrPreparing: '글자 읽기를 준비하는 중입니다. 처음에는 시간이 걸립니다.', // [구현 초안]
  ocrReading: '글자를 읽는 중입니다. 잠깐 그대로 들고 계세요.', // [구현 초안]
  ocrNoText: '글자를 읽지 못했습니다. 문서를 조금 멀리 하거나 밝은 곳에서 다시 비춰 주세요.', // [구현 초안]
  ocrUnavailable: '이 기기에서는 글자 읽기 기능을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시작해 주세요.', // [구현 초안]
  docEnd: '끝까지 읽었습니다.', // [구현 초안]
  docFirst: '첫 문장입니다.', // [구현 초안]
  docLast: '마지막 문장입니다.', // [구현 초안]
  docNew: '새 문서를 비춰 주세요.', // [구현 초안]
  docNeedText: '먼저 문서를 읽어야 요약을 요청할 수 있습니다.', // [구현 초안]
  confirmSendText: '글자가 외부 AI로 전송됩니다. 계속하려면 한 번 더 누르세요.', // 3-3절
  confirmSendPhoto: '사진이 외부 AI로 전송됩니다. 계속하려면 한 번 더 누르세요.', // 3-3절
  fontSize: (name) => `글자 크기: ${name}`,
  fontMin: '가장 작은 글자입니다.',
  fontMax: '가장 큰 글자입니다.',
});

/**
 * 오류 문구 (4-1절). 종류는 발생 지점에서 정해지며 응답 문장을 해석해 고르지 않습니다.
 * @type {Readonly<Record<string, string>>}
 */
export const ERRORS = Object.freeze({
  // 1) 카메라
  camera_unsupported: '이 브라우저에서는 카메라를 쓸 수 없습니다.', // 1-5절
  camera_denied: '카메라 사용이 허용되지 않았습니다. 브라우저 주소창의 사이트 설정에서 카메라를 허용한 뒤 다시 시도 버튼을 눌러 주세요.',
  camera_notfound: '카메라를 찾지 못했습니다.',
  camera_busy: '다른 앱이 카메라를 쓰고 있습니다. 그 앱을 닫고 다시 시도 버튼을 눌러 주세요.',
  camera_stalled: '카메라가 멈췄습니다. 종료 후 다시 시작해 주세요.',
  // 2) 네트워크
  network: '인터넷 연결이 끊겼습니다. 연결되면 자동으로 이어 갑니다. 글자·문서 읽기는 지금도 쓸 수 있습니다.',
  // 서비스 장애, 응답 형식 이상(같은 문구가 정상)
  service: '서비스에 문제가 생겼습니다. 사용자님의 휴대전화나 인터넷 문제가 아닙니다. 잠시 뒤 다시 시도해 주세요.',
  // 3) 한도 소진
  limit_device: '오늘 사용할 수 있는 횟수를 모두 썼습니다. 내일 0시에 다시 쓸 수 있습니다. 글자·문서 읽기는 계속 쓸 수 있습니다.',
  limit_budget: '이번 달 무료 운영 예산이 소진되어 물건 설명과 주변 살펴보기를 쉬고 있습니다. 글자·문서 읽기는 계속 쓸 수 있습니다.',
});

/** 4) 사진 품질 (4-1절, 4-2절, 1-6절). 전송 전(게이트 1)과 전송 후(응답의 품질 항목)가 같은 표를 씁니다. */
export const QUALITY = Object.freeze({
  dark: '너무 어둡습니다. 밝은 곳으로 옮겨 주세요.',
  blur: '사진이 흔들렸습니다. 잠깐 멈춰 주세요.',
  blurRepeated: '계속 흐리게 찍힙니다. 물건을 탁자에 놓고 휴대전화를 30센티미터쯤 위에서 들어 주세요.',
  cut: '글자가 잘렸습니다. 휴대전화를 조금 멀리 해 주세요.',
  glare: '빛이 반사됩니다. 각도를 조금 바꿔 주세요.',
  far: '멀어서 글자를 읽지 못했습니다. 가까이 가서 다시 비춰 주세요.',
});

/** 담당 밖 요청 문구 (1-6절 표 그대로) */
export const OUT_OF_SCOPE = Object.freeze({
  navigation: '길 안내는 제공하지 않습니다. 멈춰서 보이는 것만 알려 드립니다.',
  identity: '누구인지는 알려 드리지 않습니다. 사람이 보인다는 것까지만 말씀드립니다.',
  usage: '사용법은 안내하지 않습니다. 버튼에 적힌 글자만 읽어 드립니다.',
  medicine_advice: '약의 효능이나 먹는 방법은 알려 드리지 않습니다. 적힌 글자만 읽어 드립니다. 약사에게 확인해 주세요.',
  absent: '지금 화면에는 보이지 않습니다. 카메라를 천천히 옆으로 옮겨 주세요.',
  uncertain: '비슷한 것이 보이지만 확실하지 않습니다. 가까이 대고 다시 확인해 주세요.',
  moving: '움직이는 것은 읽지 못합니다.',
  absence: '보이는 범위에는 없습니다. 카메라에 잡히지 않은 곳은 알 수 없습니다.',
  display_off: '표시가 꺼져 있거나 글자가 보이지 않습니다.',
  small_object: '작은 물건은 찾지 못할 수 있습니다. 못 찾았다고 해서 없는 것은 아닙니다.',
});

/** 문장 규칙에 쓰는 고정 어휘 (4-5절 8번: 확신을 나타내는 말은 세 가지로 고정) */
export const RULE = Object.freeze({
  unsurePrefix: '확실하지 않습니다만, ', // 4-5절 5번: 문장 앞에 둠
  unknown: '무엇인지 알 수 없습니다.',
  readFail: '글자를 읽지 못했습니다.',
  cut: '글자가 잘려 일부만 읽었습니다.', // 4-5절 10번
  occluded: '일부가 가려져 보이지 않습니다.', // 4-5절 10번
  importantClosing: '중요한 내용은 다른 방법으로 한 번 더 확인해 주세요.', // 4-5절 6번
  medicineClosing: '먹기 전에 약사나 다른 사람에게 한 번 더 확인해 주세요.', // 4-6절
  medicalValueClosing: '숫자 표시창은 틀리기 쉽습니다. 중요한 수치는 다른 방법으로 확인해 주세요.', // 4-6절
  medicalValueUnverified: '숫자를 두 번 읽어 맞춰 보지 못했습니다. 숫자는 말씀드리지 않습니다.', // [구현 초안] 4-6절 규칙
  navReplaced: '길 안내는 제공하지 않습니다. 보이는 것만 알려 드립니다.', // 4-4절
  recheckSame: (n) => `다시 봐도 같게 보입니다. ${n}번 다시 확인했습니다.`, // 4-5절 11번 + 반복 금지용 횟수 [구현 초안]
  docPartial: '일부 글자는 읽지 못했습니다.', // 4-5절 10번
  docNumberOnce: '숫자를 한 번만 읽어 맞춰 보지 못했습니다.', // [구현 초안]
});

/**
 * 금지 표현 목록 (4-4절: "금지 표현 목록은 저장소에 공개하고 시험으로 보강합니다").
 * 모델이 쓴 자유 문장(요약·추정·답)에만 적용하고, 사진에 적힌 원문(read_text)에는 적용하지 않습니다.
 */
export const FORBIDDEN = Object.freeze({
  // 이동 지시·보행 가능 여부·안전 단정·장애물 회피
  navigation: Object.freeze(['가세요', '가십시오', '가시면', '가면 됩니다', '건너', '피하세요', '피해 ', '피해서', '안전합니다', '안전하게', '안전한',
    '비어 있으니', '직진', '이동하세요', '이동하시', '걸어가', '걸으세요', '지나가세요', '지나가시', '돌아가세요', '도세요', '멈추세요',
    '조심하세요', '위험합니다', '위험하니', '장애물', '통과할 수', '지나갈 수', '갈 수 있']),
  // 기기 조작 지시 (4-6절)
  usage: Object.freeze(['누르세요', '누르십시오', '누르면', '눌러 주세요', '눌러주세요', '눌러서', '돌리세요', '돌리면', '선택하세요', '선택하면',
    '설정하세요', '터치하세요', '길게 누', '작동합니다', '작동됩니다', '사용하세요', '사용하시면']),
  // 약의 효능·복용법 (4-6절)
  medicine: Object.freeze(['효능', '효과가', '효과입니다', '부작용', '복용하세요', '복용하시', '드세요', '드시면', '먹으면', '먹으세요', '바르세요', '치료', '완화',
    '에 좋습니다', '에 쓰는 약', '에 먹는 약']),
});

const REPLACEMENT = Object.freeze({
  navigation: RULE.navReplaced,
  usage: OUT_OF_SCOPE.usage,
  medicine: OUT_OF_SCOPE.medicine_advice,
});

// ── 한국어 조사 ────────────────────────────────────────────────────────────
/** 마지막 글자의 받침 번호(없으면 0, ㄹ은 8). 한글·숫자가 아니면 0. */
function finalConsonant(word) {
  const ch = word.trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
  if ('178'.includes(ch)) return 8; // 일·칠·팔 (ㄹ 받침)
  if ('036'.includes(ch)) return 1; // 영·삼·육
  return 0;
}
/** "(으)로" 붙이기 */
export function ro(word) {
  const j = finalConsonant(word);
  return word.trim() + (j === 0 || j === 8 ? '로' : '으로');
}

/** 문장 나누기(마침표·물음표·느낌표·줄바꿈 기준). */
export function splitSentences(text) {
  return String(text || '').split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 출력 검사 (4-4절 2번, 4-6절). 금지 표현이 든 문장은 낭독하지 않고 고정 문구로 대체합니다.
 * @param {string[]} sentences 모델이 쓴 자유 문장
 * @param {{medicine?:boolean}} [opt] medicine이면 약 효능·복용 표현도 검사
 * @returns {{kept:string[], replacements:string[]}} replacements는 대체 문구(종류별 1회)
 */
export function screenSentences(sentences, opt = {}) {
  const kept = [];
  /** @type {Set<string>} */ const hit = new Set();
  const kinds = /** @type {(keyof typeof FORBIDDEN)[]} */ (opt.medicine ? ['navigation', 'usage', 'medicine'] : ['navigation', 'usage']);
  for (const s of sentences) {
    const kind = kinds.find((k) => FORBIDDEN[k].some((w) => s.includes(w)));
    if (kind) hit.add(kind); else kept.push(s);
  }
  return { kept, replacements: [...hit].map((k) => REPLACEMENT[k]) };
}

/** 좌우가 나오는 문장에는 "카메라 기준"을 붙입니다 (3-3절, 4단계 PASS 기준). */
export function withCameraBasis(sentence) {
  if (!/(왼쪽|오른쪽|좌측|우측)/.test(sentence) || sentence.includes('카메라 기준')) return sentence;
  return sentence.replace(/(왼쪽|오른쪽|좌측|우측)/, '카메라 기준 $1');
}

/**
 * 질문을 보내기 전에 담당 밖 요청을 가려냅니다(1-6절). 걸리면 호출하지 않고 고정 문구로 답합니다.
 * 글자 맞추기라서 놓치는 질문이 있습니다. 놓친 것은 모델 응답의 out_of_scope 항목과 출력 검사가 다시 거릅니다.
 * @param {string} q
 * @returns {'navigation'|'identity'|'usage'|'medicine_advice'|null}
 */
export function classifyQuestion(q) {
  const s = q.replace(/\s+/g, ' ');
  if (/(효능|효과|부작용|복용|먹어도|먹는 ?법|먹는 ?방법|먹으면|몇 ?알|몇 ?번 먹|언제 먹|어디에 좋|무슨 약|어떤 약|바르는 ?법)/.test(s)) return 'medicine_advice';
  if (/(누구|이름이 뭐|아는 사람|어느 차가|내 차|택시가 맞|얼굴)/.test(s)) return 'identity';
  if (/(사용법|사용 ?방법|쓰는 ?법|어떻게 (써|쓰|사용|켜|끄|작동|돌려|조작)|어떤 버튼을|뭘 눌러|무엇을 눌러|어디를 눌러|작동 ?방법|조작 ?방법|켜는 ?법|끄는 ?법)/.test(s)) return 'usage';
  if (/(길|어떻게 가|가는 ?법|가도 돼|가도 되|건너|지나가도|걸어가|출구가 어느|어느 쪽으로 가|어디로 가|장애물|안전한가|안전해|부딪)/.test(s)) return 'navigation';
  return null;
}

/**
 * @typedef {{label:string, text:string}} Line
 * @typedef {{lines:Line[], speech:string, subject:string}} Composed
 */

/** @param {Line[]} lines @param {string} subject @returns {Composed} */
function finish(lines, subject) {
  return { lines, speech: lines.map((l) => l.text).join(' '), subject };
}

/** 고정 문구 하나로 된 설명 */
export function fixedPhrase(text, label = '안내') {
  return finish([{ label, text }], '');
}

/** 읽은 글자의 고정 문형: "…(이)라고 적혀 있습니다." */
const quote = (t) => { const w = String(t).trim(); return `"${w}"${finalConsonant(w) ? '이라고' : '라고'} 적혀 있습니다.`; };

/**
 * 구조화 응답 → 화면 줄과 발화 문장 (4-5절, 4-6절).
 * 순서 고정(9번): 대상 종류 한 문장 → 읽힌 글자 원문 → (요청했을 때만) 추정.
 * 확신 어휘 고정(8번): "…라고 적혀 있습니다" / "…로 보입니다" / "알 수 없습니다".
 *
 * 설명 길이 해석: '한 문장'은 대상 종류 한 문장만, '보통'은 읽힌 글자까지, '자세히'는 추정까지.
 * 단 약·의료 수치·조작판은 길이와 관계없이 읽힌 글자를 함께 말합니다(4-6절이 "적힌 글자만 읽음"을 출력으로 정했기 때문).
 *
 * @param {import('./api.js').DescribeResult} r
 * @param {{length:'one'|'normal'|'detail', detail?:boolean, question?:string,
 *          recheck?:{prevSubject:string, count:number}|null}} opt
 * @returns {Composed}
 */
export function composeDescription(r, opt) {
  // 담당 밖 (1-6절): 내용으로 답하지 않고 정해진 문구만
  if (r.out_of_scope !== 'none') return fixedPhrase(OUT_OF_SCOPE[r.out_of_scope]);
  if (opt.question && r.target === 'absent') return fixedPhrase(OUT_OF_SCOPE.absent);
  if (opt.question && r.target === 'uncertain') return fixedPhrase(OUT_OF_SCOPE.uncertain);

  const medicine = r.high_risk === 'medicine';
  const highRisk = r.high_risk !== 'none';
  const wantRead = highRisk || opt.detail || opt.length !== 'one' || !!opt.question;
  const wantDetail = !medicine && (opt.detail || opt.length === 'detail');
  /** @type {Line[]} */ const lines = [];
  /** @type {Set<string>} */ const replaced = new Set();
  const screen = (arr) => {
    const s = screenSentences(arr, { medicine });
    s.replacements.forEach((x) => replaced.add(x));
    return s.kept.map(withCameraBasis);
  };

  // 1. 대상의 종류 한 문장
  const subject = screen([r.subject || '']).join('').replace(/[.。]\s*$/, '');
  const unknown = r.confidence === 'unknown' || !subject;
  if (opt.recheck && !unknown && opt.recheck.prevSubject) {
    // 4-5절 11번: "다시 확인"은 같은 말을 되풀이하지 않음
    if (opt.recheck.prevSubject === subject) {
      lines.push({ label: '다시 확인', text: RULE.recheckSame(opt.recheck.count) });
      lines.push({ label: '대상', text: `${ro(subject)} 보입니다.` });
    }
    else lines.push({ label: '다시 확인', text: `처음에는 ${opt.recheck.prevSubject}, 지금은 ${ro(subject)} 보입니다. 확실하지 않습니다.` });
  } else if (unknown) {
    lines.push({ label: '대상', text: RULE.unknown });
  } else {
    lines.push({ label: '대상', text: (r.confidence === 'inferred' ? RULE.unsurePrefix : '') + `${ro(subject)} 보입니다.` });
  }

  // 질문에 대한 답(자유 문장 → 출력 검사)
  if (opt.question && r.answer) {
    const a = screen(splitSentences(r.answer));
    if (a.length) lines.push({ label: '답', text: a.join(' ') });
  }

  // 2. 읽힌 글자 원문 — 보완하지 않고 그대로 (3번)
  const read = (r.read_text || []).map((t) => String(t).trim()).filter(Boolean);
  if (wantRead) {
    if (read.length) lines.push({ label: '적힌 글자', text: read.map(quote).join(' ') });
    else if (highRisk) lines.push({ label: '적힌 글자', text: RULE.readFail }); // 4-6절: 추측하지 않고 "읽지 못했습니다"
  }

  // 3. 추정(요청했을 때만). 약은 효능·복용법을 덧붙이지 않으므로 추정을 내지 않음
  if (wantDetail && r.details && r.details.length) {
    const d = screen(r.details.flatMap(splitSentences));
    if (d.length) lines.push({ label: '추정', text: d.join(' ') });
  }

  // 출력 검사에 걸린 문장의 대체 문구
  for (const t of replaced) lines.push({ label: '안내', text: t });

  // 4. 못 본 것 (10번)
  if (r.unread === 'cut') lines.push({ label: '못 본 부분', text: RULE.cut });
  else if (r.unread === 'occluded') lines.push({ label: '못 본 부분', text: RULE.occluded });

  // 5. 전송 후 품질 안내 (4-1절)
  if (r.quality.issue !== 'none' && QUALITY[r.quality.issue]) lines.push({ label: '촬영 안내', text: QUALITY[r.quality.issue] });

  // 6. 고위험 대상의 끝 문구 (4-6절, 4-5절 6번)
  if (medicine) lines.push({ label: '확인', text: RULE.medicineClosing });
  else if (r.high_risk === 'medical_value') lines.push({ label: '확인', text: RULE.medicalValueClosing });
  else if (r.high_risk === 'important_doc') lines.push({ label: '확인', text: RULE.importantClosing });

  return finish(lines, unknown ? '' : subject);
}

const NUM_RE = /\d[\d,.\/:~\-]*\d|\d/g;
/** 글자에서 숫자 표기를 뽑습니다(표기 그대로). */
export function numberTokens(text) {
  return String(text || '').match(NUM_RE) || [];
}

/**
 * 숫자 표시창(혈당계·체온계 등) 규칙 (4-6절): 서로 다른 두 프레임에서 같은 숫자가 읽혔을 때만 말하고, 다르면 둘 다 말함.
 * @param {import('./api.js').DescribeResult} a 첫 프레임 응답
 * @param {import('./api.js').DescribeResult|null} b 둘째 프레임 응답(실패하면 null)
 * @returns {Composed}
 */
export function composeMedicalValue(a, b) {
  const subject = (a.subject || '').replace(/[.。]\s*$/, '');
  /** @type {Line[]} */ const lines = [];
  lines.push({ label: '대상', text: subject ? `${ro(subject)} 보입니다.` : RULE.unknown });
  const na = (a.read_text || []).flatMap(numberTokens);
  const nb = b ? (b.read_text || []).flatMap(numberTokens) : null;
  if (!nb || !na.length) {
    lines.push({ label: '적힌 글자', text: RULE.medicalValueUnverified });
  } else if (na.join('|') === nb.join('|')) {
    lines.push({ label: '적힌 글자', text: (a.read_text || []).map(quote).join(' ') });
  } else {
    lines.push({ label: '적힌 글자', text: `${RULE.unsurePrefix}숫자가 ${na.join(', ')} 또는 ${ro(nb.join(', ') || '읽히지 않음')} 읽힙니다.` });
  }
  lines.push({ label: '확인', text: RULE.medicalValueClosing });
  return finish(lines, subject);
}

const MEDICINE_WORDS = /(약국|조제|처방|복용|투약|1일 ?\d회|하루 ?\d번|식후|식전|취침 ?전|정제|캡슐|시럽|연고|안약|mg|㎎|밀리그램|용법|용량)/i;
const IMPORTANT_WORDS = /(납부|납기|고지서|청구|금액|합계|\d ?원|계약|계좌|입금|만기|기한|보험|세금|과태료|동\s?\d+호)/;

/**
 * 기기 내 OCR 결과 → 낭독 문장 (4-5절 3·4·5·6·10번, 4-6절).
 * - 원문 그대로 읽고 뜻을 풀지 않습니다. 숫자를 보완하지 않습니다.
 * - 숫자가 든 줄은 둘째 프레임의 OCR과 맞춰 보고, 어긋나면 둘 다 말하며 "확실하지 않습니다만"을 앞에 둡니다.
 * @param {import('./ocr.js').OcrResult} a 첫 프레임
 * @param {import('./ocr.js').OcrResult|null} b 둘째 프레임(실패하면 null)
 * @param {{OCR_LINE_DROP_CONF:number, OCR_LINE_UNSURE_CONF:number}} cfg
 * @returns {{sentences:string[], closings:string[], rawText:string}}
 */
export function composeDocument(a, b, cfg) {
  const numsB = b ? b.lines.flatMap((l) => numberTokens(l.text)) : null;
  const numsA = a.lines.flatMap((l) => numberTokens(l.text));
  const sameCount = !!numsB && numsB.length === numsA.length;
  const poolB = numsB ? [...numsB] : [];
  /** @type {string[]} */ const sentences = [];
  /** @type {string[]} */ const kept = [];
  let dropped = false, numberOnce = false, idx = 0;
  for (const line of a.lines) {
    const text = line.text.replace(/\s+/g, ' ').trim();
    const toks = numberTokens(text);
    const startIdx = idx; idx += toks.length;
    if (!text) continue;
    if (line.confidence < cfg.OCR_LINE_DROP_CONF) { dropped = true; continue; }
    kept.push(text);
    let unsure = line.confidence < cfg.OCR_LINE_UNSURE_CONF;
    let tail = '';
    if (toks.length) {
      if (!numsB) { unsure = true; numberOnce = true; }
      else {
        /** @type {string[]} */ const pairs = [];
        toks.forEach((t, k) => {
          const at = poolB.indexOf(t);
          if (at >= 0) { poolB.splice(at, 1); return; }
          const other = sameCount ? numsB[startIdx + k] : '';
          pairs.push(other && other !== t ? `${t} 또는 ${ro(other)} 읽힙니다` : `${t}은 다시 읽었을 때 맞지 않았습니다`);
        });
        if (pairs.length) { unsure = true; tail = ` 이 줄의 숫자는 ${pairs.join(', ')}.`; }
      }
    }
    sentences.push((unsure ? RULE.unsurePrefix : '') + text + tail);
  }
  const all = kept.join(' ');
  /** @type {string[]} */ const closings = [];
  if (dropped) closings.push(RULE.docPartial);
  if (numberOnce) closings.push(RULE.docNumberOnce);
  if (MEDICINE_WORDS.test(all)) closings.push(RULE.medicineClosing);
  else if (IMPORTANT_WORDS.test(all)) closings.push(RULE.importantClosing);
  return { sentences, closings, rawText: kept.join('\n') };
}
