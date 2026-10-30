# 5단계 상장현황 구현 및 검증

검증일: 2026-10-30 KST. Edge의 격리 테스트 프로필과 로컬 HTTP 출처에서 검사했습니다. 사용자의 실제 브라우저 프로필은 접근하지 않았으며 GitHub 배포도 하지 않았습니다.

## 변경 범위

- crypto.html: 상장현황 버튼 및 전용 스크립트 연결
- js/api.js: 기존 상세 탭에 상장현황 분기 추가. 목록 갱신·종목 선택과 연결
- css/style.css: 요약 카드·상장 표·내부 스크롤·반응형 구성
- js/foreign-client.js: 해외 API별 큐와 메모리 캐시
- js/listing-identity.js: 검증된 BTC·빗썸 GRASS ID와 식별 검증
- js/listings.js: 국내외 표, 요약 통계, 실패·재시도·페이지 이동

index.html, js/crud.js, js/exchange-client.js, js/asset-identity.js 및 기존 관심 코인 저장 구조는 변경하지 않았습니다. 해외 모듈은 localStorage를 읽거나 쓰지 않습니다. 기존 국내 API 요청 시각 키와 제한도 그대로 유지합니다.

## 실제 해외 API 브라우저 확인

| 제공처 | 테스트 엔드포인트 | 결과 |
|---|---|---|
| CoinGecko | /api/v3/coins/bitcoin/tickers?page=1 | 무키 HTTP 200, JSON 읽기 성공, 100건 |
| CoinGecko | /api/v3/coins/grass/tickers?page=1 | 무키 HTTP 200, JSON 읽기 성공, 67건 |
| CoinGecko | /api/v3/coins/{id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false | BTC·GRASS 메타데이터 읽기 성공 |
| CoinPaprika | /v1/coins/btc-bitcoin/markets | 무키 HTTP 200, JSON 읽기 성공, 원본 2,113건 |
| CoinPaprika | /v1/coins/grass-grass/markets | 무키 HTTP 200, JSON 읽기 성공, 원본 38건 |
| CoinPaprika | /v1/coins/{coin_id} | 메타데이터와 계약 주소 읽기 성공 |
| CoinPaprika | /v1/search?q=grass&c=currencies | 조사용 호출 성공. 같은 GRASS 심볼의 다른 자산이 여러 개 존재함을 확인. 앱에서는 이 검색으로 자동 매핑하지 않음 |

로컬 출처에서 브라우저가 교차 출처 JSON을 읽었으므로 해당 출처의 CORS는 통과했습니다. GitHub Pages 출처에서의 동작은 아직 미검증입니다. 인증 헤더·키·비공식 프록시·보안 해제 옵션은 사용하지 않았습니다.

## 실제 상장현황 결과

조회 시점에 따른 관측값이며 코드에 수치를 고정하지 않았습니다.

| 자산 | 국내 상장 | 국내 마켓 | 해외 현물 거래소 | 해외 현물 거래쌍 |
|---|---|---|---:|---:|
| BTC | 업비트·빗썸 | 업비트 KRW-BTC / USDT-BTC, 빗썸 KRW-BTC | 25 | 123 |
| GRASS | 빗썸 전용, 업비트 목록상 미상장 | 빗썸 KRW-GRASS | 22 | 27 |

해외 수치는 CoinPaprika에서 선택 자산이 기준 자산(base_currency_id)인 시장 중 category=Spot이고 현재 확인한 해외·글로벌 거래소 범위에 있는 결과입니다. 전 세계 전체 상장 수가 아닙니다. GRASS 원본의 파생상품 2건은 제외했습니다. 같은 자산이 결제통화 위치에만 있는 거래쌍도 본 집계에서 제외합니다.

- 국내 표는 기존 전체 마켓 배열을 재사용하며 목록을 다시 요청하지 않습니다.
- 국내 개별 현재가·24시간 거래대금은 기존 ExchangeClient의 큐·캐시·중복 방지를 재사용합니다.
- 해외 거래쌍 원래 가격은 거래소·거래쌍·선택 자산 ID가 함께 일치하는 CoinGecko last 값만 사용합니다.
- CoinPaprika quotes.USD.price / volume_24h는 USD 환산값으로 별도 표시합니다. USD와 USDT를 같다고 가정하지 않습니다.
- 원래 가격이 없으면 미제공으로 표시하며 환산값으로 임의 복원하지 않습니다.
- 데이터별 출처·데이터 시각과 제공처별 실제 조회 시각을 표시합니다.
- 거래 링크는 API가 제공한 URL의 HTTPS·허용 도메인·계정 정보 부재·파생 경로 제외를 검사합니다. 거래 페이지의 최종 HTTP 응답까지 검사한 것은 아닙니다. 허용 범위 밖의 URL은 링크로 표시하지 않습니다.

## 자산 ID 검증

- BTC: bitcoin-native / CoinGecko bitcoin / CoinPaprika btc-bitcoin. 양 거래소 공식 자산 설명과 외부 메타데이터의 Bitcoin 네이티브 자산 및 bitcoin.org를 대조했습니다.
- GRASS: grass-solana / CoinGecko grass / CoinPaprika grass-grass. 빗썸 공식 설명서의 프로젝트명·공식 홈페이지(getgrass.io), 제공처 양쪽 메타데이터의 Solana 네트워크·동일 계약 주소를 대조했습니다.
- 계약 주소: Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs
- 매핑은 지정 거래소·심볼·한글명·영문명 조건을 모두 통과해야 적용합니다. 빗썸 GRASS 매핑을 다른 거래소에 자동 적용하지 않습니다.
- 같은 심볼이라는 이유만으로 국내외 자산을 병합하지 않습니다. 확인됨 / 동일 자산 후보 / 식별 불확실을 구분합니다.
- 미검증 자산은 해외 조회 불가, 통계는 미확인으로 표시합니다. 조회 실패와 미상장을 구분합니다.

## 요청 제한과 캐시

- 업비트: 기존 최소 11초 간격과 Web Locks·시각 저장 키 유지
- 빗썸: 기존 최소 1.1초 간격 유지
- CoinPaprika: 별도 최소 1.1초 간격. 공식 IP당 초당 10회 및 무료 월 20,000회 정책을 고려한 온디맨드 조회
- CoinGecko: 별도 최소 11초 간격. 키 없는 요청의 제한은 IP 기준이며 고정 한도는 문서에서 보장하지 않음
- 해외 제공처별 Web Locks, 진행 중 URL 공유, 데이터 5분 메모리 캐시
- 검증된 메타데이터·ID 매핑은 30분 메모리 캐시. 페이지를 새로 열면 재검증
- 해외 표는 50행씩 메모리 내 페이지 이동. CoinGecko 가격 보완은 1페이지(최대 100건)만 요청. 전체 코인의 해외 데이터를 일괄 요청하지 않음
- 402·418·429는 대기 처리하며 자동 재시도하지 않음. 새로고침으로 메모리 캐시와 대기는 초기화되므로 반복 새로고침을 피해야 함
- IP 전체의 다른 기기·프로그램 요청량 및 월간 사용량 전체는 이 앱이 제어하거나 조회할 수 없음

## 검증 항목

- GRASS/BTC 국내외 상장, 국내 가격·24시간 거래대금, 해외 원래 가격·환산값·출처·조회 시각: 실제 API 확인
- GRASS 상장현황 재열기: 해외 추가 요청 없이 캐시 재사용 확인
- 잘못된 계약 주소·심볼만 같은 자산: 매핑 거부
- 미조회 거래소는 조회하지 못함, 미검증 해외 자산은 조회 불가 및 미확인 통계
- 모의 429에서 미확인 통계·재시도·추가 fetch 차단 확인
- 모의 응답에서 현물만 포함, 파생·역방향 거래쌍 제외, 위험 URL 차단, null 필드 안전 처리, 누락·실패 시 0 오표시 방지, 오래된 응답 무시: 모두 통과
- 빗썸 GRASS 기존 호가 4항목·체결 20건·일봉 30개·60분봉 24개: 실제 API 회귀 확인
- 업비트 USDT-BTC 시세·호가 4항목·체결 20건·60분봉 24개: 실제 API 회귀 확인
- 실제 상장현황 표에서 390px / 1440px 가로 넘침 없음. 최초 실행 시 해외 API 요청 0건, 탭을 연 뒤에만 요청하는 것을 확인

## 보존 SHA-256

작업 전후 동일:

- index.html: 51828939231FDAB913CEFA5AA7FD5DB0DC82EC61B8B7FFA30860A052B07DB884
- js/crud.js: 7D91036EB5D848C66B628C31086B6DE338F50FE7169788FD4A92DDBD8C800872

격리 프로필에서 생성한 CRUD 시험 기록의 표시 및 API 페이지 이동·상장현황 조회 후 저장 문자열 동일성도 확인했습니다. 사용자의 실제 브라우저 데이터 자체를 검사하거나 수정하지 않습니다.

## 제한과 공식 문서

- 전 자산의 확정 ID 매핑, 모든 해외 거래소·거래쌍 및 모든 원래 가격은 제공하지 못합니다. 식별 근거와 무료 API 추적 범위가 제한적이므로 미확인·미제공·조회된 범위 내로 표시합니다.
- CoinPaprika 무료 플랜은 개인 용도이며 월간·자산 수·재배포 제한이 있습니다. 향후 공개 배포 시 해당 이용 조건을 다시 확인해야 합니다.
- 파생상품은 현물 통계에 합산하지 않으며 이번 단계에서는 별도 파생 표도 만들지 않았습니다.

공식 근거:

- https://docs.coinpaprika.com/api-reference/coins/get-markets-by-coin-id
- https://docs.coinpaprika.com/api-reference/coins/get-coin-by-id
- https://docs.coinpaprika.com/api-plans
- https://docs.coinpaprika.com/faq
- https://docs.coingecko.com/reference/coins-id-tickers
- https://docs.coingecko.com/docs/errors-and-rate-limits
- https://datalab.upbit.com/assets/BTC/summary
- https://feed-content.bithumb.com/cms/7f9554a7-0fd9-48a7-becf-b8dceca6f724.pdf
- https://feed-content.bithumb.com/cms/copied-15bb147b-9d83-42ba-b723-4c9a5aba42d1.pdf

