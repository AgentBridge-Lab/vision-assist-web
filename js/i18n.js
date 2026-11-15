// @ts-check
/**
 * 언어 선택과 로케일 불러오기.
 * - 지원 언어 8개. 글귀는 js/locales/<코드>.js에 있고 고른 언어 하나만 불러옵니다.
 * - 기본값은 브라우저 언어(navigator.language), 맞는 것이 없으면 한국어. 첫 사용에 언어를 묻는 단계는 두지 않습니다(조작 2회 기준 유지).
 * - 한국어를 뺀 7개 언어는 기계 번역이며 원어민 검수를 받지 않았습니다(README 참조).
 */

/** 언어 선택 항목. name은 그 언어 자신의 표기이고, 항목마다 lang 속성으로 붙습니다. */
export const LANGUAGES = Object.freeze([
  Object.freeze({ code: 'ko', name: '한국어' }),
  Object.freeze({ code: 'zh-CN', name: '中文' }),
  Object.freeze({ code: 'en', name: 'English' }),
  Object.freeze({ code: 'es', name: 'Español' }),
  Object.freeze({ code: 'fr', name: 'Français' }),
  Object.freeze({ code: 'de', name: 'Deutsch' }),
  Object.freeze({ code: 'th', name: 'ไทย' }),
  Object.freeze({ code: 'ja', name: '日本語' }),
]);

export const DEFAULT_LANGUAGE = 'ko';

/**
 * 브라우저 언어 태그 → 지원 언어 코드. 못 맞추면 한국어.
 * 중국어는 간체(zh-CN)만 지원하므로 zh로 시작하는 태그는 모두 zh-CN으로 보냅니다.
 * @param {readonly string[]|string|undefined} tags @returns {string}
 */
export function matchLanguage(tags) {
  for (const tag of [tags].flat()) {
    const primary = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (primary === 'zh') return 'zh-CN';
    const hit = LANGUAGES.find((l) => l.code.toLowerCase() === primary);
    if (hit) return hit.code;
  }
  return DEFAULT_LANGUAGE;
}

const cache = new Map();

/**
 * 로케일 하나를 불러옵니다. 실패하면 한국어로 돌아갑니다.
 * @param {string} code @returns {Promise<any>}
 */
export async function loadLocale(code) {
  const known = LANGUAGES.some((l) => l.code === code) ? code : DEFAULT_LANGUAGE;
  if (!cache.has(known)) {
    try {
      cache.set(known, (await import(`./locales/${known}.js`)).default);
    } catch {
      if (known === DEFAULT_LANGUAGE) throw new Error('locale-load-failed');
      return loadLocale(DEFAULT_LANGUAGE);
    }
  }
  return cache.get(known);
}
