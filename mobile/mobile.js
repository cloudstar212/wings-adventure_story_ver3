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

// (한때 방 화면을 object-fit:cover처럼 꽉 채우도록 fitStage를 바꿔봤으나, 배경
// 원본(1536x1024, 3:2)과 폰 화면 비율이 안 맞아 상하가 잘리는 부작용이 있었고, 폰마다
// 화면 비율이 다 달라 특정 기기에 맞춰 원본을 다시 그리는 것도 현실적이지 않다는 결론
// (사용자 확정) - 원래 방식(object-fit:contain, 좌우 여백은 남지만 잘리거나 늘어나지
// 않음)으로 되돌림. 즉 game.js의 fitStage를 그대로 사용 - 이 파일에서 손대지 않는다.

// 만화 컷신: 데스크톱은 8컷(2열x4행)을 절반씩(4컷/페이지, 2페이지)으로 보여주는데,
// 폰 가로모드처럼 옆으로 넓은 화면에서는 4컷(2x2, 정사각형에 가까움)이 레터박스를
// 크게 남긴다. 반대로 1행(2컷)만 보여줬을 때의 가로세로 비율을 실제 이미지 크기로
// 계산해보면 약 1.85~2.25:1로, 일반적인 폰 가로모드 화면 비율(약 1.8~2.2:1)과 거의
// 일치한다 - 그래서 1행씩 4페이지(사용자 확정 - "최소 2컷씩" 요건도 만족하는 동시에
// 화면을 가장 꽉 채우는 선택)로 재구성한다. game.js의 openStoryModal/renderStoryPage를
// 통째로 새 버전으로 재할당(부분 수정이 아니라 완전 대체) - storyPageIndex 값 자체는
// game.js의 "계속하기" 버튼 가드(if(storyPageIndex===0)return)만 만족시키도록
// 0(첫 페이지)/1(그 외)로만 맞춰준다.
const MOBILE_STORY_PAGES = 4;
let __mobileStoryPage = 0;
function __mobileRenderStoryPage() {
  document.getElementById("story-img").style.transform =
    `translateY(-${(__mobileStoryPage * 100) / MOBILE_STORY_PAGES}%)`;
  document.querySelectorAll("#story-page-dots span").forEach((dot, i) => {
    dot.classList.toggle("active", i === __mobileStoryPage);
  });
  const isLast = __mobileStoryPage === MOBILE_STORY_PAGES - 1;
  document.getElementById("btn-story-nextpage").classList.toggle("hidden", isLast);
  document.getElementById("btn-story-continue").classList.toggle("hidden", !isLast);
  storyPageIndex = isLast ? 1 : 0;
}
renderStoryPage = __mobileRenderStoryPage;
openStoryModal = function (ch) {
  __mobileStoryPage = 0;
  storyPageIndex = 0;
  document.getElementById("story-title").textContent = `${ch.n}장. ${ch.title}`;
  const img = document.getElementById("story-img");
  img.style.transform = "translateY(0%)";
  img.onload = () => {
    const wrap = document.querySelector(".story-img-wrap");
    const rowAspect = img.naturalWidth / (img.naturalHeight / MOBILE_STORY_PAGES);
    const maxW = window.innerWidth * 0.98, maxH = window.innerHeight * 0.9;
    let w = maxW, h = w / rowAspect;
    if (h > maxH) { h = maxH; w = h * rowAspect; }
    wrap.style.width = `${w}px`;
    wrap.style.height = `${h}px`;
  };
  img.src = ch.img;
  __mobileRenderStoryPage();
  document.getElementById("modal-story").classList.remove("hidden");
};
document.getElementById("btn-story-nextpage").addEventListener("click", () => {
  __mobileStoryPage = Math.min(MOBILE_STORY_PAGES - 1, __mobileStoryPage + 1);
  __mobileRenderStoryPage();
});

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
