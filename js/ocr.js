// @ts-check
/**
 * OCR 결과 글자 손질.
 *
 * 2026-11-16 결정사항 D-4로 OCR 엔진이 Tesseract.js에서 PaddleOCR(js/paddle-ocr.js)로 바뀌면서
 * 이 파일에 있던 Tesseract 래퍼는 지웠습니다. 폴백으로 남기지 않았습니다 —
 * 같은 세트에서 정확 일치율이 57.1%였고 숫자를 높은 신뢰도로 틀리게 읽었기 때문에,
 * 실패할 때 조용히 그쪽으로 되돌아가면 채택 결정 자체를 무르는 것이 됩니다.
 *
 * 아래 손질은 엔진과 무관한 교정이므로 그대로 남겨 PaddleOCR 결과에도 적용합니다.
 *
 * @typedef {{text:string, confidence:number}} OcrLine
 * @typedef {{text:string, confidence:number, lines:OcrLine[]}} OcrResult
 */

/**
 * 전각 영숫자·기호를 반각으로 바꿉니다(예: "1.5Ｌ" → "1.5L"). 2026-11-16 측정에서 반복해 나온 계통 오류입니다.
 * - 글자의 폭만 바꿉니다. 한글과 한자, 가나는 건드리지 않고, 읽히지 않은 글자를 채우거나 고치지도 않습니다.
 * - 중국어·일본어 문서(keepPunctuation)는 전각 문장부호가 원문의 정상 표기이므로 영숫자만 바꾸고,
 *   기호는 숫자에 붙은 것(１．５ ／ ５０％ 등)만 바꿉니다.
 * @param {string} text
 * @param {boolean} [keepPunctuation]
 */
export function normalizeWidth(text, keepPunctuation = false) {
  const half = (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  let s = String(text || '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, half);
  if (keepPunctuation) return s.replace(/(?<=\d)[．，：／－～](?=\d)|(?<=\d)％/g, half);
  return s.replace(/[！-～]/g, half).replace(/　/g, ' ');
}
