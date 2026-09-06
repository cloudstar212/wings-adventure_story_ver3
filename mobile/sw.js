// 오프라인 캐싱 등은 하지 않는다 - 안드로이드 크롬이 "앱 설치" 메뉴를 보여주는
// 조건(설치 가능 여부 판정) 중 하나가 "fetch 이벤트를 처리하는 서비스워커 등록"이라
// 그 조건만 충족시키기 위한 최소 뼈대. 요청은 전부 그대로 네트워크로 통과시킨다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
