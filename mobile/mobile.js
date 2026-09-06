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
