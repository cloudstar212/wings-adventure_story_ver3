// 모바일 웹 버전 전용 보조 스크립트. game.js(공용 로직) 다음에 로드되며, game.js
// 파일 자체는 전혀 수정하지 않는다 - 데스크톱 버전과 로직을 100% 공유하기 위함
// (사용자 확정). game.js가 일반 <script>(모듈 아님)라 최상위 함수 선언은 이 파일과
// 전역 스코프를 공유하므로, "함수를 통째로 재할당"하는 방식으로만 동작을 바꾼다.

// 비행/전투 화면 카메라 줌 완화 - 캐릭터·몬스터·장애물이 전부 고정 픽셀 크기로 그려지고
// 그 위에 카메라 배율(cameraScale = 1/currentViewScale)만 곱해지는 구조라, 이 배율 자체가
// 화면 실제 크기와 무관한 상수라서 화면이 작은 폰에서는 상대적으로 훨씬 크게(사용자 확정
// 버그 - "화면에 꽉 찬다") 보였다. currentViewScale()이 커지면(더 넓은 "월드"를 노출) 그에
// 반비례해 cameraScale이 작아져 모든 오브젝트가 작게 그려지는데, 배경 채우기(vw()*cameraScale)
// 는 currentViewScale에 무관하게 항상 캔버스를 꽉 채우도록 서로 상쇄되게 설계되어 있어
// (game.js 주석 §카메라 줌 참고) 여백/미채움 없이 안전하게 축소할 수 있다.
const __originalCurrentViewScale = currentViewScale;
const MOBILE_ZOOM_OUT = 1.4; // 값을 올릴수록 더 넓게(작게) 보임 - 필요시 이 숫자만 조정
currentViewScale = function () {
  return __originalCurrentViewScale() * MOBILE_ZOOM_OUT;
};

// 위 카메라 줌과 별개로 "캐릭터만 조금 더" 작게 보이도록(사용자 확정) renderPlayer를
// 통째로 감싸서, 캐릭터 자신의 기준점(p.x,p.y)을 축으로 살짝 더 축소해서 그린다.
// 몬스터·장애물 크기는 그대로 두고 캐릭터 렌더링에만 적용되는 조정이라, PLAYER_BATTLE_
// HEIGHT 같은 game.js의 const를 손댈 필요 없이 렌더 함수 자체를 재할당해 구현했다.
const __originalRenderPlayer = renderPlayer;
const MOBILE_CHAR_EXTRA_SHRINK = 0.88;
renderPlayer = function (p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(MOBILE_CHAR_EXTRA_SHRINK, MOBILE_CHAR_EXTRA_SHRINK);
  ctx.translate(-p.x, -p.y);
  __originalRenderPlayer(p);
  ctx.restore();
};

// 방에 도착하면 항상 휴식 없이 바로 비행 가능하도록(사용자 확정 - "휴식 중" 자체를
// 없애 달라는 요청). renderRoom()이 매번 restRemaining을 읽어 UI/버튼 비활성화 여부를
// 정하므로, 그 직전에 0으로 되돌려 "휴식 중이 아닌 상태"만 보이게 만든다.
const __originalRenderRoom = renderRoom;
renderRoom = function () {
  restRemaining = 0;
  __originalRenderRoom();
};

// 터치 이동을 "그 자리로 순간 이동"(원래 game.js 방식 - 손가락 위치 = 목표 위치)에서
// "드래그한 만큼 상대적으로 이동"으로 변경(사용자 확정 - 손가락이 캐릭터를 가려 조작이
// 불편하다는 피드백). game.js의 canvas touchmove 리스너가 먼저 등록돼 있어 이 이벤트에서
// 여전히 절대좌표로 p.tx/ty를 먼저 설정하지만, 이 파일은 game.js보다 나중에 로드되어 같은
// 엘리먼트에 나중에 등록되므로 캡처링 단계가 아닌 한 항상 나중에 실행된다 - 그 값을 아래
// 로직으로 덮어써서 최종적으로는 상대 이동만 적용된다.
let __mobileDragTouch = null; // 드래그 시작 시점의 손가락 위치(CSS px)
let __mobileDragPlayer = null; // 드래그 시작 시점의 캐릭터 위치(월드 px)
canvas.addEventListener("touchstart", (e) => {
  if (state.playerCount !== 1) return;
  const p = rt.players[0];
  const t = e.touches[0];
  if (!p || !t) return;
  __mobileDragTouch = { x: t.clientX, y: t.clientY };
  __mobileDragPlayer = { x: p.x, y: p.y };
}, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  if (state.playerCount !== 1 || !__mobileDragTouch || !__mobileDragPlayer) return;
  const p = rt.players[0];
  const t = e.touches[0];
  if (!p || !t) return;
  const dx = (t.clientX - __mobileDragTouch.x) * currentViewScale();
  const dy = (t.clientY - __mobileDragTouch.y) * currentViewScale();
  p.tx = clamp(__mobileDragPlayer.x + dx, 24, vw() - 24);
  p.ty = clamp(__mobileDragPlayer.y + dy, 24, vh() - 24);
}, { passive: false });
function __mobileEndDrag() { __mobileDragTouch = null; __mobileDragPlayer = null; }
canvas.addEventListener("touchend", __mobileEndDrag);
canvas.addEventListener("touchcancel", __mobileEndDrag);

(function () {
  const btn = document.getElementById("btn-mobile-attack");
  if (!btn) return;

  function press(e) {
    e.preventDefault();
    startCharge(1);
  }
  function release(e) {
    if (e) e.preventDefault();
    releaseCharge(1);
  }
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("touchcancel", release, { passive: false });
  // 데스크톱 브라우저의 "기기 시뮬레이션" 모드로 확인할 때를 위해 마우스도 지원.
  btn.addEventListener("mousedown", press);
  window.addEventListener("mouseup", release);

  // 전투 중이 아닐 때는 옅게 표시해 "지금 눌러도 소용없다"는 걸 시각적으로 알려준다
  // (startCharge 자체는 전투 밖에서 호출돼도 안전하게 무시되므로 기능상 막을 필요는 없음).
  setInterval(() => {
    const active = typeof currentScene !== "undefined" && currentScene === "flight" &&
      typeof inBattle === "function" && inBattle();
    btn.classList.toggle("active", active);
  }, 200);
})();
