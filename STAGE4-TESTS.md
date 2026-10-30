# 4단계 구현 및 브라우저 검증 기록

검증일: 2026-10-30 (KST). Edge의 별도 테스트 프로필과 로컬 HTTP 출처에서 확인했습니다. 운영 브라우저의 저장 데이터에는 접근하지 않았습니다. 목록·가격은 조회 시점에 따라 달라집니다.

## 실제 API 결과

| 항목 | 결과 |
|---|---:|
| 업비트 전체 거래마켓 | 875 |
| 업비트 거래소 내부 코인 묶음 | 360 |
| 빗썸 전체 거래마켓 | 502 |
| 빗썸 거래소 내부 코인 묶음 | 489 |
| 통합 거래마켓 | 1,377 |
| 보수적 통합 코인 묶음 | 848 |
| 공식 자료로 확인해 연결한 공통 자산 | BTC 1개 |
| 동일심볼 공통 후보 | 339 |
| 상대 거래소에 동일심볼 없는 업비트 후보 | 21 |
| 상대 거래소에 동일심볼 없는 빗썸 후보 | 150 |

위 숫자는 코드에 고정하지 않습니다. API 응답을 매번 동적으로 집계합니다. 코인 묶음 수는 완전히 중복 제거된 글로벌 자산 수가 아닙니다. 거래소 내부에서는 심볼·한글명·영문명이 모두 일치하는 경우만 묶고, 거래소 간에는 BTC만 공식 자산 설명으로 검증하여 합쳤습니다. 나머지는 동일심볼이어도 분리합니다. 전용·공통 자산 전체 수는 공통 ID 부재로 확정하지 않으며 화면에도 미확정으로 표시합니다. 신규 공통 자산 매핑은 공식 네트워크·컨트랙트 등 식별 근거를 검증한 후 asset-identity.js에 추가할 수 있습니다.

- 업비트 실제 마켓: KRW / BTC / USDT
- 빗썸 실제 마켓: KRW / BTC (BTC 마켓 13개 확인)
- GRASS: 빗썸 KRW-GRASS 검색 및 상세 조회 성공. 조회 당시 현재가 773 KRW. 업비트 목록에는 GRASS 거래마켓이 없었습니다.
- BTC 비교: 업비트 KRW-BTC / USDT-BTC, 빗썸 KRW-BTC를 표시했습니다. KRW 비교는 거래소별 조회 시각을 표시하며 환산·가격 차이 산출은 하지 않습니다.

## 브라우저 테스트

1. 양쪽 전체 목록 HTTP 200, 브라우저 JSON 읽기 성공. 각각 875 / 502개 버튼과 통합 1,377개 확인.
2. 거래소 필터·실제 결제통화 필터·통합 검색 작동. 검색 입력 시 추가 API 요청 없음.
3. GRASS 검색, 빗썸 시세·호가·체결 20건·일봉 30개·60분봉 24개 성공.
4. BTC 두 거래소 KRW 가격 비교 및 조회 시각 표시 성공.
5. 업비트 USDT-BTC의 시세·호가·체결 20건·60분봉 24개, KRW-BTC 일봉 30개 성공.
6. 빗썸 BTC-ETH 현재가 0.02859525 BTC 및 BTC 단위 차트 확인. KRW로 표시하지 않음.
7. 동명이인 모의 데이터: 서로 다른 거래소의 XYZ 자산이 병합되지 않음. 같은 거래소의 동일 자산 두 마켓은 모두 보존.
8. 격리 브라우저 프로필에서 만든 CRUD 기록이 CRUD 페이지에서 표시되고 API 페이지 이동 후에도 저장 문자열이 동일함. 사용자의 실제 프로필 데이터는 직접 검사하지 않음.
9. 모의 네트워크/CORS 실패 및 429 오류의 UI·재시도 버튼 확인. 모의 418에서 대기 상태와 추가 fetch 차단 확인. 실제 과도한 요청을 발생시키지 않음.
10. 요청 큐 모의 테스트: 같은 URL 진행 중 요청 공유·캐시 재사용·취소된 대기 요청 전송 방지 확인.
11. 실제 업비트 연속 요청 최소 관측 간격 11.021초, 빗썸 1.125초. 탭 간 Web Locks와 별도 API 시각 키를 사용. 미지원 브라우저는 한 탭 사용 안내.
12. 390px / 1440px에서 페이지 가로 넘침 없음. 정상 경로 JavaScript 오류 없음.

## API 경로

기본 주소는 https://api.upbit.com 과 https://api.bithumb.com 입니다. 모두 인증 없는 GET만 사용합니다.

- 업비트 목록: /v1/market/all?is_details=true
- 빗썸 목록: /v1/market/all?isDetails=true
- 양쪽 현재가: /v1/ticker?markets={market}
- 양쪽 호가: /v1/orderbook?markets={market}
- 양쪽 체결: /v1/trades/ticks?market={market}&count=20
- 양쪽 일봉: /v1/candles/days?market={market}&count=30
- 양쪽 60분봉: /v1/candles/minutes/60?market={market}&count=24
- 빗썸 경보제: /v1/market/virtual_asset_warning

## 공식 근거와 제한

- [업비트 Origin 정책](https://docs.upbit.com/kr/reference/rate-limits): 10초당 1회. 구현은 완료 후에도 11초 이상 간격 유지.
- [빗썸 요청 제한](https://apidocs.bithumb.com/docs/api-%25EC%259A%2594%25EC%25B2%25AD-%25EC%2588%2598-%25EC%25A0%259C%25ED%2595%259C-%25EC%2595%2588%25EB%2582%25B4): Public API는 IP·분류 항목별 초당 150회. 구현은 모든 빗썸 요청을 별도 큐에서 최소 1.1초 간격으로 제한.
- [빗썸 목록](https://apidocs.bithumb.com/reference/거래-대상-목록-조회): isDetails 상세 플래그.
- [빗썸 경보제](https://apidocs.bithumb.com/v2.1.0/reference/경보제-조회): 실제 warning_type / warning_step / end_date 필드 표시.
- [업비트 BTC 식별](https://datalab.upbit.com/assets/BTC/summary), [빗썸 BTC 설명서](https://feed-content.bithumb.com/cms/7f9554a7-0fd9-48a7-becf-b8dceca6f724.pdf).

GitHub Pages의 실제 배포 출처 CORS는 배포하지 않았으므로 미검증입니다. 같은 IP의 다른 앱·기기는 이 앱의 큐로 제어할 수 없습니다. API가 제공하지 않는 정보는 미제공으로 표시하며 임의 가격·공급량·식별자를 만들지 않습니다.

## CRUD 보존 SHA-256 (작업 전후 동일)

- index.html: 51828939231FDAB913CEFA5AA7FD5DB0DC82EC61B8B7FFA30860A052B07DB884
- js/crud.js: 7D91036EB5D848C66B628C31086B6DE338F50FE7169788FD4A92DDBD8C800872

localStorage의 기존 관심 코인 키는 변경하지 않았습니다. API 스크립트는 그 키를 참조하지 않습니다. 기존 업비트 시각 키는 유지하고 빗썸 시각·요청 제한 대기값만 별도 키로 관리합니다.

글로벌 시가총액, 유통량, 보유자 수, 순입금, 회원 영향도 및 GitHub 배포는 이번 단계에서 구현하지 않았습니다.
