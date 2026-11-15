# 디자인 토큰 — 레퍼런스 선정 근거와 실측값

- 작성: 2026-11-16
- 성격: **직접 디자인하지 않고 검증된 레퍼런스에서 가져온 값.** 모든 대비비는 이 문서 작성자가 WCAG 상대휘도 공식으로 직접 계산했습니다
- 적용 대상: 시각장애인용 시각보조 모바일 웹 (v2 기획서 §1-4 "프레임워크 없는 TypeScript + 정적 빌드")

## 1. 레퍼런스 선정

### 선정: GOV.UK Design System (`alphagov/govuk-frontend`)

| 기준 | 확인 결과 |
|---|---|
| 라이선스 | **MIT** (GitHub API 확인) — 오픈소스 공개에 제약 없음 |
| 유지 상태 | 1,484★, 최종 푸시 2026-11-12 (활발) |
| 스택 적합성 | **프레임워크 불필요.** 컴파일된 순수 CSS를 CDN으로 배포(`govuk-frontend@5.7.1/dist/govuk/govuk-frontend.min.css`, 121KB, HTTP 200 확인) |
| 접근성 근거 | 영국 정부 전 서비스에 적용되어 가장 많이 검증된 공공 디자인 시스템 |
| 실측 대비비 | 아래 2절. 컨트롤 전부 WCAG AA 통과 |

### 기각한 후보

| 후보 | 기각 이유 |
|---|---|
| KRDS CSS 직접 사용 | 사이트 하단이 `© 2023 Ministry of the Interior and Safety. **All rights reserved.**` 공개 라이선스 표기를 찾지 못했습니다. CSS 복사는 배포 위험이 있어 **수치 규격만 참조**합니다 |
| USWDS (`uswds/uswds`) | 라이선스가 GitHub API에서 `NOASSERTION`으로 표기돼 공개 배포 가능 여부가 불명확 |
| HANUI (`oddodd-io/hanui`), moru-krds-react | **React 컴포넌트 라이브러리.** v2가 프레임워크를 명시적으로 기각했으므로 부적합 |
| future-krds | 저장소 자체가 "third-party Codex skill bundle and validation harness. **It is not an official KRDS project**"라고 밝힘. 컴포넌트 라이브러리가 아님 |
| Awwwards 류 수상 갤러리 | 시각적 화려함을 최적화한 사이트들로, 대비·터치 타깃 측정에서 통과를 기대할 수 없습니다. 이 앱은 저시력·화면읽기 우선이므로 선정 기준이 다릅니다 |

## 2. 실측 대비비 (직접 계산)

WCAG 2.x 상대휘도 공식 `(L1+0.05)/(L2+0.05)` 적용.

| 항목 | 전경 | 배경 | 대비 | 기준 | 판정 |
|---|---|---|---|---|---|
| 본문 텍스트 | `#0b0c0c` | `#ffffff` | **19.59:1** | 4.5:1 | PASS (AAA) |
| 보조 텍스트 | `#505a5f` | `#ffffff` | **7.07:1** | 4.5:1 | PASS (AAA) |
| 링크 | `#1d70b8` | `#ffffff` | **5.17:1** | 4.5:1 | PASS |
| 오류 | `#d4351c` | `#ffffff` | **4.86:1** | 4.5:1 | PASS |
| 버튼 글자 | `#ffffff` | `#00703c` | **6.21:1** | 4.5:1 | PASS |
| 포커스 글자 | `#0b0c0c` | `#ffdd00` | **14.55:1** | 4.5:1 | PASS (AAA) |
| 연한 배경 위 글자 | `#0b0c0c` | `#f3f2f1` | **17.52:1** | 4.5:1 | PASS (AAA) |
| 선명 모드 글자 | `#ffffff` | `#0b0c0c` | **19.59:1** | 4.5:1 | PASS (AAA) |
| 입력·선택 테두리 | `#0b0c0c` (2px) | `#ffffff` | **19.59:1** | 3:1 | PASS |

### 측정으로 발견한 주의사항 (반드시 지킬 것)

`#b1b4b6`은 흰 배경에서 **2.08:1로 WCAG 1.4.11(3:1) 미달**입니다. GOV.UK는 이 색을 `.govuk-section-break--visible`, 아코디언 구분선, 조건부 노출 영역 등 **장식용 구분선에만** 쓰고, 입력·선택 컨트롤에는 `2px solid #0b0c0c`를 씁니다(CSS 원문 확인).

> **규칙: `#b1b4b6`은 순수 장식 구분선에만 사용한다. 경계·상태·포커스·컨트롤 외곽선 등 의미를 전달하는 모든 선은 `#505a5f`(7.07:1) 또는 `#0b0c0c`(19.59:1)를 쓴다.**

## 3. 색상 토큰

```css
:root {
  /* GOV.UK 팔레트 (MIT) */
  --c-text:        #0b0c0c;  /* 본문 */
  --c-text-weak:   #505a5f;  /* 보조. 의미 있는 테두리에도 사용 가능 */
  --c-bg:          #ffffff;
  --c-bg-alt:      #f3f2f1;  /* 연한 면 */
  --c-link:        #1d70b8;
  --c-link-visited:#4c2c92;
  --c-error:       #d4351c;
  --c-success:     #00703c;  /* 버튼 기본 */
  --c-focus:       #ffdd00;  /* 포커스 배경 */
  --c-focus-text:  #0b0c0c;
  --c-divider:     #b1b4b6;  /* 장식 전용. 2절 규칙 참조 */
}
```

선명 모드(어두운 배경)는 `--c-text`와 `--c-bg`를 교환합니다. 대비 19.59:1이 유지됩니다.

## 4. 포커스 표시 (GOV.UK 방식 채택)

GOV.UK의 포커스 스타일은 노란 배경 + 하단 두꺼운 검정선 조합으로, 고대비 모드와 Windows 강제 색 모드에서도 사라지지 않습니다.

```css
:focus-visible {
  outline: 3px solid transparent;       /* 강제 색 모드 대비 */
  background-color: var(--c-focus);
  box-shadow: 0 -2px var(--c-focus), 0 4px var(--c-focus-text);
  color: var(--c-focus-text);
}
```

KRDS 가이드라인은 4px 포커스 테두리를 권고합니다. 위 `0 4px`가 그 두께를 충족합니다.

## 5. 한국어 타이포그래피 — KRDS 수치 규격 참조

KRDS 공개 가이드라인의 **수치만** 가져왔습니다(CSS 복사 아님).

| 항목 | 값 | 출처 |
|---|---|---|
| 본문 최소 크기 | **17px 이상** | KRDS UI/UX 가이드라인 (2025.08 요약 경유) |
| 행간 | **1.5배 이상** | KRDS `--krds-line-height-base: 1.5` (사이트 CSS에서 확인) |
| 글자 두께 | **400, 700만 사용** | KRDS `--krds-font-weight-regular: 400`, `--krds-font-weight-bold: 700` (확인) |
| 모바일 좌우 여백 | **16px** | KRDS `--krds-contents-padding-x: 16px` (모바일 미디어쿼리에서 확인) |
| 색 대비 | 4.5:1 | KRDS가 WCAG 2.1 AA를 목표로 명시 (krds.go.kr 공식) |

### 글자 크기 5단계 — KRDS 사이트의 구현 패턴을 차용

KRDS 사이트 자체가 **작게·보통·조금 크게·크게·가장 크게** 5단계와 **기본(밝은 배경)·선명하게(어두운 배경)** 2개 모드를 제공합니다(사이트에서 확인). 정부 서비스 수준으로 검증된 저시력 기능이므로 이 패턴을 채택합니다. 이는 v2 결정사항 **D-9(저시력 시각 출력 제공)**의 직접 구현입니다.

```css
:root { --fs-base: 17px; }             /* 보통 */
:root[data-fs="xs"] { --fs-base: 15px; }
:root[data-fs="s"]  { --fs-base: 16px; }
:root[data-fs="l"]  { --fs-base: 20px; }
:root[data-fs="xl"] { --fs-base: 24px; }
:root[data-fs="xxl"]{ --fs-base: 30px; }
body { font-size: var(--fs-base); line-height: 1.5; }
```

### 폰트

```css
font-family: Pretendard, -apple-system, BlinkMacSystemFont,
             "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
```

**Pretendard 라이선스 — 확인 완료 (2026-11-16)**: `orioncactus/pretendard`의 LICENSE 원문에 `SIL OPEN FONT LICENSE Version 1.1`이 명시돼 있습니다(원문 문자열 확인). GitHub API가 `NOASSERTION`으로 표기한 것은 OFL을 자동 인식하지 못한 것일 뿐입니다. **OFL 1.1은 임베드·재배포·상업적 사용을 허용하므로 공개 배포에 문제 없습니다.**

OFL 준수 사항 두 가지만 지키십시오.
- 폰트 파일을 재배포할 경우 LICENSE 사본을 동봉합니다. CDN 링크로만 불러오면 재배포가 아닙니다
- `Reserved Font Name 'Pretendard'` 조항이 있으므로, 폰트를 **수정**해 배포할 때는 이름에 Pretendard를 쓸 수 없습니다. 우리는 수정하지 않으므로 해당 없습니다

GOV.UK의 `GDS Transport` 폰트는 영국 정부 전용이므로 **사용하지 않습니다.**

## 6. 간격·터치 타깃

| 항목 | 값 | 근거 |
|---|---|---|
| 터치 타깃 최소 | **48×48px** | WCAG 2.2 Target Size(Minimum) 24px의 2배. 저시력·운동 제약 사용자를 위해 여유를 둠 |
| 주 버튼(모드 선택) | 화면 가로 전체, 높이 **최소 72px** | v2 §3-2. 한 손·장갑·떨림 상태에서 누를 수 있어야 함 |
| 버튼 간 간격 | 최소 **12px** | 오작동 방지 |
| 좌우 여백 | 16px | KRDS 모바일 값 |
| 수직 리듬 | 8px 배수 | GOV.UK 간격 체계와 호환 |

## 7. 적용 방식

govuk-frontend CSS 121KB 전체를 불러오지 않습니다. 화면이 3개뿐이고 쓰는 컴포넌트가 버튼·오류 메시지·상태 영역뿐이므로, **위 토큰과 포커스 규칙만 자체 CSS로 구현**합니다. MIT 라이선스 고지를 저장소에 포함합니다.

필요한 컴포넌트 패턴은 govuk-frontend CSS 원문에서 해당 셀렉터를 참조합니다(버튼 `.govuk-button`, 오류 `.govuk-error-message`, 포커스 `:focus`).
