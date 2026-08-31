# 전설의 날개 대모험 — 현재 버전 스펙

> `flying_game_spec.md`(최초 기획 프롬프트, git 비추적)와 달리, 이 문서는 **현재 `game.js`/`index.html`/`style.css`에 실제로 구현되어 있는 동작**을 그대로 기술합니다. 제안값(`[제안값]`)이 아니라 코드에 박힌 실수치입니다.

---

## 1. 개요

- **제목**: 전설의 날개 대모험
- **장르**: 마우스 조작 2D 비행 슈팅/러너
- **구현 방식**: 순수 HTML/CSS/JS + Canvas, 빌드 도구 없음. `index.html`을 브라우저로 열면 바로 실행
- **저장**: `localStorage` 키 `wingsAdventureSave_v1`에 진행 상황 자동 저장
- **씬**: 방(Room) ↔ 상점(Shop) ↔ 비행+전투(Flight/Battle), 3씬 순환

## 2. 조작

| 입력 | 동작 |
|---|---|
| 마우스 이동 | 비행 중 캐릭터가 목표 좌표를 향해 `pos += (target-pos) * min(1, 9*dt)`로 보간 추적 |
| Space Bar (누르고 있기→떼기) | 전투 중 차지 공격/검기 발사 (`startCharge`/`releaseCharge`, §6) |
| 숫자 1 | 🍑 복이 온다 복숭아 사용 |
| 숫자 2 | 💎 반짝반짝 보석 사용 |
| 숫자 3 | 🐒 원숭이는 바나나를 좋아해 사용 (비행 중에만) |
| 숫자 4 | 💺 마사지 의자 사용 (비행 중에만) |

- 아이템 1·2는 방/상점/비행 어디서든 사용 가능. 아이템 3·4는 **비행 중에만** 동작(다른 씬에서 시도하면 토스트로 안내 후 무시).
- 소지 수량 0이면 클릭/키 입력 모두 무시.

## 3. 씬 흐름

### 3-1. 최초 진입 (`hasStartedBefore === false`)
1. 강제 음료 모달 표시 ("음료수를 드시겠습니까?")
2. **예** → 냉장고 재고 있으면 -1, 보석 +1 (재고 0이어도 최초 1회는 안전장치로 보석 +1 지급) → 날개 선택 모달(닫기 버튼 없음, 반드시 1개 선택)
3. **아니오** → 바로 날개 선택 모달
4. 날개 선택 완료 → `hasStartedBefore = true` 저장, 방 화면 표시

### 3-2. 이후 재접속
저장된 상태를 그대로 불러와 방 화면부터 시작. 첫 진입 흐름은 다시 뜨지 않음.

### 3-3. 방(Room) ↔ 상점(Shop)
방의 문(`obj-door`) 또는 "🚪 상점으로 나가기" 버튼 → 상점. 상점의 "← 방으로" 버튼 → 방.

### 3-4. 비행 턴
방의 "🛫 비행 출발!" 버튼(휴식 중엔 비활성화) → 비행 씬. 60초(**주1**) 타이머가 0에 도달하면 더 이상 곧바로 방으로 돌아가지 않고, **턴 종료 전투**(`startTurnEndBattle()`)로 진입한다 — 화면 상단에 "⏰ 비행 시간 종료! 마지막 몬스터를 처치해야 방으로 돌아갈 수 있습니다!" 안내와 함께 §6 전투 씬이 시작된다.

- 이 전투는 시간 제한이 없다(`rt.turnTimer`는 전투 중엔 감소하지 않으므로 0에서 그대로 멈춰 있음). 몬스터를 **처치해야만** 기존의 턴 종료 로직(방으로 복귀 + 5분 휴식 타이머 시작 + 우편함에 편지 1통 생성, `endFlightTurn()`)이 실행된다
- 전투 중 몬스터의 공격에 맞아 "죽는" 경우는 §6-5의 기존 규칙 그대로: 목숨 -1, 보석 -1 후 무적시간과 함께 즉시 부활하여 재도전(재도전 횟수 제한 없음, 목숨이 0이 되면 그 시점에 게임오버) — 이 경우엔 턴이 끝나지 않고 전투가 계속된다
- **비행 중 몬스터가 랜덤으로 스폰되어 부딪히면 전투가 시작되던 기존 로직은 완전히 제거되었다.** 이제 전투에 진입하는 유일한 경로는 턴 타이머 만료뿐이다(§5-2 참조)
- 몬스터 체력은 기존 랜덤 스폰 때 쓰던 공식(`30 + difficultyLevel() * 4`)을 그대로 사용해, 같은 턴 수 기준으로 난이도가 이어진다
- **부작용**: 구름 날개의 "구름 은신 시 몬스터 회피" 효과는 원래 비행 중 스크롤되어 다가오는 몬스터 엔티티와의 충돌을 피하는 용도였다. 몬스터가 더 이상 그런 식으로 등장하지 않으므로(전투는 항상 턴 종료 시점에 강제로 시작됨) 이 회피 효과는 더 이상 실질적으로 발동할 대상이 없다. 코드는 그대로 남아 있고 부작용도 없지만(구름 자체는 여전히 스폰되고 `hiddenTimer`도 여전히 설정됨), 사실상 사문화된 상태다 — 날개 설명·기획을 바꿀지는 별도 결정 필요

> **주1 — 현재 코드상 임시값**: `startFlight()`의 `rt.turnTimer`가 `30`으로 하드코딩되어 있고 `// TODO: 테스트용 임시 단축값(원래 60초). 완성 후 60으로 되돌릴 것.` 주석이 달려 있습니다. 즉 **현재 실제 동작은 1턴 = 30초**이며, 다른 곳(HUD 초기값 등)의 60은 사용되지 않습니다.

## 4. 재화 & 초기 상태

```js
{
  money: 2, coins: 2, gems: 2,
  lives: 3,              // START_LIVES, 최대 10 (MAX_LIVES)
  trophies: 0,            // 다음 날개까지 진행도 (0~9, 소진형)
  totalTrophies: 0,       // 누적 트로피 (HUD 표시용, 소진 안 됨)
  fridgeDrinks: 3,        // 최대 5, 비행 1턴 완료마다 +1
  ownedWings: ["basic"],
  equippedWing: "basic",
  inventory: { peach: 0, gem: 0, monkey: 0, chair: 0 },
  turnsCompleted: 0,
  mailbox: { hasLetter: false, letterId: null },  // 최대 1통 대기
  mailFlags: { nextTurnGemBonus: false, gemboxDangerQueued: false },
}
```

- 목숨은 0.5 단위 증감, 0~10(`MAX_LIVES`) 범위로 클램프.
- 게임오버(`triggerGameOver`) 시 목숨만 `START_LIVES`(3)로 회복하고 나머지(돈/코인/보석/날개/트로피)는 유지 — 완전 초기화 아님.
- 방 화면 "🔄 새로 시작하기" 버튼만 저장 데이터 전체 초기화(`localStorage` 삭제 + `defaultState()`), 확인 대화상자 필요.

## 5. 비행 스테이지

### 5-1. 난이도 레벨
`difficultyLevel() = min(turnsCompleted, 15)` — 0~15단계, 완료한 턴 수에 비례해 상승, 15에서 상한.

### 5-2. 스폰 주기 (난이도 `diff` 반영, 매 스폰마다 ×`rand(0.8, 1.2)` 지터)

| 엔티티 | 주기 공식 | 하한 |
|---|---|---|
| 코인 | `0.9 - diff*0.03` 초 | 0.45초 |
| 돈 | `2.4 - diff*0.06` 초 | 1.4초 |
| 장애물 | `1.7 - diff*0.06` 초 | 0.7초 |

> **몬스터는 더 이상 이 표에 없다.** 예전에는 `22 - diff*0.6`초(하한 12초) 주기로 비행 중 랜덤 스폰되어 부딪히면 전투가 시작됐지만, 이 로직은 완전히 제거되었다. `rt.spawnT`에도 더 이상 `monster` 필드가 없다. 몬스터 전투는 이제 오직 턴 타이머가 0에 도달했을 때(§3-4)만 시작된다 — 체력 공식(`30 + diff*4`)과 전투 자체(§6)는 그대로다.

- 스크롤 속도: `200 + diff*14` px/s
- 코인 반지름(기준) 16, 돈 반지름(기준) 18
- 충돌 판정: 플레이어-엔티티 거리 `< e.r + 18`

#### 5-2-1. 코인/돈/장애물 원근감(Perspective) 연출

코인·돈·장애물 3종(몬스터·구름 제외)은 화면 오른쪽에서 스폰될 때 실제 크기보다 작게 나타나 서서히 다가오며 커지는 원근 효과를 가진다. 스크롤 속도 계산식(`200 + diff*14`) 자체는 그대로 두고, 여기에 개별 엔티티의 `scale` 값을 곱해 이동 속도를 함께 조절하는 방식으로 구현.

- 상수: `PERSPECTIVE_SCALE_START = 0.3`(스폰 시 시작 배율), `PERSPECTIVE_RAMP_SEC = 1.3`(0.3 → 1.0까지 걸리는 시간, 초)
- 스폰 시(`spawnEntity`): 코인/돈/장애물은 목표 반지름을 `baseR`에 저장하고 `scale = 0.3`, `r = baseR * 0.3`으로 시작 (몬스터는 `baseR`이 없어 이 로직 대상에서 자동 제외)
- 매 프레임(`updateEntities`): 스폰 후 경과 시간 `elapsed = (now - born) / 1000`로 진행도 `t = clamp(elapsed / 1.3, 0, 1)`을 구하고, ease-in 곡선 `eased = t^2`을 적용해 `scale = 0.3 + 0.7 * eased`, `r = baseR * scale`을 매 프레임 갱신
- 이동 속도: `e.x -= scrollSpeed * scale * dt` — 스폰 직후엔 기준 스크롤 속도의 30%로 느리게 움직이다가, scale이 1.0에 도달하면(약 1.3초 후) 원래 스크롤 속도로 자연스럽게 가속
- 충돌 판정 반지름도 매 프레임 갱신된 `e.r`(= `baseR * scale`)을 그대로 사용하므로, 멀리 있을 때는 판정 범위도 함께 작음 (히트박스 공식 `e.r + 18` 자체는 변경 없음)
- 렌더링(`drawCoin`/`drawMoney`/`drawObstacle`)은 이미 `e.r`을 그대로 전달받아 그리므로, 별도 처리 없이 `e.r` 갱신만으로 시각적 크기도 함께 작아졌다 커짐

#### 5-2-2. 코인 지그재그(Zigzag) 이동

- 상수: `COIN_ZIGZAG_CHANCE = 0.2` — 코인이 스폰될 때(`createCoinEntity`) 20% 확률로 당첨
- 당첨된 코인은 `zigzagAmp`(진폭, `rand(40,80)`px) · `zigzagFreq`(각속도, `rand(2.5,4.5)`) · `zigzagPhase`(위상, `rand(0, 2π)`)를 랜덤 부여받는다
- 이동 방식: 일반 코인처럼 스크롤로 감소하는 기준 x좌표를 `baseX`에 별도로 유지하고, 실제 렌더링/충돌에 쓰이는 `e.x`는 매 프레임 `e.x = baseX + sin(elapsed * zigzagFreq + zigzagPhase) * zigzagAmp`로 계산 — 즉 좌우로만(x축) 흔들리고 스크롤 자체는 `baseX` 쪽에서 그대로 진행되는 순수 sine파 오프셋
- 충돌 판정은 별도 로직 없이 갱신된 `e.x`를 기존 `dist < e.r + 18` 공식에 그대로 사용하므로, 흔들리는 코인은 흔들리는 실제 위치에서 먹을 수 있음
- 코인 편대(§5-2-4)에 포함된 코인은 대형이 흐트러지지 않도록 지그재그 대상에서 제외(`noZigzag`)

#### 5-2-3. 장애물 플러리시(회전/펄스) 연출

- 상수: `OBSTACLE_FLOURISH_CHANCE = 0.3` — 장애물이 스폰될 때(`spawnEntity`) 30% 확률로 당첨, 당첨되면 회전(`spin`)·펄스(`pulse`) 중 50:50으로 하나를 부여
- **회전(spin)**: `spinSpeed`(`rand(1.2,3.0)`, 부호 랜덤 → 시계/반시계 랜덤)를 부여받아 매 프레임 `rotation += spinSpeed * dt`만큼 누적. 렌더링 시 `drawObstacle` 호출 전에 `ctx.rotate(rotation)`만 적용
- **펄스(pulse)**: `pulseFreq`(`rand(1.5,2.5)`) · `pulsePhase`(`rand(0,2π)`) · `pulseAmp`(`rand(0.12,0.22)`)를 부여받아 매 프레임 `pulseMul = 1 + sin(elapsed*freq*2π + phase) * amp`를 계산. 렌더링 시 `drawObstacle`에 `e.r`이 아닌 `e.r * pulseMul`(순간적으로 ±12~22% 커졌다 작아지는 그리기 전용 반지름)을 전달
- **충돌 판정 비영향 보장**: 회전은 캔버스 변환(`ctx.rotate`)만 사용하므로 `e.x/e.y/e.r`에 전혀 관여하지 않고, 펄스는 그리기 시점에만 임시로 `e.r * pulseMul`을 계산해 넘길 뿐 `e.r` 자체는 변경하지 않는다. 따라서 `OBSTACLE_TIER_RADIUS`와 충돌 판정 공식(`dist < e.r + 18`)은 이 기능 도입 전과 완전히 동일하게 동작

#### 5-2-4. 코인 편대(Formation) 스폰

- 상수: `FORMATION_CHANCE = 0.05`, `FORMATION_SHAPES = ["heart", "star"]`
- 코인 스폰 타이머가 돌 때마다(§5-2 코인 주기와 동일한 타이밍에) 일반 코인 1개 대신 5% 확률로 `spawnCoinFormation()`이 실행되어, 코인 5~8개(`Math.floor(rand(5,9))`)가 화면 오른쪽 바깥의 한 지점(`cx = cw()+60`, `cy = rand(140, ch()-140)`)을 중심으로 하트 또는 별 모양 좌표에 동시 배치된다
- 하트: 표준 파라메트릭 하트 곡선(`x=16sin³t`, `y=13cos t − 5cos2t − 2cos3t − cos4t`, 화면 좌표계에 맞게 y 부호 반전) 위를 점 개수만큼 균등 샘플링, ×4.5 스케일
- 별: 바깥 반지름 70px·안쪽 반지름 30px을 번갈아 사용하는 별 폴리곤 꼭짓점을 점 개수만큼 균등 배치
- 편대를 구성하는 각 코인은 일반 코인과 동일하게 `createCoinEntity`로 생성되어 원근감(§5-2-1) 성장과 스크롤을 그대로 적용받지만, 대형이 흐트러지지 않도록 지그재그(§5-2-2)는 적용하지 않음(`noZigzag: true`) — 결과적으로 형태를 유지한 채 화면 왼쪽으로 함께 스크롤되며 커진다

### 5-3. 장애물 테마 시스템
6개 테마 × 3크기(작음/중간/큼) × 10종 = 180개 이미지 (`assets/obstacles/{theme}/{tier}/{0..9}.png`).

- 테마: `space, ocean, dessert, household, fruit, transport` (코드 순서 고정)
- **1~18턴**: 테마를 3턴 단위로 순서대로 진행 (1턴 우주-작음 → 2턴 우주-중간 → 3턴 우주-큼 → 4턴 바다-작음 → … → 18턴 교통수단-큼)
- **19턴 이후**: 매 턴 테마·크기 무작위
- 크기별 히트박스 반지름: 작음 22px / 중간 32px / 큼 50px (`OBSTACLE_TIER_RADIUS`)
- 장애물 충돌 시: 무적(`invuln`) 중이 아니면 목숨 -0.5, 무적 1.0초 부여

### 5-4. 획득 처리
- 코인: 기본 +1, **황금 날개 장착 시 +2**. 10코인 단위 도달마다 랜덤 아이템 1개 자동 지급(`grantRandomItem`, 4종 균등 확률).
- 돈: 기본 +1. 단, 마사지 의자 효과(`moneyToGemTimer > 0`) 중에는 돈 대신 보석 +1.
- 몬스터와의 접촉으로 전투가 시작되는 경로는 없다 — 전투는 턴 타이머 만료 시 자동으로 시작된다(§3-4, §5-2).

#### 5-4-1. 코인 콤보 & 자석(Magnet) 시스템

비행 런타임 상태(`rt`)에 콤보 관련 필드 2개가 있다: `combo`(연속 획득 수), `magnetActive`(자석 발동 여부). 둘 다 `startFlight()`에서 매 턴 0/false로 초기화된다.

- 상수: `COMBO_MAGNET_THRESHOLD = 10`, `MAGNET_RADIUS_BY_TIER`(마일스톤 단계별 반경, px), `MAGNET_PULL_SPEED = 650`(px/s)
- **콤보 증가**: 코인을 먹을 때마다(획득 처리 성공 시점, 황금 날개로 2배를 받든 아니든 관계없이) `combo += 1` — 황금 날개의 코인 2배 지급량(`gain`)과는 별개의 카운터라 서로 영향을 주지 않는다
- **콤보 리셋 = 목숨이 감소하는 순간에만**: `resetCombo()` 함수가 `combo`를 0으로 되돌리고 `magnetActive`도 함께 끈다(자석이 켜져 있었다면 토스트로 알림). 이 함수는 목숨을 깎는 모든 경로에서 공통으로 호출된다 — 장애물 피격(`loseLife`), 보석함 위기 실패(`loseLife`), 전투 중 몬스터 피격(`loseLife`를 거치지 않는 별도 경로라 해당 지점에도 동일하게 호출) — 그 외의 경우(코인을 놓쳐 화면 밖으로 나감, 무적으로 피해를 막음 등)는 콤보에 영향을 주지 않는다
- **자석 발동·유지**: `combo === COMBO_MAGNET_THRESHOLD`(정확히 10이 되는 그 프레임)에만 `magnetActive = true`를 설정하는 **1회성 등호 체크**를 사용해 10 이후 계속 늘어나는 값(11, 12, …)에서 매 프레임 재발동되는 것을 막는다. 더 이상 시간제가 아니라 **콤보가 리셋될 때까지(=목숨이 깎일 때까지) 무기한 유지**되며, 리셋 후 다시 10을 채우면 정상적으로 재발동된다
- **자석 반경(마일스톤 연동)**: 콤보가 §5-4-3과 같은 마일스톤 단계(5/10/20/30/50/100 → tier 1~6)를 지날 때마다 자석 유효 반경도 함께 커진다 — `MAGNET_RADIUS_BY_TIER = { 1:100, 2:150, 3:220, 4:290, 5:360, 6:440 }`(px). 자석 자체는 tier 2(콤보 10)부터 켜지므로 tier 1의 100px는 실질적으로 쓰이지 않고, 10→20→30→50→100으로 이어지는 한 스트릭 안에서 반경이 150→220→290→360→440으로 점점 넓어지는 형태로 체감된다
- **자석 동작**: `updateEntities(dt)`에서 코인의 원근감/지그재그 이동을 반영한 뒤, `magnetActive`가 true인 동안 타입이 `coin`인 엔티티에 한해 플레이어와의 거리가 현재 마일스톤 반경 이내면 `MAGNET_PULL_SPEED`(650px/s) 속도로 플레이어 방향으로 추가 이동시킨다(목표를 지나치지 않도록 남은 거리 이내로 클램프). 끌려온 코인은 기존 충돌 판정(`dist < e.r + 18`)에 그대로 걸려 자동으로 수집된다
- **다른 시스템과의 독립성**: 자석 로직은 `e.type === "coin"`인 엔티티에만 관여하므로 돈(money)에 적용되는 마사지 의자 효과(`moneyToGemTimer`)와 겹치는 코드 경로가 없고, 콤보 카운터도 황금 날개의 코인 2배 지급 로직과 별개 변수라 서로 간섭하지 않는다

#### 5-4-2. 코인/돈 획득 피드백(파티클 + 사운드)

코인·돈을 먹을 때마다 짧은 파티클 이펙트(`rt.particles`, `spawnPickupParticles`)와 합성 사운드(`playPickupSound`)가 함께 재생된다. 톤은 기존 전투 씬 텔레그래프(⚠️, `drawWarningMark`/`drawMonster`의 `shadowColor`+`shadowBlur` 위주 발광 연출)와 통일감을 주도록, 새 이미지·색을 만들지 않고 기존 팔레트(코인/돈 그라디언트, 자석 발동색 `#4fd0e0`, 경고색 `#ffcf3f`)만 재사용했다.

- **강도 단계**: `comboFxTier(combo)`가 현재 `rt.combo` 값을 0/1/2 단계로 매핑 — 0(0~4), 1(5~9), 2(10, 자석 발동 순간과 동일 시점). 코인은 자기 자신의(막 증가시킨) `combo`를, 돈은 콤보를 건드리지 않고 그 시점의 `rt.combo`를 그대로 읽어 단계만 참고한다(§5-4-1과 동일하게 서로 간섭 없음)
- **파티클**(`PICKUP_PARTICLE_TIERS`): 단계가 오를수록 개수(6→10→16), 속도, 크기, 글로우(`shadowBlur` 6→11→18)가 커짐. 기본색은 코인 골드/돈 그린 그라디언트에서 무작위 샘플링하고, 1단계부터는 확률적으로 강조색(코인=경고색 `#ffcf3f`, 돈=자석 청록 `#4fd0e0`)이 섞여 나온다. 2단계(콤보 10 도달 순간)에는 텔레그래프 경고 마크와 같은 언어로 확장되는 글로우 링을 하나 더 추가해 순간을 강조
- **사운드**(`playPickupSound`, Web Audio API 오실레이터 직접 합성 — 별도 오디오 파일 없음): 코인은 높은 triangle파(830~), 돈은 낮은 sine파(440~) 짧은 블립. 단계가 오를수록 음높이·음량이 살짝 커지고, 2단계에서는 5도 화음을 겹쳐 축포처럼 들리게 함
- 파티클은 `update(dt)`에서 전투 여부와 무관하게 항상 갱신(`updateParticles`)되어 전투 진입 시점에도 잔여 이펙트가 자연스럽게 페이드아웃되고, 렌더링은 `renderPlayer()` 이후 `renderParticles()`에서 처리되어 캐릭터 위에 표시됨

#### 5-4-3. 콤보 표시(화면 우측 상단)

캔버스가 아닌 HTML 요소(`#combo-display`, 화면 상단 중앙 — `top:60px; left:50%; transform: translateX(-50%) …`)로 구현되어 `rt.combo`를 "combo +N" 형태로 실시간 표시한다. `combo <= 0`이면 자동으로 숨겨진다(콤보 리셋 시 즉시 사라짐). 좌우 중앙 정렬은 `translateX(-50%)`로 처리하는데, 아래 팝 효과의 `scale()`과 같은 `transform` 선언 안에 함께 적어야(`translateX(-50%) scale(1.4)`) 커지는 동안 중앙 정렬이 깨지지 않는다.

- **마일스톤 색상 단계**(`COMBO_MILESTONES`, §5-4-1의 `MAGNET_RADIUS_BY_TIER`와 동일한 tier를 `comboMilestoneTier()`로 공유): 콤보가 5/10/20/30/50/100에 도달할 때마다 배지 색이 초록→파랑→보라→주황→빨강→무지개(gradient, 계속 흐르는 `comboRainbow` 애니메이션) 순으로 바뀐다(`combo-tier-1`~`combo-tier-6` CSS 클래스). 100단계는 배경이 그라디언트로 계속 움직여 다른 단계보다 확실히 더 눈에 띈다
- **팝 효과**: 콤보가 "방금" 정확히 마일스톤 값에 도달한 프레임에만(`combo`가 증가했고 그 값이 `COMBO_MILESTONES`에 있을 때) `combo-pop` 클래스를 붙여 `translateX(-50%) scale(1.4)`로 살짝 커졌다가, 160ms 뒤 클래스를 떼어 트랜지션(`transform 0.12s ease-out`)으로 원래 크기로 돌아오게 한다. 값이 안 바뀐 프레임은 비교(`comboDisplayShownCombo`)로 걸러 매 프레임 재계산/재트리거하지 않는다
- 갱신은 `updateAllHUD()` 안의 `updateComboDisplay()`에서 처리되어 다른 HUD 숫자들과 같은 타이밍에 반영되고, 콤보가 5/10/20/30/50/100을 정확히 지나가는지·중앙 정렬 여부·코인을 놓쳐도 안 사라지는지·목숨이 깎일 때만 사라지는지·자석 반경이 실제로 늘어나는지는 Playwright로 각각 직접 재현해 확인함

### 5-5. 미니 이벤트

매 비행 턴 시작(`startFlight`) 시 `scheduleMiniEvents()`가 코인 폭풍·장애물 러시·무지개다리 중 **1~2개**를 그 턴 안의 서로 겹치지 않는 랜덤 시점에 예약한다. 지속시간은 초 단위로 하드코딩하지 않고 **턴 길이(`rt.turnDuration`)의 15~25%**로 계산하므로, 현재의 테스트용 30초 턴이든 나중에 복원될 60초 턴이든 항상 같은 비율로 자연스럽게 동작한다(`MINI_EVENT_DURATION_RATIO = [0.15, 0.25]`).

- **스케줄링**(`scheduleMiniEvents`): 턴 시작/끝에 `MINI_EVENT_MARGIN_RATIO = 0.08`만큼 여백을 둔 뒤, 남은 구간을 이벤트 개수(1~2, 균등 확률)만큼 균등 분할하고 각 구간 안에서 랜덤 시작 시각을 뽑는다 — 이벤트끼리 절대 겹치지 않고, 같은 턴에 같은 종류가 두 번 뽑히지도 않는다(`MINI_EVENT_TYPES`에서 중복 없이 셔플-슬라이스). 30초/60초 각 40회씩 무작위 생성해 개수·비율·경계·중복 조건을 모두 만족하는지 검증 완료
- **트리거**(`updateMiniEvents`, 매 프레임): 경과 시간 `elapsed = turnDuration - turnTimer`가 예약된 `startAt`을 넘으면 발동, `startAt + duration`을 넘으면 종료. 전투 중에는 `turnTimer`가 멈추므로(§3-4 참조) 이벤트 타이밍도 자연히 함께 일시정지된다
- **안내 자막**: 발동 시 새 UI를 만들지 않고 기존 `toast()`(화면 상단 중앙, 자동 사라짐)를 그대로 재사용해 "이번 턴 장애물: …" 안내와 같은 자리·같은 톤으로 표시

| 이벤트 | 발동 중 효과 |
|---|---|
| 🌟 코인 폭풍 (`coin_storm`) | 장애물 스폰 완전 정지(카운트다운 자체를 멈춰뒀다가 이벤트 종료 시 이어서 재개), 코인 스폰 간격 ×0.35(약 3배 빠르게) |
| ⚠️ 장애물 러시 (`obstacle_rush`) | 코인 스폰 간격 ×1.8(느리게), 장애물 스폰 간격 ×0.45(약 2배 빠르게) |
| 🌈 무지개다리 (`rainbow_bridge`) | 아래 설명 참조 |

두 스폰형 이벤트는 `MINI_EVENT_MODIFIERS`의 배율을 `updateSpawns()`의 간격 계산에 곱하는 방식으로 구현되어, 기존 난이도 스케일링(§5-2의 `diff` 기반 공식)과 자연스럽게 합성된다(이벤트가 끝나면 그 시점의 난이도 값을 기준으로 정상 간격으로 복귀).

**무지개다리 상세**: 발동 시 `rt.rainbowBridge`에 진행 상태를 만들고, 이벤트 지속시간의 앞 60% 동안 별(`type: "bridgestar"`, 총 `RAINBOW_BRIDGE_STAR_COUNT = 7`개)을 일정 간격으로 하나씩 스폰한다. 각 별은 사인파 경로(`y = 화면 중앙 + sin(위상) * 진폭`)를 따라 순서대로 배치되어, 뒤이어 스폰된 별들이 스크롤되며 화면에 늘어서면 전체적으로 구불구불한 "다리" 모양의 궤적처럼 보인다. 별 하나를 스치면(기존 충돌 판정 재사용) 그 즉시 코인 +3(`RAINBOW_BRIDGE_STAR_COIN_BONUS`)을 주고, 스폰된 별을 전부 다 모으면(놓친 별이 하나도 없으면) 완주 보너스로 보석 +2(`RAINBOW_BRIDGE_COMPLETE_GEM_BONUS`)를 추가 지급한다. 보상이 별 단위로 즉시 지급되기 때문에, 화면상 이벤트가 "종료"되는 정확한 시각 이후에도 이미 스폰된 별은 평소 코인처럼 계속 스크롤/수집 가능하며 별도의 종료 처리(강제 소멸 등)를 하지 않는다.

## 6. 전투 시스템

전투는 비행 중 몬스터와 부딪혀서가 아니라 **턴 타이머가 0에 도달하면 자동으로** 시작된다(`startTurnEndBattle()`, §3-4·§5-2). 시간 제한 없이 진행되며, 몬스터를 처치해야만 턴이 끝난다 — 공격을 맞아 "죽는" 것은 §6-5의 무제한 부활 재도전일 뿐 턴을 끝내지 않는다.

### 6-1. 몬스터 로스터 — 40종 · 티어 오픈 · 포지셔닝(배회)

`assets/monsters/*.png`(§11)에서 추출한 40개 스프라이트가 `MONSTERS` 배열(`game.js`)에 등록되어 있고, `startTurnEndBattle()`이 매 턴 이 중 1마리를 뽑아 실제로 전투에 등장시킨다.

**데이터 구조** — `MONSTERS`의 각 항목은 `{ id, name, sprite, pattern, tier }`:
- `id`: 파일명과 동일한 영문 슬러그(예: `stone_golem`). `MONSTER_MAP`으로 id→항목 조회 가능
- `name`: 우편/토스트 등에 표시되는 한글 이름(예: "돌 골렘")
- `sprite`: `assets/monsters/{id}.png` 경로. `MONSTER_SPRITE`에 8종 날개(`WING_SPRITE`)·180종 장애물(`OBSTACLE_SPRITE`)과 같은 방식으로 프리로드됨(`monsterSpriteReady(id)`로 로딩 여부 확인)
- `pattern`: 전투 중 배회 움직임 종류(아래 포지셔닝 표). `EFFECT_ASSETS`에 매핑이 없는 몬스터에 한해 §6-4의 공격 패턴(페인트 vs 몸통박치기)을 가르는 기준으로도 쓰인다
- `tier`: 1~5, 아래 누적 오픈 로직이 참조 — §6-4의 투사체/장애물/미니언 공격에서 이미지 세기로도 재사용된다

**체력/공격력은 몬스터별 개별 수치가 없다** — `hp = 30 + difficultyLevel()*4` 공식(플레이어 공격력은 §6-2의 차지 공격)을 몬스터 종류와 무관하게 그대로 사용한다. `tier`는 오직 "이번 턴에 어떤 몬스터들이 뽑힐 수 있는가"(등장 폭)만 조절하고, 전투 난이도 자체는 순수히 `turnsCompleted` 기반 `diff`가 담당한다.

**5단계 누적 오픈**(`getAvailableMonsterPool()`, tier당 8종 × 5 = 40종): `turnNumber = state.turnsCompleted + 1`(다음에 치를 턴, §3-4·§5-1과 동일한 1-기준 관례)을 기준으로 `openTiers = min(5, ceil(turnNumber / 4))`를 계산하고, `tier <= openTiers`인 몬스터를 전부 모은 뒤 `pick()`으로 균등 랜덤 선택한다.

| 턴 구간 | 열리는 티어 | 풀 크기 |
|---|---|---|
| 1~4턴 | tier 1 | 8종 |
| 5~8턴 | tier 1~2 | 16종 |
| 9~12턴 | tier 1~3 | 24종 |
| 13~16턴 | tier 1~4 | 32종 |
| 17~20턴 | tier 1~5 | 40종 |
| 21턴 이후 | tier 1~5(전체) | 40종 |

**전투 진입**: `startTurnEndBattle()`이 `pick(getAvailableMonsterPool())`로 뽑은 몬스터의 `id/name/pattern`과 diff 기반 hp를 `startBattle()`에 전달하고, "⏰ 비행 시간 종료! {몬스터 이름} 등장! 처치해야 방으로 돌아갈 수 있습니다!" 토스트를 띄운다. `rt.battle.monsterId`로 `MONSTER_SPRITE`를 조회해 실제 스프라이트를 그린다(`drawBattleMonster`, 높이 `MONSTER_BATTLE_HEIGHT=130`px 기준, 텔레그래프 중엔 빨간 글로우). 스프라이트가 아직 로딩되지 않았거나 `monsterId`가 없는 예외적인 경우엔 벡터 드로잉(`drawMonster`)으로 자동 대체된다.

**포지셔닝** — 몬스터는 `monsterWanderBounds()`(`xMin: cw()*0.5+30, xMax: cw()-40, yMin: 140, yMax: ch()-40`)로 정의된 **화면 우측 절반 안에서만** 배회한다(`updateMonsterWander`가 매 프레임 `rt.battle.x/y`를 이 범위 안으로 갱신·클램프 — 단, §6-4의 몸통박치기가 진행 중인 동안은 이 함수 대신 `updateBodySlam`이 좌표를 직접 제어한다). `pattern` 값에 따라 움직임이 달라진다:

| pattern | 움직임 |
|---|---|
| `hover` | 좁은 범위에서 8자形으로 둥실둥실(유령·정령류) |
| `circle` | 넓은 타원 궤도로 선회(비행·수영형) |
| `zigzag` | 빠르고 각진 지그재그(뱀·박쥐·거미류) |
| `bounce` | DVD 화면보호기처럼 대각선으로 튕김(속도 상태 `vx/vy` 보유, 슬라임류) |
| `pace` | 거의 일직선으로 천천히 좌우 왕복(육상형 다수, 기본값) |

같은 패턴이라도 `wanderSeed`(속도 배율, `rand(0.85,1.15)`)와 `wanderT` 시작 위상이 몬스터마다 랜덤이라 완전히 똑같이 움직이진 않는다. **플레이어는 이 제한과 무관하게 화면 전체를 마우스로 자유 이동한다** — `mousemove` 핸들러가 `rt.player.tx/ty`를 `cw()/ch()` 전체 범위로 클램프하며, 전투 중이라고 해서 좌우 제한을 추가로 거는 코드는 없다.

### 6-2. 차지 공격(검기) — 플레이어 공격

스페이스바를 누르고 있는 시간에 따라 데미지가 커지는 차지-릴리즈 방식(`startCharge()`/`releaseCharge()`). 이동(마우스 추적)은 차지 중에도 그대로 동작하며 속도 페널티는 없다.

- **차징 연출**: 누르는 즉시 캐릭터가 든 칼(`drawSword`)에 빛(`shadowBlur`)·펄스(밝기가 사인파로 맥동)·미세한 위치 떨림이 나타나고, 차지 시간이 길수록 3가지 강도가 모두 커진다. 검기 이미지는 이 단계에서 전혀 등장하지 않는다(캐릭터 앞에 떠 있지 않음) — 칼 휘두르기 스윙 애니메이션은 없다
- **0 ~ 0.3초**(`CHARGE_WEAK_THRESHOLD`): 데미지가 `CHARGE_MIN_DMG`(10, 기존 기본 공격력과 동일)로 고정
- **0.3 ~ 2.0초**(`CHARGE_MAX_TIME`): 데미지가 `CHARGE_MIN_DMG`→`CHARGE_MAX_DMG`(50)까지 선형 증가(`ramp = (t-0.3)/(2.0-0.3)`)
- **2.0초 이상 완충**: 데미지가 `CHARGE_MAX_DMG`에서 더 커지지 않고 고정
- **발사(`releaseCharge`, keyup)**: 뗀 시점의 차지 시간으로 데미지를 확정한 뒤, **실제 위치를 가진 투사체 객체**를 `rt.battle.projectiles`에 하나 생성한다 — 히트스캔(즉시 적중)이 아니다. 방향은 오직 **그 순간 `rt.player.facing`**(플레이어가 마지막으로 이동해 간 방향, `update()`의 이동 로직에서 마우스 목표 쪽으로 매 프레임 갱신)이며, **몬스터 위치를 전혀 참조하지 않는다** — 자동 조준·유도 없음. 0~0.3초 및 0.3~2.0초 구간은 `{wing}_weak.png`, 완충(2.0초 이상)은 `{wing}_full.png`를 투사체 이미지로 사용
- **이동·충돌**(`updateBattle`): 투사체는 매 프레임 `vx/vy`(발사 시 고정된 속도 `CHARGE_PROJECTILE_SPEED=900px/s` × 방향)만큼 직선 이동한다. 몬스터(`rt.battle.x/y`)와의 거리가 `CHARGE_HIT_RADIUS`(55px) 미만이 된 프레임에만 명중 처리(`applyChargeProjectileHit`)로 데미지를 적용하고 투사체를 제거한다. 화면 밖(여백 60px)으로 나가면 명중 없이 그냥 제거된다 — 조준이 빗나가면 데미지가 전혀 들어가지 않는다
- 완충 투사체가 명중하면 추가로 **넉백**(`CHARGE_KNOCKBACK=260`, 투사체 진행 방향으로의 임펄스, `updateBattle`에서 매 프레임 마찰로 감쇠하며 `monsterWanderBounds()` 안으로 다시 클램프)이 적용된다
- **날개별 배율**: `attackStatsForWing(wing).dmg / 10`을 위 데미지에 그대로 곱한다(무지개 ×1.3, 불꽃 ×1.2, 물 ×1.15). `attackStatsForWing`의 `cooldown` 필드(물 ×0.9, 전기 ×0.7)는 차지 시스템에 연타 쿨다운 개념이 없어 더 이상 쓰이지 않는다(코드에는 남아있음 — 사문화)
- **전기 날개 파워 페널티**는 그대로 유지: 차지-릴리즈(투사체 발사) 1회 = "공격 1회"로 취급되어 `electricUseCount`가 증가하고, 10회마다 10초간 `powerPenaltyTimer`가 발동해 그동안 데미지 ×0.5(발사 시점에 확정, 이동 중 재계산 없음)
- 무지개 날개의 전투당 1회 방패(`shieldUsed`)는 공격이 아니라 §6-5의 **피격 방어** 효과라 이와 무관하게 그대로 동작한다

### 6-3. 전투 이펙트 자산 매핑 (`EFFECT_ASSETS`)

§12에서 추출한 `assets/effects/` 85종 이미지를 실제 몬스터 id와 연결하는 매핑 테이블. `projectile`/`thrown`/`minion`/`zone` 4개 카테고리 전부 §6-4의 공격 패턴에서 소비되어 화면에 그려진다.

- `EFFECT_ASSETS`: `{ [monsterId]: { category, typeSlug } }` 형태의 객체. `category`는 이펙트 폴더(`projectile`/`thrown`/`minion`/`zone`)를 가리키며, §6-1의 배회 `pattern`과는 별개 개념이다. 매핑에 없는 몬스터 id는 §6-4에서 `pattern` 기준으로 페인트/몸통박치기가 배정된다
- `effectAssetPath(monsterId, tier?)`: `EFFECT_ASSETS`를 실제 파일 경로 문자열로 변환하는 헬퍼. `projectile`/`thrown`/`minion`은 세기별 이미지 5장(`_1`~`_5`)이 있으므로 `tier` 인자(생략 시 그 몬스터 자신의 `MONSTERS[].tier` 값, 1~5로 clamp)를 그대로 파일명 접미사로 재사용해 `assets/effects/{category}/{typeSlug}_{tier}.png`를 반환한다 — 몬스터 자체 티어가 높을수록 자동으로 더 강한 연출 이미지가 선택되는 구조. `zone`은 세기 단계가 없는 고정 이미지 1장이라 `assets/effects/zone/{typeSlug}.png`만 반환한다
- 위 카테고리가 쓰는 이미지는 `EFFECT_IMG_CACHE`/`getEffectImage()`로 필요한 시점에 하나씩 지연 로딩된다(§6-2의 `CHARGE_SPRITE`처럼 미리 전부 만들어두지 않음 — 몬스터·티어 조합이 많아서)

| 몬스터 id | category | typeSlug | 비고 |
|---|---|---|---|
| `baby_phoenix`, `baby_dragon` | projectile | `fireball` | 둘 다 화염구 공유 |
| `dark_mage` | projectile | `dark_orb` | |
| `lightning_pixie` | projectile | `lightning_bolt` | |
| `skeleton_archer` | projectile | `arrow` | |
| `sea_drake` | projectile | `water_breath` | |
| `spiky_cactus` | thrown | `spike` | |
| `stone_golem` | thrown | `boulder` | |
| `sand_worm` | thrown | `sandstorm` | 유일하게 장애물패턴(확산) — 나머지 thrown 4종은 장애물소환(단발) |
| `ice_golem` | thrown | `ice_shard` | |
| `magma_golem` | thrown | `lava_chunk` | |
| `spider` | minion | `baby_spider` | |
| `cursed_doll` | minion | `curse_pin` | |
| `fire_slime` / `ice_slime` / `poison_mushroom` / `bouncy_jellyfish` / `viper` / `bomb_monster` / `eye_of_doom` | zone | `{id}_zone` | 장판(데미지형) |
| `sticky_blob` | zone | `sticky_puddle` | 슬로우필드(감속형) |
| `wind_sprite` | zone | `wind_vortex` | 슬로우필드(감속형) |

### 6-4. 몬스터 공격 패턴 8종

몬스터의 "몬스터 공격" 이벤트는 1.6~2.4초 랜덤 간격으로 예약되고, 명중 0.5초 전 ⚠️ 텔레그래프가 뜬다. 이 타이머가 0에 도달하는 순간 `monsterAttackKind(monsterId)`가 8가지 패턴 중 하나로 분기한다(`b.attackKind`, `startBattle()`에서 전투 시작 시 1회 결정).

| attackKind | 판정 기준 | 대상 |
|---|---|---|
| `projectile` | `EFFECT_ASSETS.category === "projectile"` | 6종 |
| `minion`(미니언소환) | `category === "minion"` | 2종(`spider`, `cursed_doll`) |
| `obstaclePattern`(장애물패턴) | `category === "thrown"` && `typeSlug === "sandstorm"` | `sand_worm` 1종 |
| `obstacleSummon`(장애물소환) | `category === "thrown"` && 그 외 typeSlug | 4종(가시/돌덩이/빙편/용암) |
| `zone`(장판) | `category === "zone"` && typeSlug가 "장판형" | 7종 |
| `slowfield`(슬로우필드) | `category === "zone"` && typeSlug가 `sticky_puddle`/`wind_vortex` | 2종 |
| `feint`(페인트) | `EFFECT_ASSETS` 매핑 없음 && `MONSTERS.pattern`이 `hover`/`zigzag` | 7종(박쥐·늑대인간·철갑멧돼지·유령류 등) |
| `charge`(몸통박치기) | `EFFECT_ASSETS` 매핑 없음 && 그 외 pattern(`pace`/`bounce`/`circle`) | 나머지 11종(기본값) |

패턴이 발동되면 `b.attackBusy = true`가 되어 시퀀스가 끝날 때까지 다음 공격 타이머(`attackTimer`)가 멈춘다. `updateBattle()` 맨 끝에서 8가지 상태(`dash`/`zone`/`slowField`/`feint`/`monsterProjectiles`/`minions`)가 **전부** 비었는지 공통으로 검사해, 비었을 때만 `attackBusy = false`와 `attackTimer = rand(1.6, 2.4)`로 한꺼번에 재시작한다 — 장애물패턴처럼 한 번에 여러 개를 스폰하는 경우에도 마지막 하나가 끝날 때까지 정확히 기다린다.

- **몸통박치기(`charge`)**: 텔레그래프가 끝나는 순간 몬스터가 그 자리(`fromX/fromY`)에서 화면 왼쪽 끝 근처(`BODY_SLAM_TARGET_X = 40`)까지 `BODY_SLAM_OUT_DUR`(0.35초) 동안 수평으로 돌진한 뒤, `BODY_SLAM_RETURN_DUR`(0.5초) 동안 원래 있던 우측 절반 위치로 되돌아온다(`updateBodySlam`이 이 시퀀스 동안 `b.x/b.y`를 직접 갱신). 돌진 경로(왕복 중 `y`는 고정) 위에서 플레이어와의 거리가 `BODY_SLAM_HIT_RADIUS`(50px) 미만이 되는 첫 프레임에만 명중 처리되고(돌진당 최대 1회, `dash.hasHit`), 경로에서 벗어나 있으면 완전히 회피된다 — 몬스터 자체 이미지 외 별도 이펙트 자산은 쓰지 않는다.
- **투사체(`projectile`) / 장애물소환(`obstacleSummon`) / 장애물패턴(`obstaclePattern`)**: 세 패턴 모두 `b.monsterProjectiles` 배열과 `updateMonsterProjectiles`/`renderMonsterProjectiles`를 공유하는 하나의 시스템이다 — 캐스트되는 순간 `effectAssetPath(monsterId)`로 그 몬스터의 이미지(티어 반영, 예: `skeleton_archer`는 tier 2 → `assets/effects/projectile/arrow_2.png`)를 골라, **그 순간의 플레이어 위치**를 향한 각도로 발사한다. 발사 이후 플레이어가 움직여도 궤도를 다시 조준하지 않고(유도 없음) 직진만 하다가, 매 프레임 플레이어와의 거리가 항목별 `hitRadius` 미만이면 명중, 화면 밖(여백 60px)으로 나가면 회피로 소멸한다.
  - `projectile`: 1개, 속도 `MONSTER_PROJECTILE_SPEED`(500px/s), `hitRadius = MONSTER_PROJECTILE_HIT_RADIUS`(30px)
  - `obstacleSummon`: 1개, 속도 `OBSTACLE_THROW_SPEED`(480px/s), `hitRadius = OBSTACLE_HIT_RADIUS`(34px) — 투사체와 이미지 폴더(`thrown/`)만 다르고 이동·판정 방식은 동일
  - `obstaclePattern`: 플레이어 방향(`baseAngle`)을 중심으로 `OBSTACLE_PATTERN_SPREAD`(108˚) 범위에 걸쳐 `OBSTACLE_PATTERN_COUNT`(6개)를 균등한 각도 간격으로 동시에 뿌린다(속도·hitRadius는 `obstacleSummon`과 동일) — 넓게 퍼지는 만큼 정중앙만 노리는 게 아니라 일부는 빗나가도록 설계된 확산 공격
- **미니언소환(`minion`)**: 캐스트되는 순간 스폰 지점(몬스터 위치 근처, ±20px 랜덤) 기준으로 부하를 1~2마리(균등 확률) 생성한다(`b.minions`, 이미지는 티어 반영). 각 부하는 개별적으로 **매 프레임 그 시점의 플레이어 위치를 향해 호밍**하며 접근한다(`updateMinions`, 속도 `MINION_SPEED = 220px/s`) — 투사체와 달리 발사 후에도 계속 재조준한다는 점이 유일한 차이. 플레이어와의 거리가 `MINION_HIT_RADIUS`(26px) 미만이 되면 그 부하만 소모되며 접촉 피해를 주고, `MINION_LIFETIME`(6초) 안에 닿지 못한 부하는 회피로 소멸한다 — 부하 여러 마리가 동시에 있으면 각각 독립적으로 판정된다.
- **장판(`zone`)**: 캐스트되는 순간 **그 순간의 플레이어 위치**에 zone 이미지(세기 단계 없음)로 위험구역(`b.zone`, 반지름 `ZONE_RADIUS = 70px`)을 표시한다. `ZONE_DELAY`(1초) 뒤에 그 자리에 플레이어가 여전히 반경 안에 있으면 명중, 그 전에 벗어나면 회피(`updateZone`). 표시되어 있는 동안 `renderZone`이 데드라인에 가까워질수록 더 빠르고 크게 펄스를 키워 긴박감을 준다. `renderBattle()`에서 플레이어보다 먼저 그려 발밑 바닥처럼 보이게 한다.
- **슬로우필드(`slowfield`)**: 장판과 스폰 방식(캐스트 시점 플레이어 위치, zone 이미지)은 같지만 데미지가 전혀 없다 — 대신 `SLOWFIELD_DURATION`(4초) 동안 그 자리(`b.slowField`, 반지름 `SLOWFIELD_RADIUS = 90px`)에 남아있는 지속형 구역이다. 실제 감속은 `update()`의 플레이어 이동 로직에서 매 프레임 "지금 슬로우필드 반경 안에 있는가"를 직접 확인해 이동속도에 `SLOWFIELD_SPEED_MUL`(×0.4)을 곱하는 방식으로 적용된다 — 안에 머무는 동안 계속 느려지고, 벗어나면 즉시 정상 속도로 돌아온다. 데미지가 없으므로 §6-5의 `resolveMonsterHit()`는 호출하지 않는다.
- **페인트(`feint`)**: 캐스트되는 순간 `FEINT_CHANCE`(40%) 확률로 "가짜"가 된다 — `b.feint`(대기 상태)만 만들고 아무 공격도 실행하지 않은 채, `FEINT_PAUSE_MIN~MAX`(0.4~0.8초) 뒤에야 몸통박치기(`b.dash`)를 시작한다(`updateFeintState`). 나머지 60%는 지연 없이 즉시 몸통박치기가 시작된다. 텔레그래프(⚠️)는 이미 그 전 0.5초 동안 정상적으로 떴다가 사라진 상태라, 페인트가 걸리면 "경고는 떴는데 아무 일도 안 일어나는" 낌새를 챈 뒤에야 진짜 돌진이 온다.

### 6-5. 피격 · 처치 규칙

§6-4의 8가지 패턴 중 슬로우필드를 제외한 7가지가 명중하면 공용 함수 `resolveMonsterHit()`가 실행된다:

- 플레이어가 무적 중이면 회피, 무지개 날개면 전투당 1회 방패(`shieldUsed`)로 무효화(토스트로 안내)
- 그 외에는 목숨 -1, 보석 -1, 콤보 리셋(`resetCombo`), 즉시 부활(무적 1.2초 부여) — **몬스터 체력은 유지된 채 전투가 계속된다**(재도전 횟수 제한 없음)
- 목숨이 0 이하가 되면 `triggerGameOver()`로 게임오버

몬스터 처치(§6-2 차지 공격이 hp를 0 이하로 만들면, `applyChargeProjectileHit()`에서 처리)는 별도 보상 경로다: 코인 +5(황금 날개면 +10), 돈 +3, 무적 1.2초. "보석 광산" 편지 효과가 대기 중이면 보석 +1 추가. 보상 지급 직후 `startCoinSettlement()`이 실행되어 턴 정산 화면(§6-6)이 뜨고, 그 화면이 끝나야 비로소 턴 종료 로직(방 복귀 + 5분 휴식 타이머 시작 + 우편함에 편지 1통 생성, §3-4)이 실행된다 — 전투가 유일한 진입 경로이므로 몬스터 처치는 곧 그 턴의 마지막 사건이다.

### 6-6. 턴 정산 화면 (코인 → 보석 전환)

몬스터를 처치해 턴이 끝나는 순간, 방으로 돌아가기 전에 **코인을 20개 단위로 보석으로 자동 교환**하는 정산 화면(`#modal-settlement`)이 뜬다. 처치 보상(코인 +5/+10)까지 반영된 `state.coins`를 기준으로 계산한다.

- 상수: `COIN_TO_GEM_RATE = 20`, `SETTLEMENT_START_DELAY_MS = 1500`, `SETTLEMENT_END_DELAY_MS = 1500`
- **전환 개수**: `conversions = floor(state.coins / 20)`. 나머지(`state.coins % 20`)는 코인으로 그대로 남는다
- **화면은 매턴 항상 뜬다**: 예전에는 변환할 코인이 없으면(20개 미만) 화면 자체를 건너뛰었지만, 지금은 **변환할 게 없어도 정산 화면을 항상 보여준다.** 이 경우 전환 단계 없이 곧바로 "정산 완료"로 간주하고 시작 지연(아래) 없이 바로 종료 대기(`SETTLEMENT_END_DELAY_MS`)로 들어간다
- **화면이 멈춤**: 정산이 시작되면 `rt.running = false`로 비행 루프(캔버스 렌더링)를 정지시킨 뒤 모달을 띄운다. 정산이 끝나야(`endFlightTurn()` → `switchScene("room")`) 씬이 바뀐다
- **타이밍**:
  1. 모달이 뜨자마자 코인/보석 숫자는 현재 값 그대로 표시되고, 곧바로 전환을 시작하지 않는다 — **`SETTLEMENT_START_DELAY_MS`(1.5초)** 동안 그대로 대기한 뒤에야 첫 전환이 시작된다(변환할 코인이 없는 경우는 이 지연을 건너뜀)
  2. 전환은 `setTimeout` 기반의 "틱"으로 한 번에 하나씩 순차 적용된다. 틱마다 `state.coins -= 20`, `addGems(1)`(기존 보석 20개→트로피 전환 체인도 자연스럽게 함께 발동), 화면 숫자 갱신, 코인/보석 각각 `.settlement-pulse` 팝 효과(트랜지션 `transform: scale(1.3)`, 코인은 주황빛·보석은 청록빛으로 살짝 색 변화), `playGemChime()` 벨소리(C6→G6 두 음, Web Audio 오실레이터 직접 합성 — §5-4-2의 `playPickupSound`와 같은 AudioContext 재사용) 재생. 틱 간격은 `clamp(2200 / conversions, 70, 220)`ms로, 전환 개수가 많아도(예: 코인 500개 = 25번 전환) 전체 애니메이션이 과도하게 늘어지지 않도록 자동으로 빨라진다
  3. 모든 전환이 끝나면(또는 애초에 전환할 게 없었으면) **`SETTLEMENT_END_DELAY_MS`(1.5초)** 동안 정산 결과를 그대로 보여준 뒤에야 모달이 닫히고 `endFlightTurn()`이 실행되어 방으로 돌아간다
- **건너뛰기**: "건너뛰기" 버튼(`#btn-skip-settlement`, 방 화면의 "휴식 건너뛰기"와 같은 목적)을 누르면 남은 전환을 한 번에 모두 처리한 뒤, 동일하게 `SETTLEMENT_END_DELAY_MS`(1.5초) 후 방으로 복귀한다(시작 지연·틱 간격만 건너뛸 뿐, 종료 대기는 그대로 적용됨)
- **화면 표시**: 캔버스가 아닌 HTML 모달로 구현되어(`.settlement-box`) 기존 모달들과 톤을 맞췄고, `MODAL_IDS`에도 등록되어 있어 정산 중에는(다른 모달과 마찬가지로) 숫자키 아이템 사용이 막힌다

## 7. 아이템 (4종, 코인 10개 단위로 랜덤 획득)

| 키 | 이름 | 효과 |
|---|---|---|
| 1 | 🍑 복이 온다 복숭아 | 목숨 +1 (최대 10) |
| 2 | 💎 반짝반짝 보석 | 보석 +1 (20개 도달 시 트로피 전환 로직도 함께 트리거) |
| 3 | 🐒 원숭이는 바나나를 좋아해 | 비행 진행을 완전히 멈추고(`rt.paused=true`) 미보유 날개 중 선택 → 60초간 임시 변신. 재사용 시 60초로 갱신. 이미 모든 날개 보유 시 사용해도 효과 없음(소모되지 않음) |
| 4 | 💺 마사지 의자 | 10초 동안 비행 중 획득하는 돈이 보석으로 대체 지급. 재사용 시 10초로 리셋 |

## 8. 날개 8종

`WINGS` 배열 순서 = 방 날개걸이 그림 배치 순서(4열×2행)이자 획득 UI 순서.

| 날개 | 이동/특수 효과 | 전투 보정 |
|---|---|---|
| 기본 | — | — |
| 황금 | 코인 획득 2배, 몬스터 처치 코인 보상 2배(10개) | — |
| 구름 | 비행 중 주기적으로 등장하는 구름(반지름 50~80px, 4~8초 간격)에 들어가면 몬스터에게 발견되지 않고 통과 | — |
| 무지개 | — | 공격력 ×1.3, 전투당 1회 자동 방패 |
| 하늘 | 전투 아닐 때 날씨 버튼 노출(해/비/구름 전환, 배경 연출만 변경, 수치 영향 없음) | — |
| 불꽃 | — | 공격력 ×1.2 |
| 물 | — | 공격력 ×1.15, 공속 ×1.11 |
| 전기 | — | 공속 ×1.43, 10타마다 10초 파워 50% 감소 |

- 스프라이트: `assets/sprites/{id}.png` (배경 제거된 실제 비행 렌더링용), 앵커 좌표는 `game.js`의 `WING_ANCHOR`(캐릭터 눈 주변 중심점 기준, 비율 0~1)에 하드코딩.
- 선택 UI 썸네일(배경 있는 일러스트 카드): `assets/cards/{id}.png` — 별도 자산, 스프라이트와 다른 원본.

## 9. 방(Room) 시스템

| 오브젝트 | 동작 |
|---|---|
| 날개걸이 | 클릭 시 날개 선택 모달(보유 날개만 장착 가능, 미보유는 잠금 표시) |
| 보석함 | 클릭 시 진행도 토스트. 위험 상태(`gemboxDanger.active`)일 때 클릭하면 "숨을까요?" 확인 모달 |
| 트로피 전시대 | 클릭 시 진행도(트로피/누적 트로피) 토스트 |
| 냉장고 | 클릭 시 음료 모달(재고 0이면 토스트로 거부) |
| 🔄 새로 시작하기 | 확인 후 전체 초기화 |

### 보상 체인 (둘 다 소진형 — 도달 시 리셋)
```
보석 20개 → 트로피 +1, 보석 -20 (반복 처리, addGems 내부 while문)
트로피 10개 → 미보유 날개 중 랜덤 1개 획득, 트로피 -10
  (모든 날개 이미 보유 시: 대신 코인 +20)
```

### 우편 위험 이벤트 (보석함 숨기)
`gembox_warning` 편지를 읽은 뒤 방으로 돌아가면: 보석함이 위험 상태로 전환되고 5초 카운트다운(`setInterval`, 1초 단위) 시작. 그 안에 보석함 클릭 → 확인 모달에서 "예" → 위기 모면. "아니오" 또는 시간 초과 → 목숨 -0.5.

## 10. 상점(Shop) & 우편함

- 돈 10개 → 보석 1개 교환 버튼 (`btn-exchange`, 돈 10 미만이면 비활성화)
- 우편함(`obj-mail`): 대기 편지가 있으면(`mailbox.hasLetter`) 빨간 배지 표시. 클릭 시 편지 즉시 `apply()` 실행 후 내용 모달 표시. 편지가 없으면 "새 우편이 없습니다" 토스트만.
- 편지는 비행 턴 종료마다 1통씩 생성되며, **이미 대기 중인 편지가 있으면 새로 생기지 않음**(최대 1통).
- 편지 5종은 `LETTERS` 배열에서 균등 랜덤 선택(현재 코드상 직전 편지 중복 방지 로직 없음).

| 편지 | 유형 | 효과 |
|---|---|---|
| 몬스터가 보석을 먹었다 | 즉시효과 | 보석 -1 |
| 보석함에 숨으라는 경고 | 이벤트(방 복귀 후) | 위 "우편 위험 이벤트" 참조 |
| 몬스터가 보석 광산에 갔다 | 즉시효과(플래그) | 다음 비행에서 몬스터 처치 시 보석 +1 추가(1회성) |
| 무더위/전기세 인상 | 즉시효과 | 돈 -1 |
| 주문한 과자 도착 | 즉시효과 | 돈 -1, 목숨 +0.5 |

## 11. 자산(Assets) 구조 & 추출 파이프라인

```
assets/
  backgrounds/   room.png, shop.png (씬 배경, 1536x1024 기준 좌표계로 핫스팟 정렬)
  obstacles/{space,ocean,dessert,household,fruit,transport}/{small,medium,large}/{0..9}.png
  sprites/       {basic,golden,cloud,rainbow,sky,flame,water,electric}.png + anchors.json (비행용, 배경 제거)
  cards/         위와 동일 8종 (배경 있는 일러스트 카드, 선택 UI용)
  icons/         coin.png, money.png, gem.png (HUD/비행 오브젝트 아이콘)
  monsters/      몬스터 40종 {id}.png (§6-1 MONSTERS 배열과 1:1 대응)
  effects/       전투 이펙트 원본 85종(§12) — charge/projectile/minion/thrown/zone 5개 하위 폴더, 전부 game.js에서 실제로 참조됨(§6-2, §6-4)
design/          원본 시트(장애물 6테마, 캐릭터+날개 시트, 몬스터 20종×2 시트, 이펙트 5종 시트 등) — 추출 파이프라인 입력, git 비추적 원본 보관용
scripts/         Python 추출/후처리 파이프라인 (Pillow, numpy, scipy.ndimage 기반)
  extract_obstacles_v3.py   design/의 6개 테마 시트 → assets/obstacles/ (행 밀도 검출 + 연결요소 클러스터링으로 크롭)
  extract_characters_v2.py  design/캐릭터 시트 → assets/sprites/ + anchors.json (눈 주변 어두운 픽셀 중심을 앵커로 사용)
  extract_monsters.py       design/의 몬스터 시트 2장(4행x5열, 라벨이 아이콘 위에 있음) → assets/monsters/ 40종
  extract_effects.py        design/의 이펙트 시트 5장 → assets/effects/ 85종(§12) — 흰 배경(minion/thrown/zone)은 테두리 flood-fill, 어두운 배경(charge/projectile)은 밝기 기반 알파로 각각 배경 제거
  upscale_obstacles.py      타일별 목표 높이(소130/중190/대260px) 미만 원본을 Lanczos+언샤프마스크로 업스케일
  contact_sheet.py          여러 아이콘을 한 장에 모아보는 검수용 이미지 생성(테마/티어 구조 flat 모드 지원)
```

- 세 추출 스크립트 모두 배경 투명화에 **테두리 flood-fill 방식**을 쓴다: 이미지 테두리에서부터 거의-흰 픽셀을 연결해 "테두리와 실제로 이어진 흰 영역"만 배경으로 지우고, 캐릭터 내부에 둘러싸인 흰 하이라이트(뼈·별빛·얼음 반사광·구름 날개의 흰 구름 등)는 테두리와 연결되지 않으므로 불투명하게 보존한다. 단순 "흰색과의 색상 거리" 임계값 방식은 내부 하이라이트까지 배경으로 오인해 구멍이 뚫리는 문제가 있어 폐기했다(2026-08-13 세션에서 발견·수정).

- 코인/돈/보석 아이콘(`assets/icons/*.png`)은 상점/방 배경 그림 속 작은 배지를 잘라 쓴 것이라 해상도가 낮고(coin 79×59 등) 가장자리가 잘려 보이는 한계가 있음 — **전용 원본 미보유, 추후 별도 원본 제공 시 동일 파이프라인으로 재작업 예정** (2026-08-12 세션에서 사용자 확인).

## 12. 전투 이펙트 자산 (추출 완료, 전부 연동 완료)

`assets/effects/`(§11)에 원본 시트 5장(`design/`)에서 추출한 이펙트 이미지 85종이 준비되어 있다. `charge/`(플레이어 검기, 16종)는 `CHARGE_SPRITE`로 프리로드되어 §6-2의 차지 공격 시스템에서 실제로 그려진다. 몬스터 id → 이펙트 자산 매핑(`EFFECT_ASSETS`/`effectAssetPath()`, §6-3, 69종: projectile/thrown/minion/zone)은 §6-4의 공격 패턴 8종에서 전부 소비된다 — `projectile`(25종)은 투사체, `thrown`(25종)은 장애물소환/장애물패턴, `minion`(10종)은 미니언소환, `zone`(9종)은 장판/슬로우필드로 각각 그려진다. 85종 전체가 게임에 실제로 쓰이는 상태다.

| 하위 폴더 | 파일명 규칙 | 개수 | 원본 시트 |
|---|---|---|---|
| `charge/` | `{wingId}_{weak\|full}.png` (8종 날개 × 2단계) | 16 | `플레이어 차지 공격(검기).png` |
| `projectile/` | `{fireball\|dark_orb\|lightning_bolt\|arrow\|water_breath}_{1~5}.png` (5종 × 5티어) | 25 | `몬스터 투사체.png` |
| `minion/` | `{baby_spider\|curse_pin}_{1~5}.png` (2종 × 5티어) | 10 | `몬스터 미니언.png` |
| `thrown/` | `{boulder\|ice_shard\|sandstorm\|lava_chunk\|spike}_{1~5}.png` (5종 × 5티어) | 25 | `몬스터 투척 장애물.png` |
| `zone/` | 장판형 7종 + 지속형 2종(`sticky_puddle`, `wind_vortex`) | 9 | `몬스터 장판, 필드이펙트.png` |

- 배경 제거 방식은 시트 배경색에 따라 다르다: 흰 배경 시트(minion/thrown/zone)는 테두리 flood-fill(§11 세 추출 스크립트와 동일한 방식), 어두운 배경 시트(charge/projectile, 발광 이펙트)는 밝기를 알파로 쓰는 방식(`dark_bg_alpha`)을 사용한다.
- `assets/effects_contact_{charge,projectile,minion,thrown,zone}.png`는 각 카테고리를 한 장에 모아보는 검수용 contact sheet(git 비추적, 로컬 확인용) — 85장 전량 라벨 텍스트 혼입·잘림·빈 슬롯 없이 정상 추출된 것을 육안으로 확인 완료(2026-08-14).

## 13. 알려진 임시값 / TODO

- `startFlight()`의 턴 타이머가 60초가 아닌 **30초로 하드코딩**되어 있음(테스트용, 원복 필요 — §3-4 참조).
- 비행 화면의 "🚪 중간에 나가기" 버튼(`btn-exit-flight`)은 턴 종료를 기다리지 않고 즉시 `endFlightTurn()`을 호출하는 **테스트 전용 버튼**(코드 주석에도 명시) — 정식 배포 전 제거 또는 별도 처리 필요.
- 우편 편지 랜덤 선정에 직전 편지 중복 방지 로직 없음(균등 랜덤만 적용).
- 코인/돈/보석 아이콘 화질 개선 보류 중(§11 참조).
- 플레이어 차지 공격(검기)과 몬스터 공격 패턴 8종(몸통박치기/투사체/장애물소환/장애물패턴/미니언소환/장판/슬로우필드/페인트) 모두 구현·연동 완료(§6-2, §6-4).

## 14. 인원수 / 캐릭터 3종 / 2인 협동 플레이

최초 진입(§3-1) 앞에 **인원수 선택(1명/2명, `state.hasChosenPlayerCount`) → 캐릭터 선택(1명이면 1회, 2명이면 P1→P2 순서로 2회)** 단계가 추가되었다. 이후엔 §3-1의 기존 음료/날개 선택 흐름으로 그대로 이어진다. 재접속 시에는(§3-2와 동일하게) 이 단계를 다시 거치지 않는다.

### 14-1. 주인공 3종

`CHARACTERS` 배열(`hero1/hero2/hero3`)로 관리되며, 날개(§8)와는 독립적인 선택지다 — "캐릭터 + 장착 날개" 조합으로 실제 스프라이트/차지 이펙트가 정해진다.

- `hero1`은 기존 자산 경로를 그대로 쓴다(`assets/sprites/{wing}.png`, `assets/effects/charge/{wing}_{weak|full}.png`) — 재추출 없음.
- `hero2`/`hero3`는 `scripts/extract_new_characters.py`(신규, `extract_characters_v2.py`/`extract_effects.py`와 동일한 흰배경 제거 방식 재사용)로 `design/캐릭터 및 날개 디자인_주인공{2,3}_흰배경.png`(스프라이트, 기존 주인공1 시트와 동일한 2행×4열 레이아웃)와 `design/주인공{2,3}_플레이어 차지 공격_{1,2}.png`(차지 약/강, 4행×[캐릭터 썸네일|약검기|강검기] 3열 표)에서 추출했다.
  - 스프라이트: `assets/sprites/char2/{wing}.png`, `assets/sprites/char3/{wing}.png` (8종 날개 × 2캐릭터 = 16장)
  - 차지 이펙트: `assets/effects/charge/hero2/{wing}_{weak|full}.png`, `assets/effects/charge/hero3/{wing}_{weak|full}.png` (8종 × 2단계 × 2캐릭터 = 32장)
  - 앵커 좌표는 캐릭터별로 새로 검출해 `game.js`의 `WING_ANCHOR2`/`WING_ANCHOR3`에 하드코딩(참고용 원본은 `assets/sprites/char{2,3}/anchors.json`).
  - `무지개` 날개 한정으로 배경에 옅게 남는 장식용 무지개 궤적 잔여물이 있음(주인공1의 `remove_rainbow_bg_arc`에 준하는 후처리를 시도했으나 흰머리 캐릭터(주인공3)의 머리카락을 오삭제하는 부작용이 더 커서 보류 — 캐릭터 훼손 없음을 우선함).

### 14-2. 조작 방법

| 모드 | 이동 | 공격 |
|---|---|---|
| 1인 | 마우스(기존과 동일) | `state.soloAttackKey`(기본 Space) |
| 2인 P1 | ↑↓←→(`state.p1Keys`) | `state.p1Keys.attack`(기본 P) |
| 2인 P2 | R/F/D/G(`state.p2Keys`) | `state.p2Keys.attack`(기본 Q) |

- 2인 모드에서는 마우스 이동이 비활성화되고(`mousemove`/`touchmove` 핸들러가 `playerCount===1`일 때만 동작), 방향키 눌림 상태를 `rt.keysDown`(Set)에 기록해 매 프레임 속도 기반(340px/s)으로 이동시킨다 — 두 플레이어가 동시에 이동·차지·발사 가능.
- 방(§9)의 "⌨️ 조작 방법 변경" 버튼(`modal-keybind`)에서 키 칩을 클릭 → "새 키를 입력하세요" 대기(`rt.keyRebindTarget`) → 다음 keydown을 캡처해 저장. 1P/2P를 통틀어 이미 쓰이는 키(자기 자신 제외)면 "이미 사용 중인 키입니다."를 표시하고 저장하지 않는다(`isKeyInUse`).

### 14-3. 몬스터 수 · 난이도/보상 배율 (`playerCount === 2`에서만 적용)

- **몬스터 수**: `monsterCountForPlayerCount()` — 1인 1마리(기존과 동일), 2인 **2마리**. `startTurnEndBattle()`이 이 수만큼 `getAvailableMonsterPool()`에서 각각 독립적으로 뽑아(같은 몬스터가 중복으로 뽑힐 수도 있음) `rt.battles` 배열에 push한다. 체력 공식(§6-1, `(30+diff*4)*6`)은 동일 — 마리 수만 늘어난다.
- **독립성**: 각 배틀 객체(`rt.battles[i]`)는 HP/위치/공격 타이머/투사체를 완전히 따로 가진다. 한 마리를 처치해도(`rt.battles`에서 제거) 나머지는 그대로 행동을 계속하며, **모든 몬스터가 죽어야**(`rt.battles.length === 0`) 턴 정산(§6-6)으로 넘어간다.
- **포지셔닝**: `monsterWanderBounds(b)`가 기존 우측 절반 배회 영역(§6-1)을 몬스터 수만큼 상/하로 분할해 배정(`b.slotIndex`/`slotCount`)해 두 마리의 초기 위치·배회 범위가 겹치지 않는다. 각 몬스터는 조준 기준 플레이어(`b.targetPlayerIdx`, 몬스터0→P1·몬스터1→P2)를 하나씩 배정받아 투사체/장판 등 초기 발사각·중심 좌표를 거기서 계산하지만, **피격 판정은 두 플레이어 모두를 대상으로** 한다(`playerHitAt`) — 다른 플레이어가 끼어들어도 맞으면 그 플레이어가 피해를 입는다.
- **공격 타이밍 분산**: 두 몬스터의 `baseAttackTimer`/`specialAttackTimer` 초기값에 슬롯 인덱스만큼 약간의 지연(0.5초/1.0초)을 더해, 완전히 같은 타이밍에 두 몬스터가 동시에 공격을 시작해 회피 불가능해지는 상황을 줄인다.
- **장애물/코인/돈 스폰 배율**: `updateSpawns()`에서 기존 간격 계산(§5-2) 직후 `P2_OBSTACLE_SPAWN_MULTIPLIER = 1.6`, `P2_REWARD_SPAWN_MULTIPLIER = 1.5`로 간격을 나눠 빈도만 올린다(속도·크기는 그대로) — 예: diff=0 기준 장애물 간격 1.64초→1.03초, 코인 0.87초→0.58초. `playerCount===1`이면 이 블록이 전혀 실행되지 않아 기존 밸런스가 100% 보존된다.

### 14-4. 재화 완전 분리 · 게임오버 조건

`playerCount === 2`에서는 **목숨·보석·코인·돈 4종 모두 P1/P2가 완전히 분리**된다(`state.p1Wallet`/`state.p2Wallet`, 필드는 기존 단일 필드와 동일한 이름 `lives/gems/coins/money`). 아이템 인벤토리도 §15-1부터 P1/P2가 완전히 분리된다. 트로피/날개 보유는 여전히 공용으로 유지한다(트로피는 P1/P2 중 누구의 보석이 20개를 채우든 같은 공용 진행도에 적립).

- `wallet(playerIdx)`(1인 모드면 `null`, 2인 모드면 해당 지갑)를 감싸는 얇은 접근자로 `addGems`/`addCoins`/`loseLife` 등 기존 함수들을 그대로 재사용 — 1인 플레이 호출부는 `playerIdx`를 생략하면 기존 단일 `state.lives` 등을 그대로 쓴다(무변경).
- 방/상점 화면은 좌측 상단 P1/P2 토글(`state.roomActivePlayer`)로 "지금 어느 플레이어의 자원을 다루는지"를 정한다 — 냉장고/보석함 진행도/날개 장착/상점 교환/우편 편지 효과가 전부 이 토글을 따른다.
- 몬스터 처치 보상(코인/돈/보석)은 **그 몬스터에게 마지막 타격을 넣은 플레이어에게만** 지급된다(투사체에 태그된 `ownerIdx`) — 다른 플레이어의 지갑은 늘지 않는다.
- **게임오버는 두 플레이어의 목숨이 모두 0이 되었을 때만** 발동한다(`resolveMonsterHit`/`loseLife` 공통 로직) — 한쪽만 0이 되면 게임오버 대신 §15-2의 "사망" 상태로 전환되고, 다른 쪽 목숨이 남아있으면 전투가 계속된다.
- 캐릭터 변경(방의 "🧑 캐릭터 변경")은 즉시 반영되지 않고 `p{n}CharacterNextTurn`에만 저장되어, **다음 `startFlight()`(다음 턴)부터 적용**된다(`applyPendingCharacterChanges`). 최초 온보딩 선택만 예외적으로 즉시 반영된다.
- 위 모든 설정(인원수/캐릭터/조작키/다음 턴 예약 캐릭터/지갑)은 기존 `saveState()`/`loadState()`(§1) 그대로 `localStorage`에 저장·복원된다 — 새 저장 키를 추가하지 않았다.

## 15. 2인 협동 보완(아이템 분리 · 사망/부활 · 우편 순차 처리 · 몬스터 몸통 접촉)

§14의 2인 협동 시스템에 이어 아이템·전투 생존·우편함을 마저 P1/P2 개별 규칙으로 보완했다. 그 과정에서 조사한 결과, 이동 속도 대칭(§14-2, 상하좌우 모두 동일 `speed`, 대각선은 `Math.hypot` 정규화로 √2배 가속 방지)과 전투 화면 고정 뷰포트(`fixedViewW/H`, VIEW_SCALE=0.8)는 이미 턴 1/2/3+·1인/2인·방↔비행 재진입 전 구간에서 정확히 동일한 값을 유지하고 있음을 실측(턴을 반복 강제 진행하며 `fixedViewW/H`·`vw()/vh()` 값을 비교)으로 확인했다 — 별도 수정 없음.

### 16-1. 아이템 인벤토리 P1/P2 분리 + 비행 중 개별 단축키

- `state.p1Inventory`/`state.p2Inventory`(1인 모드는 기존 `state.inventory` 그대로) — `inventoryFor(playerIdx)`가 지갑의 `wallet(playerIdx)`와 동일한 패턴으로 대상을 고른다. 코인 10개 단위 아이템 지급(§7)도 코인을 모은 그 플레이어의 인벤토리로 들어간다.
- 비행 중 화면에 인벤토리 창이 2인 모드에서는 **P1(좌하단, 기존 위치) / P2(우하단, `#inventory-bar-flight-p2`, `.inventory-bar-p2`)** 두 개로 나뉘어 각자의 아이템 4종과 개수만 표시된다(1인 모드는 기존처럼 P1 창 하나만).
- 단축키: **1P는 기존 그대로 1/2/3/4**, **2P는 신규 7/8/9/0**(`DIGIT_TO_ITEM_INDEX_P2`) — 비행 중에만 동작하며 각자 자기 인벤토리만 소모·적용한다. 방/상점 화면의 1/2/3/4는 기존처럼 `roomActivePlayer` 토글 대상을 따른다(무변경).
- 개인 효과(목숨/보석/변신/모아둔 돈→보석 전환 타이머)는 아이템을 쓴 그 플레이어에게만 적용된다.

### 16-2. 사망(dead) 상태 · 다음 방 진입 시 부활

- 플레이어 목숨이 0이 되면(장애물·몬스터 공격·§15-4 몸통 접촉 어느 경로든) `loseLife`/`resolveMonsterHit`가 그 플레이어에게 `p.dead = true`를 세팅한다 — 진행 중이던 차지 공격은 즉시 취소된다. 사망 중에는 이동(`updatePlayerMovement`)·차지 시작(`startCharge`)·아이템 사용(`useItem`)이 모두 막히고, `playerHitAt`이 사망자를 후보에서 제외해 모든 몬스터 공격·장애물·코인/자석 판정에서 공격 대상·피해 대상 양쪽 모두 제외된다. 화면에는 반투명 처리 + 머리 위 💀로 표시된다(`renderDeadPlayerMarker`).
- 2인 모드에서 한 명만 사망하면 게임오버 대신 그 한 명만 제외되고 **살아있는 플레이어는 전투를 계속**한다 — 두 명 모두 사망해야(§14-4) 게임오버.
- 부활은 **다음 방 화면 진입 시점**(`endFlightTurn()` → `reviveDeadPlayers()` → `switchScene("room")`)에 일어난다 — 같은 전투 안에서는 절대 자동 부활하지 않는다. 목숨을 회복시키는 기존 턴 시작 규칙이 없어 최대 목숨(`MAX_LIVES`=10)까지 채워 부활시킨다. 게임오버 재시작(`btn-restart`)도 별도로 사망 플래그를 초기화한다.

### 16-3. 2인 우편함 — P1 → P2 순차 처리

- 턴 종료(`endFlightTurn`) 시 2인 모드면 편지를 **P1용/P2용 각각 독립적으로** `pick(LETTERS)`해 `state.mailbox.letterId`/`letterId2`에 미리 담아 둔다(우연히 같은 편지가 나올 수는 있어도 한쪽 결과를 복사하지는 않는다).
- 우편함 클릭 시 `rt.mailQueue = [{playerIdx:1,...}, {playerIdx:2,...}]`를 만들고 `showNextQueuedMail()`이 큐를 하나씩 꺼내 보여준다 — **P1 모달 표시 → 적용 → 닫기 → 그다음에야 P2 모달 표시 → 적용 → 닫기** 순서가 강제되며 두 모달이 동시에 뜨는 일은 없다. 모달 제목에는 `[P1]`/`[P2]` 접두사가 붙는다.
- 개인 효과가 있는 편지는 `letter.apply()` 실행 전후로 `state.roomActivePlayer`를 그 편지의 대상 플레이어로 잠깐 바꿔치기해(`showMailLetter`) 기존 편지 로직(`activeWallet()` 참조)을 그대로 재사용한다 — 편지 함수 자체는 수정하지 않았다. 이미 공용 자원이던 효과(예: 다음 턴 보석 광산 보너스)는 기존처럼 공용으로 남는다.
- 1인 모드의 우편함은 기존과 완전히 동일하게 동작한다(큐 없이 편지 1통 즉시 표시).

### 16-4. 몬스터 몸통 접촉 피해

- 기존에는 몬스터의 "몸"에 그냥 닿아도 아무 피해가 없었다. `updateMonsterBodyContact(b)`가 매 프레임 각 배틀의 몬스터 위치와 살아있는 플레이어들의 거리를 재서, **장애물 충돌(§5-4)과 완전히 동일한 패턴**(무적 중이면 무시 → 맞으면 목숨 -0.5, 무적 1.0초 부여)으로 피해를 준다 — 무적 시간 동안은 계속 겹쳐 있어도 반복 피해가 없고, 무적이 풀리고도 여전히 닿아 있으면 다시 발동한다.
- 몸통박치기(§6-4, `b.dash`) 특수공격이 진행 중일 때는 그 공격 자체의 전용 충돌(`BODY_SLAM_HIT_RADIUS`)이 이미 판정하므로, 중복 피해를 막기 위해 몸통 접촉 판정은 배회/복귀 중에만 적용한다.
- 2인 모드에서는 실제로 닿은 플레이어만 개별적으로 판정되며(사망한 플레이어는 제외), 몬스터가 2마리(§14-3)여도 각 배틀이 독립적으로 검사한다. 이 경로로 목숨이 0이 되면 §15-2의 사망 규칙이 그대로 적용된다.

## 16. 파일 구성

- `index.html` — 화면 구조(방/상점/비행 씬 + 모달 전체)
- `style.css` — 전체 스타일
- `game.js` — 상태 관리, 씬 전환, 비행/전투 루프, 렌더링 전부 포함하는 단일 로직 파일
