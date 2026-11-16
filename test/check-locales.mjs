// 로케일 검사 — Node 내장만 사용합니다.   node test/check-locales.mjs [--only fr]
// 1) 8개 로케일(js/locales)과 목 글귀(worker/mock)의 키 집합·값 종류가 한국어 기준과 완전히 같은지
// 2) 한국어가 아닌 로케일의 글귀에 한글이 섞이지 않았는지
// 3) 금지 표현 목록·질문 가려내기·"카메라 기준" 붙이기가 그 언어의 시험 문장에 실제로 걸리는지
// 번역 품질은 이 검사로 알 수 없습니다(README "번역" 참조).
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 로케일과 OCR 모델 지도가 어긋나면 그 언어는 문서 읽기를 못 씁니다. 같이 봅니다
const OCR_LANGS = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'models/manifest.json'), 'utf8')).langMap);

const EXPECT = {
  ko: { htmlLang: 'ko', speechTag: 'ko-KR', name: '한국어' },
  'zh-CN': { htmlLang: 'zh-CN', speechTag: 'zh-CN', name: '中文' },
  en: { htmlLang: 'en', speechTag: 'en-US', name: 'English' },
  es: { htmlLang: 'es', speechTag: 'es-ES', name: 'Español' },
  fr: { htmlLang: 'fr', speechTag: 'fr-FR', name: 'Français' },
  de: { htmlLang: 'de', speechTag: 'de-DE', name: 'Deutsch' },
  th: { htmlLang: 'th', speechTag: 'th-TH', name: 'ไทย' },
  ja: { htmlLang: 'ja', speechTag: 'ja-JP', name: '日本語' },
};
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const codes = only ? ['ko', only].filter((c, i, a) => a.indexOf(c) === i) : Object.keys(EXPECT);
const HANGUL = /[가-힣]/;
let fail = 0;
const bad = (msg) => { fail++; console.log('FAIL ' + msg); };

const load = async (rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  return (await import(pathToFileURL(file).href)).default;
};

/** 값의 모양: 키 경로 → 종류. 함수는 인자 수, 배열은 길이까지 봅니다(금지 표현 목록처럼 언어마다 길이가 다른 것은 제외). */
function shape(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v instanceof RegExp) out.set(p, 'regexp');
    else if (typeof v === 'function') out.set(p, `function/${v.length}`);
    else if (Array.isArray(v)) out.set(p, /^(forbidden|read)\./.test(p) ? 'array' : `array/${v.length}`);
    else if (v && typeof v === 'object') shape(v, p, out);
    else out.set(p, typeof v);
  }
  return out;
}

function compareShape(kind, code, base, other) {
  const a = shape(base), b = shape(other);
  for (const [k, t] of a) {
    if (!b.has(k)) bad(`${kind} ${code}: 키 없음 ${k}`);
    else if (b.get(k) !== t) bad(`${kind} ${code}: 종류 다름 ${k} (기준 ${t}, 실제 ${b.get(k)})`);
  }
  for (const k of b.keys()) if (!a.has(k)) bad(`${kind} ${code}: 기준에 없는 키 ${k}`);
}

/** 화면이나 음성에 나갈 수 있는 모든 글귀(함수는 예시 인자로 불러 봄). */
function strings(obj, out = []) {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { try { out.push(String(v('7', '8'))); } catch { /* 예시 인자가 맞지 않는 함수 */ } }
    else if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' && out.push(x));
    else if (v && typeof v === 'object' && !(v instanceof RegExp)) strings(v, out);
  }
  return out;
}

const hits = (list, sentence) => list.some((w) => sentence.toLowerCase().includes(w));

const baseLocale = await load('js/locales/ko.js');
const baseMock = await load('worker/mock/ko.js');

for (const code of codes) {
  const L = await load(`js/locales/${code}.js`);
  const M = await load(`worker/mock/${code}.js`);
  if (!L) { bad(`로케일 파일 없음 js/locales/${code}.js`); continue; }
  if (!M) { bad(`목 글귀 파일 없음 worker/mock/${code}.js`); continue; }
  const before = fail;

  compareShape('로케일', code, baseLocale, L);
  compareShape('목 글귀', code, baseMock, M);
  if (fail > before) continue; // 모양이 다르면 아래 검사는 뜻이 없음

  for (const [k, v] of Object.entries({ code, ...EXPECT[code] })) if (L.meta[k] !== v) bad(`로케일 ${code}: meta.${k}는 ${JSON.stringify(v)}여야 함`);

  if (code !== 'ko') {
    for (const s of strings(L)) if (HANGUL.test(s)) bad(`로케일 ${code}: 한글이 섞임 → ${s.slice(0, 40)}`);
    for (const s of strings(M)) if (HANGUL.test(s)) bad(`목 글귀 ${code}: 한글이 섞임 → ${s.slice(0, 40)}`);
  }

  // 금지 표현 목록
  for (const [kind, list] of Object.entries(L.forbidden)) {
    if (!list.length) bad(`로케일 ${code}: forbidden.${kind}가 비어 있음`);
    for (const w of list) if (w !== w.toLowerCase()) bad(`로케일 ${code}: forbidden.${kind}의 "${w}"는 소문자여야 함`);
  }
  const all = [...L.forbidden.navigation, ...L.forbidden.usage];
  const d = M.details;
  if (!hits(L.forbidden.navigation, d.corridorBad1)) bad(`${code}: corridorBad1이 이동 금지 표현에 걸리지 않음`);
  if (!hits(L.forbidden.navigation, d.corridorBad2)) bad(`${code}: corridorBad2가 이동 금지 표현에 걸리지 않음`);
  if (!hits(L.forbidden.usage, d.panelBad)) bad(`${code}: panelBad가 조작 금지 표현에 걸리지 않음`);
  if (!hits(L.forbidden.medicine, d.medicineBad)) bad(`${code}: medicineBad가 약 금지 표현에 걸리지 않음`);
  for (const k of ['milk', 'noodles', 'water', 'remote', 'shelfLeft', 'shelfRight', 'table', 'deskPerson', 'deskMonitor', 'panelPosition', 'corridorDoor']) {
    if (hits(all, d[k])) bad(`${code}: 정상 문장 details.${k}가 금지 표현에 걸림 → ${all.find((w) => d[k].toLowerCase().includes(w))}`);
  }
  for (const s of [M.answer, ...Object.values(L.outOfScope), ...Object.values(L.quality), L.rule.navReplaced]) {
    if (hits(all, s)) bad(`${code}: 고정 문구가 금지 표현에 걸림 → ${s.slice(0, 40)} / ${all.find((w) => s.toLowerCase().includes(w))}`);
  }

  // "카메라 기준" 붙이기
  for (const k of ['shelfLeft', 'shelfRight', 'deskMonitor', 'panelPosition', 'corridorDoor']) {
    const once = L.fmt.cameraBasis(d[k]);
    if (once === d[k]) bad(`${code}: cameraBasis가 details.${k}를 바꾸지 않음`);
    if (L.fmt.cameraBasis(once) !== once) bad(`${code}: cameraBasis를 두 번 적용하면 또 바뀜 (details.${k})`);
  }
  if (L.fmt.cameraBasis(d.table) !== d.table) bad(`${code}: 이미 카메라 기준이 있는 details.table을 바꿈`);
  if (L.fmt.cameraBasis(d.milk) !== d.milk) bad(`${code}: 좌우가 없는 details.milk를 바꿈`);

  // 문장 틀
  if (!L.fmt.seems('XYZ').includes('XYZ')) bad(`${code}: fmt.seems가 대상을 담지 않음`);
  if (!L.fmt.quote('XYZ').includes('XYZ')) bad(`${code}: fmt.quote가 원문을 담지 않음`);
  const rc = L.fmt.recheckChanged('AAA', 'BBB');
  if (!rc.includes('AAA') || !rc.includes('BBB')) bad(`${code}: fmt.recheckChanged가 두 결론을 담지 않음`);
  if (L.rule.recheckSame(1) === L.rule.recheckSame(2)) bad(`${code}: rule.recheckSame이 횟수를 담지 않음`);
  if (!L.status.ocrDownloading(40).includes('40')) bad(`${code}: status.ocrDownloading이 진행률을 담지 않음`);
  if (!L.status.ocrAskDownload(21).includes('21')) bad(`${code}: status.ocrAskDownload이 크기를 담지 않음`);
  if (!OCR_LANGS.includes(code)) bad(`${code}: models/manifest.json의 langMap에 없습니다 — 이 언어는 문서 읽기를 못 씁니다`);

  // 담당 밖 질문 가려내기: 위에서부터 차례로 맞춤(js/phrases.js의 classifyQuestion과 같은 순서)
  const classify = (q) => Object.keys(L.question).find((k) => L.question[k].test(q)) || null;
  for (const k of ['navigation', 'identity', 'usage', 'medicine_advice']) {
    if (classify(M.questions[k]) !== k) bad(`${code}: 시험 질문 "${M.questions[k]}"가 ${k}로 분류되지 않음 (실제 ${classify(M.questions[k])})`);
  }
  for (const k of ['ok', 'absence', 'moving']) if (classify(M.questions[k]) !== null) bad(`${code}: 담당 안 질문 "${M.questions[k]}"가 ${classify(M.questions[k])}로 잘못 분류됨`);
  if (!M.questionPatterns.absence.test(M.questions.absence)) bad(`${code}: 목 questionPatterns.absence가 시험 질문에 맞지 않음`);
  if (!M.questionPatterns.moving.test(M.questions.moving)) bad(`${code}: 목 questionPatterns.moving이 시험 질문에 맞지 않음`);
  if (M.questionPatterns.absence.test(M.questions.ok) || M.questionPatterns.moving.test(M.questions.ok)) bad(`${code}: 목 questionPatterns가 보통 질문에 걸림`);

  if (fail === before) console.log(`PASS ${code}: 키 ${shape(L).size}개 + 목 글귀 ${shape(M).size}개`);
}

console.log(fail ? `\nFAIL ${fail}건` : `\nPASS 전체 (${codes.join(', ')})`);
process.exit(fail ? 1 : 0);
