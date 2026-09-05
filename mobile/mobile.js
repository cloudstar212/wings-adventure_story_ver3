// 모바일 웹 버전 전용 보조 스크립트. game.js(공용 로직) 다음에 로드되며, game.js는
// 전혀 수정하지 않는다 - 데스크톱 버전과 로직을 100% 공유하기 위함(사용자 확정).
//
// 여기서 하는 일은 딱 하나: 물리 키보드가 없는 폰에서 차지 공격(startCharge/releaseCharge,
// 원래는 state.soloAttackKey 키보드 입력 전용)을 화면 터치 버튼으로 대신 연결하는 것.
// 1인 모드 강제는 mobile/style.css가 "2명" 버튼을 숨기는 것만으로 충분해서(사용자가 아예
// 선택할 수 없음) 여기서 별도 상태 조작은 하지 않는다.
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
