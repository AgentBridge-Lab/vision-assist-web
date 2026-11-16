# 프록시 배포 안내 (실제 AI 연결)

이 문서대로 하면 **API 키가 코드나 대화에 남지 않습니다.** 키는 사용자가 직접 Cloudflare secret에 넣습니다.

## 들어가기 전에 알아야 할 것

- **돈이 듭니다.** OpenAI 종량제 결제 수단이 필요합니다. 기획서 추정으로는 매일 쓰는 이용자 1인당 월 약 0.40달러입니다 [가정 기반 추정]
- `MONTHLY_BUDGET_USD`로 상한을 겁니다. 소진되면 물건·주변 모드가 멈추고 **글자·문서 읽기는 계속 동작**합니다
- 이 상한은 프록시가 자체 계수로 집행합니다. OpenAI 쪽 예산 설정이 실제로 차단하는지는 확인하지 않았습니다 [모름]

## 1단계 — OpenAI 키 발급

1. platform.openai.com 에서 결제 수단을 등록합니다
2. API 키를 새로 만듭니다. **이 키를 어디에도 붙여넣지 마십시오.** 다음 단계에서 터미널에 직접 입력합니다
3. 가능하면 OpenAI 대시보드에서도 월 사용 한도를 따로 걸어 두십시오 (이중 안전장치)

## 2단계 — Cloudflare 로그인

```bash
cd app/worker
npx wrangler login
```

브라우저가 열리고 Cloudflare 계정 인증을 요청합니다. 계정이 없으면 무료로 만들 수 있습니다.

## 3단계 — 키를 secret으로 넣기

```bash
npx wrangler secret put OPENAI_API_KEY
```

입력하라는 메시지가 뜨면 키를 붙여넣고 엔터를 칩니다. **이 값은 wrangler.toml에도, git에도 들어가지 않습니다.**

## 4단계 — 배포

```bash
npx wrangler deploy
```

끝나면 `https://vision-assist-proxy.<계정이름>.workers.dev` 형태의 주소가 출력됩니다. 이 주소를 복사해 두십시오.

## 5단계 — 배포 확인 (키 없이도 가능한 점검)

```bash
curl https://vision-assist-proxy.<계정이름>.workers.dev/health
```

`{"ok":true,"backend":"openai"}` 가 나와야 합니다. `"mock"` 이면 `USE_OPENAI`가 `1`이 아니거나 secret이 안 들어간 것입니다.

## 6단계 — 프런트에 프록시 주소 연결

`app/js/config.js` 의 `PROXY_URL` 에 4단계 주소를 넣고 커밋·푸시하면 GitHub Pages가 다시 배포합니다.

```js
PROXY_URL: 'https://vision-assist-proxy.<계정이름>.workers.dev',
```

연결되면 물건 설명·주변 살펴보기가 **실제 AI로** 동작합니다. 그때부터 비용이 발생합니다.

## 되돌리는 방법

- 일시 중단: `npx wrangler secret delete OPENAI_API_KEY` → 프록시가 목으로 돌아갑니다
- 완전 중단: `PROXY_URL`을 빈 문자열로 되돌리고 푸시 → 프런트가 구름 모드를 실행하지 않습니다
- 삭제: `npx wrangler delete`

## 확인된 것과 확인되지 않은 것

**확인됨** (로컬 실호출로 측정):
- 세션 한도 소진 → `LIMIT_SESSION`
- 기기 한도 소진 → `LIMIT_DEVICE`, 새 기기는 독립 계수
- 월 예산 소진 → `BUDGET_EXHAUSTED` (예산을 극소값으로 두고 확인)
- 요청 검증: 모드 목록, ID 형식 8~64자, 이미지 data URI 형식, 400KB 상한

**확인 안 됨**:
- 실제 OpenAI 응답의 형식 준수 여부와 한국어 품질. 키를 붙인 뒤 첫 호출에서 확인해야 합니다
- Durable Objects 무료 등급에서의 동작과 한도
- 실제 과금액이 `PRICE_*` 계산과 일치하는지
