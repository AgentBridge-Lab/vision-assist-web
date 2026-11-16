// @ts-check
/**
 * 문장 규칙 (기획서 v2 4-4절, 4-5절, 4-6절). 글귀 자체는 js/locales/<언어>.js에 있고 여기에는 규칙만 있습니다.
 * - 확신·대상 유무·품질 같은 고정 어휘는 응답에서 열거형으로 받고, 문구는 여기서 고른 언어의 글귀로 바꿉니다.
 *   모델이 "확인 필요" 같은 문구를 직접 쓰게 두지 않습니다.
 * - 정상 설명(composeDescription)과 오류 안내(T.errors)는 서로 다른 자료·다른 화면 영역을 씁니다(4-1절).
 */
import ko from './locales/ko.js';

/** 지금 쓰는 로케일. setLocale로 바꿉니다. @type {typeof ko} */
export let T = ko;

/** @param {typeof ko} locale */
export function setLocale(locale) { T = locale; }

/** 문장 나누기(마침표·물음표·느낌표·전각 문장부호·줄바꿈 기준). */
export function splitSentences(text) {
  return String(text || '').split(/(?<=[.!?])\s+|(?<=[。！？])\s*|\n+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 출력 검사 (4-4절 2번, 4-6절). 금지 표현이 든 문장은 낭독하지 않고 고정 문구로 대체합니다.
 * 모델이 쓴 자유 문장(대상·추정·답)에만 적용하고, 사진에 적힌 원문(read_text)에는 적용하지 않습니다.
 * @param {string[]} sentences
 * @param {{medicine?:boolean}} [opt] medicine이면 약 효능·복용 표현도 검사
 * @returns {{kept:string[], replacements:string[]}} replacements는 대체 문구(종류별 1회)
 */
export function screenSentences(sentences, opt = {}) {
  const kept = [];
  /** @type {Set<string>} */ const hit = new Set();
  const kinds = opt.medicine ? ['navigation', 'usage', 'medicine'] : ['navigation', 'usage'];
  for (const s of sentences) {
    const low = s.toLowerCase();
    const kind = kinds.find((k) => T.forbidden[k].some((w) => low.includes(w)));
    if (kind) hit.add(kind); else kept.push(s);
  }
  const replacement = { navigation: T.rule.navReplaced, usage: T.outOfScope.usage, medicine: T.outOfScope.medicine_advice };
  return { kept, replacements: [...hit].map((k) => replacement[k]) };
}

/** 좌우가 나오는 문장에는 "카메라 기준"을 붙입니다 (3-3절, 4단계 PASS 기준). */
export function withCameraBasis(sentence) { return T.fmt.cameraBasis(sentence); }

/**
 * 질문을 보내기 전에 담당 밖 요청을 가려냅니다(1-6절). 걸리면 호출하지 않고 고정 문구로 답합니다.
 * 글자 맞추기라서 놓치는 질문이 있습니다. 놓친 것은 모델 응답의 out_of_scope 항목과 출력 검사가 다시 거릅니다.
 * @param {string} q
 * @returns {'navigation'|'identity'|'usage'|'medicine_advice'|null}
 */
export function classifyQuestion(q) {
  const s = q.replace(/\s+/g, ' ');
  return /** @type {any} */ (Object.keys(T.question).find((k) => T.question[k].test(s)) || null);
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
export function fixedPhrase(text) {
  return finish([{ label: T.labels.notice, text }], '');
}

/**
 * 목(시험용) 응답에는 매번 고지를 맨 앞에 붙입니다. 음성과 화면 양쪽에 나갑니다.
 * @param {Composed} c @returns {Composed}
 */
export function withDemoNotice(c) {
  return finish([{ label: T.labels.demo, text: T.rule.demoNotice }, ...c.lines], c.subject);
}

/**
 * 구조화 응답 → 화면 줄과 발화 문장 (4-5절, 4-6절).
 * 순서 고정(9번): 대상 종류 한 문장 → 읽힌 글자 원문 → (요청했을 때만) 추정.
 * 확신 어휘 고정(8번): 읽음(fmt.quote) / 추정(fmt.seems) / 모름(rule.unknown).
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
  if (r.out_of_scope !== 'none') return fixedPhrase(T.outOfScope[r.out_of_scope]);
  if (opt.question && r.target === 'absent') return fixedPhrase(T.outOfScope.absent);
  if (opt.question && r.target === 'uncertain') return fixedPhrase(T.outOfScope.uncertain);

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
      lines.push({ label: T.labels.recheck, text: T.rule.recheckSame(opt.recheck.count) });
      lines.push({ label: T.labels.subject, text: T.fmt.seems(subject) });
    } else {
      lines.push({ label: T.labels.recheck, text: T.fmt.recheckChanged(opt.recheck.prevSubject, subject) });
    }
  } else if (unknown) {
    lines.push({ label: T.labels.subject, text: T.rule.unknown });
  } else {
    lines.push({ label: T.labels.subject, text: (r.confidence === 'inferred' ? T.rule.unsurePrefix : '') + T.fmt.seems(subject) });
  }

  // 질문에 대한 답(자유 문장 → 출력 검사)
  if (opt.question && r.answer) {
    const a = screen(splitSentences(r.answer));
    if (a.length) lines.push({ label: T.labels.answer, text: a.join(' ') });
  }

  // 2. 읽힌 글자 원문 — 보완하지 않고 그대로 (3번)
  const read = (r.read_text || []).map((t) => String(t).trim()).filter(Boolean);
  if (wantRead) {
    if (read.length) lines.push({ label: T.labels.readText, text: read.map((t) => T.fmt.quote(t)).join(' ') });
    else if (highRisk) lines.push({ label: T.labels.readText, text: T.rule.readFail }); // 4-6절: 추측하지 않고 "읽지 못했습니다"
  }

  // 3. 추정(요청했을 때만). 약은 효능·복용법을 덧붙이지 않으므로 추정을 내지 않음
  if (wantDetail && r.details && r.details.length) {
    const d = screen(r.details.flatMap(splitSentences));
    if (d.length) lines.push({ label: T.labels.inferred, text: d.join(' ') });
  }

  // 출력 검사에 걸린 문장의 대체 문구
  for (const t of replaced) lines.push({ label: T.labels.notice, text: t });

  // 4. 못 본 것 (10번)
  if (r.unread === 'cut') lines.push({ label: T.labels.unread, text: T.rule.cut });
  else if (r.unread === 'occluded') lines.push({ label: T.labels.unread, text: T.rule.occluded });

  // 5. 전송 후 품질 안내 (4-1절)
  if (r.quality.issue !== 'none' && T.quality[r.quality.issue]) lines.push({ label: T.labels.capture, text: T.quality[r.quality.issue] });

  // 6. 고위험 대상의 끝 문구 (4-6절, 4-5절 6번)
  if (medicine) lines.push({ label: T.labels.confirm, text: T.rule.medicineClosing });
  else if (r.high_risk === 'medical_value') lines.push({ label: T.labels.confirm, text: T.rule.medicalValueClosing });
  else if (r.high_risk === 'important_doc') lines.push({ label: T.labels.confirm, text: T.rule.importantClosing });
  // 그 밖에도 읽어 준 글자에 숫자가 있으면 확인 문구를 붙입니다(용량·주소 같은 일반 숫자도 확신하며 틀리는 것이 측정됨)
  else if (wantRead && read.some((t) => /\d/.test(t))) lines.push({ label: T.labels.confirm, text: T.rule.numberClosing });

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
  lines.push({ label: T.labels.subject, text: subject ? (a.confidence === 'inferred' ? T.rule.unsurePrefix : '') + T.fmt.seems(subject) : T.rule.unknown });
  const na = (a.read_text || []).flatMap(numberTokens);
  const nb = b ? (b.read_text || []).flatMap(numberTokens) : null;
  if (!nb || !na.length) {
    lines.push({ label: T.labels.readText, text: T.rule.medicalValueUnverified });
  } else if (na.join('|') === nb.join('|')) {
    lines.push({ label: T.labels.readText, text: (a.read_text || []).map((t) => T.fmt.quote(t)).join(' ') });
  } else {
    lines.push({ label: T.labels.readText, text: T.rule.unsurePrefix + T.fmt.valueEither(na.join(', '), nb.join(', ') || T.fmt.valueNone) });
  }
  lines.push({ label: T.labels.confirm, text: T.rule.medicalValueClosing });
  return finish(lines, subject);
}

/**
 * 기기 내 OCR 결과 → 낭독 문장 (4-5절 3·4·5·6·10번, 4-6절).
 * - 원문 그대로 읽고 뜻을 풀지 않습니다. 숫자를 보완하지 않습니다.
 * - 숫자가 든 줄은 둘째 프레임의 OCR과 맞춰 보고, 어긋나면 둘 다 말하며 "확실하지 않습니다만"을 앞에 둡니다.
 * @param {import('./ocr.js').OcrResult} a 첫 프레임
 * @param {import('./ocr.js').OcrResult|null} b 둘째 프레임(실패하면 null)
 * - 숫자가 든 줄은 불확실 문턱을 따로(더 높게) 씁니다. 못 미치면 "확실하지 않습니다만"을 앞에 붙일 뿐, 숫자를 고치거나 채우지 않습니다.
 * - 숫자가 하나라도 읽혔으면 끝에 숫자 확인 문구를 붙입니다(약·의료 수치에 한정하지 않음).
 * @param {{OCR_LINE_DROP_CONF:number, OCR_LINE_UNSURE_CONF:number, OCR_NUMBER_LINE_UNSURE_CONF:number}} cfg
 * @returns {{sentences:string[], closings:string[], rawText:string}}
 */
export function composeDocument(a, b, cfg) {
  const numsB = b ? b.lines.flatMap((l) => numberTokens(l.text)) : null;
  const numsA = a.lines.flatMap((l) => numberTokens(l.text));
  const sameCount = !!numsB && numsB.length === numsA.length;
  const poolB = numsB ? [...numsB] : [];
  /** @type {string[]} */ const sentences = [];
  /** @type {string[]} */ const kept = [];
  let dropped = false, numberOnce = false, hasNumber = false, idx = 0;
  for (const line of a.lines) {
    const text = line.text.replace(/\s+/g, ' ').trim();
    const toks = numberTokens(text);
    const startIdx = idx; idx += toks.length;
    if (!text) continue;
    if (line.confidence < cfg.OCR_LINE_DROP_CONF) { dropped = true; continue; }
    kept.push(text);
    let unsure = line.confidence < (toks.length ? cfg.OCR_NUMBER_LINE_UNSURE_CONF : cfg.OCR_LINE_UNSURE_CONF);
    if (toks.length) hasNumber = true;
    let tail = '';
    if (toks.length) {
      if (!numsB) { unsure = true; numberOnce = true; }
      else {
        /** @type {string[]} */ const pairs = [];
        toks.forEach((t, k) => {
          const at = poolB.indexOf(t);
          if (at >= 0) { poolB.splice(at, 1); return; }
          const other = sameCount ? numsB[startIdx + k] : '';
          pairs.push(other && other !== t ? T.fmt.docEither(t, other) : T.fmt.docMismatch(t));
        });
        if (pairs.length) { unsure = true; tail = T.fmt.docTail(pairs.join(', ')); }
      }
    }
    sentences.push((unsure ? T.rule.unsurePrefix : '') + text + tail);
  }
  const all = kept.join(' ');
  /** @type {string[]} */ const closings = [];
  if (dropped) closings.push(T.rule.docPartial);
  if (numberOnce) closings.push(T.rule.docNumberOnce);
  // 숫자·단위는 신뢰도가 높아도 틀리게 읽히는 일이 측정으로 확인됐습니다. 숫자가 읽힌 모든 낭독에 확인 문구를 붙입니다
  if (hasNumber) closings.push(T.rule.numberClosing);
  if (T.docWords.medicine.test(all)) closings.push(T.rule.medicineClosing);
  else if (!hasNumber && T.docWords.important.test(all)) closings.push(T.rule.importantClosing); // 숫자가 있으면 위 문구가 같은 권고를 이미 함
  return { sentences, closings, rawText: kept.join('\n') };
}
