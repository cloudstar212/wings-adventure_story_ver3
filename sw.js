// 루트에 둬서 스코프가 사이트 전체("/")가 되게 한다(mobile/sw.js였을 때는 스코프가
// mobile/로 한정돼 game.js/style.css/assets 같은 루트 공용 파일은 이 서비스워커가
// 아예 손댈 수 없었다). 오프라인 캐싱은 하지 않고 - 오히려 반대로, 모든 요청을
// cache:"no-store"로 다시 fetch해서 브라우저/설치된 앱(WebAPK)이 디스크 HTTP 캐시나
// GitHub Pages의 Cache-Control(max-age=600)에 걸려 옛날 파일을 계속 보여주는 문제를
// 막는다(사용자 확정 버그 - 수정한 내용이 앱/브라우저에 한참 뒤에도 안 보임). 개발 중인
// 게임이라 매번 최신 내용을 보는 게 오프라인 지원보다 훨씬 중요하다는 판단.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" }).catch(() => fetch(e.request))
  );
});
