"use strict";

/* =========================================================================
   전설의 날개 대모험 - game.js
   순수 JS + Canvas 로 구현한 비행 슈팅/러너 게임.
   ========================================================================= */

/* ---------------------------- 데이터 정의 ---------------------------- */

const WINGS = [
  { id: "basic",    name: "기본 날개",   emoji: "🕊️", desc: "기본 비행" },
  { id: "golden",   name: "황금 날개",   emoji: "✨", desc: "코인 획득량 2배" },
  { id: "cloud",    name: "구름 날개",   emoji: "☁️", desc: "구름 은신 시 몬스터 회피" },
  { id: "rainbow",  name: "무지개 날개", emoji: "🌈", desc: "전투 시 무지개 방패+칼" },
  { id: "sky",      name: "하늘 날개",   emoji: "🌤️", desc: "날씨 조종 (연출용)" },
  { id: "flame",    name: "불꽃 날개",   emoji: "🔥", desc: "전투 시 불꽃 칼 (공격력 +20%)" },
  { id: "water",    name: "물 날개",     emoji: "💧", desc: "전투 시 물 칼 (공격력+속도 소폭↑)" },
  { id: "electric", name: "전기 날개",   emoji: "⚡", desc: "전투 시 전기 칼 (공속↑, 10회마다 파워 50%↓ 10초)" },
];
const WING_MAP = Object.fromEntries(WINGS.map(w => [w.id, w]));

// ---------------------------- 스토리 캠페인(19장, GAME_DESIGN_BIBLE_v1.2 §14) ----------------------------
// wingId: 그 장이 진행되는 지역/배경 테마(assets/background/{wingId}_*, §Ch). 아직 새 날개를
// 얻지 않은 장은 직전까지 진행된 지역을 그대로 유지한다(예: 2~3장은 basic, 10~13장은 water).
// 16장 이후(빛의 목소리 정체 공개~엔딩)는 별도 지역 "final"(assets/background/final_*)을 쓴다.
// img: story/ 폴더의 완성된 8컷 만화(Visual Canon). "계속하기" 버튼과 함께 챕터 진입 시 표시된다.
// 1챕터 = 비행 1턴을 기본값으로 임시 매핑했다(Bible §21 TBD 항목 - 장당 실제 턴 수는 추후 조정 대상).
// playable: false인 챕터는 자체 비행 턴이 없는 "순수 스토리" 챕터다(사용자 확정, §7) - 컷신만
// 자동으로 연속 재생되고 게임이 끼어들지 않는다: 2·3장(첫 전투는 만화로만 표현·빛의 목소리 소개),
// 12·13장(날개지기 보스전 이후 과거 폭로), 15~17장(전기 날개 획득 이후 정황 설명).
// 14장은 재생 가능(전기 수호자 전투)이지만 comicTiming:"after"라 컷신이 전투 "앞"이 아니라
// "뒤"에 뜬다(사용자 확정, §신규-날개7): 13장 컷신 → [컷신 없이 곧장 전기 수호자 전투] → 방 복귀
// (조용히 대기) → 다음 "비행 출발" 클릭 시 14→15→16→17장 컷신이 한 번에 이어서 재생된 뒤 18장
// 진입 대기 상태로 정착. pendingDeferredComic가 "아직 못 보여준 14장 컷신"을 들고 있다가
// 그 클릭 시점에 열어준다.
const CHAPTERS = [
  { n: 1,  title: "깨진 봉인",             wingId: "basic",    img: "story/chapter-01-broken-seal-v3.png" },
  { n: 2,  title: "첫 번째 전투",          wingId: "basic",    img: "story/chapter-02-first-wing.png", playable: false },
  { n: 3,  title: "빛의 목소리",           wingId: "basic",    img: "story/chapter-03-voice-of-light.png", playable: false },
  { n: 4,  title: "구름 날개",             wingId: "cloud",    img: "story/chapter-04-cloud-wings-v5.png" },
  { n: 5,  title: "황금 날개",             wingId: "golden",   img: "story/chapter-05-golden-wings.png" },
  { n: 6,  title: "무지개 날개",           wingId: "rainbow",  img: "story/chapter-06-rainbow-wings.png" },
  { n: 7,  title: "하늘 날개",             wingId: "sky",      img: "story/chapter-07-sky-wings.png" },
  { n: 8,  title: "불꽃 날개",             wingId: "flame",    img: "story/chapter-08-flame-wings-v3.png" },
  { n: 9,  title: "일곱 번째 날개",        wingId: "water",    img: "story/chapter-09-seventh-wing-v2.png" },
  { n: 10, title: "날개지기의 경고",       wingId: "water",    img: "story/chapter-10-wingkeepers-warning-v3.png" },
  { n: 11, title: "날개지기 보스전",       wingId: "water",    img: "story/chapter-11-wingkeeper-boss-battle-remake-v2.png", boss: "wing_guardian" },
  { n: 12, title: "숨겨졌던 과거",         wingId: "water",    img: "story/chapter-12-hidden-past-remake.png", playable: false },
  { n: 13, title: "누구를 믿을 것인가",    wingId: "water",    img: "story/chapter-13-whom-to-trust-v3.png", playable: false },
  // 14장: 13장 컷신 직후 곧바로 전기 수호자 전투로 이어진다(컷신 없이, 사용자 확정 §신규-날개7) -
  // comicTiming:"after"는 이 챕터의 컷신을 전투 "전"이 아니라 "후"(15~17장과 묶어서, 다음
  // "비행 출발" 클릭 시)에 보여주라는 뜻. pendingDeferredComic이 실제 지연 처리를 담당한다.
  { n: 14, title: "마지막 봉인지",         wingId: "electric", img: "story/chapter-14-final-seal.png", comicTiming: "after" },
  { n: 15, title: "전설의 날개 8/8",       wingId: "electric", img: "story/chapter-15-legendary-wings-8-of-8-v2.png", playable: false },
  { n: 16, title: "빛의 목소리의 정체",    wingId: "final",    img: "story/chapter-16-identity-of-the-light-v2.png", playable: false },
  { n: 17, title: "통제된 평화",           wingId: "final",    img: "story/chapter-17-controlled-peace.png", playable: false },
  { n: 18, title: "여덟 날개의 전투",      wingId: "final",    img: "story/chapter-18-battle-of-eight-wings-v4.png", boss: "angel" },
  { n: 19, title: "모두에게 날개를",       wingId: "final",    img: "story/chapter-19-wings-for-everyone.png" },
];
const CHAPTER_COUNT = CHAPTERS.length;
function chapterData(n) { return CHAPTERS[clamp(n, 1, CHAPTER_COUNT) - 1]; }
// 현재 챕터가 진행되는 지역(=배경/장애물/지역 수호자 선택 기준). state.chapter가 아직 없는
// 저장 데이터(구버전 세이브)는 1장으로 취급한다.
function currentRegionWingId() { return chapterData(state.chapter || 1).wingId; }

// 캐릭터+날개 원본 일러스트(assets/sprites)에서 추출한 앵커 좌표.
// ax/ay = 캐릭터 몸통(가슴) 기준점의 이미지 내 상대 위치(0~1). 렌더링 시 이 점을 플레이어 좌표에 맞춘다.
const WING_ANCHOR = {
  basic:    { ax: 0.6122, ay: 0.6521 },
  golden:   { ax: 0.6449, ay: 0.6684 },
  cloud:    { ax: 0.6210, ay: 0.6401 },
  rainbow:  { ax: 0.5754, ay: 0.6674 },
  sky:      { ax: 0.6373, ay: 0.6359 },
  flame:    { ax: 0.6584, ay: 0.6316 },
  water:    { ax: 0.6270, ay: 0.6705 },
  electric: { ax: 0.5954, ay: 0.6300 },
};
// 주인공2/3 앵커(scripts/extract_new_characters.py 실행 결과, assets/sprites/char{2,3}/anchors.json 참조).
const WING_ANCHOR2 = {
  basic:    { ax: 0.6075, ay: 0.5321 },
  golden:   { ax: 0.6367, ay: 0.5385 },
  cloud:    { ax: 0.6032, ay: 0.5342 },
  rainbow:  { ax: 0.5866, ay: 0.5477 },
  sky:      { ax: 0.6124, ay: 0.5431 },
  flame:    { ax: 0.6442, ay: 0.5457 },
  water:    { ax: 0.6067, ay: 0.5443 },
  electric: { ax: 0.6228, ay: 0.5488 },
};
// 2026-09 디자인 갱신(아기 캐릭터 변경, design/캐릭터 및 날개 디자인_주인공3_흰배경.png 재추출)으로
// 좌표 재계산됨 - assets/sprites/char3/anchors.json 참고(scripts/extract_new_characters.py).
const WING_ANCHOR3 = {
  basic:    { ax: 0.5899, ay: 0.6321 },
  golden:   { ax: 0.5959, ay: 0.6418 },
  cloud:    { ax: 0.587,  ay: 0.6419 },
  rainbow:  { ax: 0.5802, ay: 0.6272 },
  sky:      { ax: 0.5975, ay: 0.6387 },
  flame:    { ax: 0.611,  ay: 0.6309 },
  water:    { ax: 0.5958, ay: 0.6244 },
  electric: { ax: 0.58,   ay: 0.6172 },
};

// 주인공 3종. hero1은 기존 플랫 에셋 경로를 그대로 쓰고(spriteDir:null), hero2/3는 새로
// 추출한 캐릭터별 하위 폴더를 쓴다(§1). 이 배열/경로 함수 하나로 캐릭터 선택 UI와 스프라이트
// 프리로드가 모두 동일하게 동작한다.
const CHARACTERS = [
  { id: "hero1", name: "주인공1", spriteDir: null, anchors: WING_ANCHOR, card: "assets/sprites/basic.png" },
  { id: "hero2", name: "주인공2", spriteDir: "char2", anchors: WING_ANCHOR2, card: "assets/sprites/char2/basic.png" },
  { id: "hero3", name: "주인공3", spriteDir: "char3", anchors: WING_ANCHOR3, card: "assets/sprites/char3/basic.png" },
];
const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

function charSpritePath(charId, wingId) {
  const c = CHARACTER_MAP[charId] || CHARACTERS[0];
  return c.spriteDir ? `assets/sprites/${c.spriteDir}/${wingId}.png` : `assets/sprites/${wingId}.png`;
}
function charChargeSpritePath(charId, wingId, stage) {
  const c = CHARACTER_MAP[charId] || CHARACTERS[0];
  return c.spriteDir ? `assets/effects/charge/${c.id}/${wingId}_${stage}.png` : `assets/effects/charge/${wingId}_${stage}.png`;
}
function charWingAnchor(charId, wingId) {
  const c = CHARACTER_MAP[charId] || CHARACTERS[0];
  return (c.anchors && c.anchors[wingId]) || { ax: 0.6, ay: 0.65 };
}

// 게임플레이용(배경 제거된) 캐릭터 스프라이트 프리로드: WING_SPRITE[charId][wingId].
const WING_SPRITE = {};
CHARACTERS.forEach(c => {
  WING_SPRITE[c.id] = {};
  WINGS.forEach(w => {
    const img = new Image();
    img.src = charSpritePath(c.id, w.id);
    WING_SPRITE[c.id][w.id] = img;
  });
});
function spriteReady(charId, wingId) {
  const img = WING_SPRITE[charId] && WING_SPRITE[charId][wingId];
  return img && img.complete && img.naturalWidth > 0;
}

// 전투 차지 공격(검기) 이펙트 프리로드 - 캐릭터x날개별 약공격/완충 2단계(assets/effects/charge, §6-1-1)
const CHARGE_SPRITE = {};
CHARACTERS.forEach(c => {
  CHARGE_SPRITE[c.id] = {};
  WINGS.forEach(w => {
    const weak = new Image(); weak.src = charChargeSpritePath(c.id, w.id, "weak");
    const full = new Image(); full.src = charChargeSpritePath(c.id, w.id, "full");
    CHARGE_SPRITE[c.id][w.id] = { weak, full };
  });
});
function chargeSpriteReady(charId, wing, stage) {
  const img = CHARGE_SPRITE[charId] && CHARGE_SPRITE[charId][wing] && CHARGE_SPRITE[charId][wing][stage];
  return img && img.complete && img.naturalWidth > 0;
}

// 코인/돈/보석 아이콘도 일러스트에서 추출한 이미지를 사용 (비행 캔버스용)
const ICON_SPRITE = {};
["coin", "money", "gem"].forEach(name => {
  const img = new Image();
  img.src = `assets/icons/${name}.png`;
  ICON_SPRITE[name] = img;
});
function iconReady(name) {
  const img = ICON_SPRITE[name];
  return img && img.complete && img.naturalWidth > 0;
}

// 지역별 비행 배경 패럴랙스 3레이어(assets/background/{regionId}_{far,mid,near}.png, §Ch).
// 8개 날개 지역 + 16장 이후의 "final" 지역(엔딩/최종보스 구간)까지 총 9개 세트.
// 레이어별로 없는 파일도 있다(예: flame/water는 near 레이어가 없음) - bgImgReady()로
// 매 프레임 로드 여부만 확인하고, 준비 안 된 레이어는 그냥 건너뛴다(다른 자산과 동일한 패턴).
const BACKGROUND_REGIONS = [...WINGS.map(w => w.id), "final"];
const BACKGROUND_SPRITE = {};
BACKGROUND_REGIONS.forEach(id => {
  BACKGROUND_SPRITE[id] = {};
  ["far", "mid", "near"].forEach(layer => {
    const img = new Image();
    img.src = `assets/background/${id}_${layer}.png`;
    BACKGROUND_SPRITE[id][layer] = img;
  });
});
function bgImgReady(img) { return img && img.complete && img.naturalWidth > 0; }

// 장애물 = 지역(날개)당 10종(assets/obstacles/{wingId}/{0..9}.png, GAME_DESIGN_BIBLE_v1.2 반영,
// 2026-09 - 원본 시트(obstacle_{wingId}.png, 5열x2행)를 scripts/extract_obstacles_regions.py로
// 잘라낸 결과). 구 6테마×소/중/대 180장 체계는 폐기 - 19장 캠페인 진행 자체가 난이도 곡선을
// 담당하므로 크기 변형이 더 이상 필요 없다(§Ch). 히트박스는 지역과 무관하게 고정 반지름 하나.
const OBSTACLE_RADIUS = 46; // 크기 상향(사용자 확정, §신규-크기)
const OBSTACLE_SPEED_MUL = 0.65; // 장애물 접근 속도 하향(사용자 확정, §신규-날개5)
const OBSTACLE_ICONS_PER_REGION = 10;
const OBSTACLE_SPRITE = {};
WINGS.forEach(w => {
  OBSTACLE_SPRITE[w.id] = [];
  for (let i = 0; i < OBSTACLE_ICONS_PER_REGION; i++) {
    const img = new Image();
    img.src = `assets/obstacles/${w.id}/${i}.png`;
    OBSTACLE_SPRITE[w.id].push(img);
  }
});
// "final" 지역(16~19장)은 전용 장애물 이미지가 없어 basic 이미지로 대체한다.
function regionObstacleArr() {
  return OBSTACLE_SPRITE[currentRegionWingId()] || OBSTACLE_SPRITE.basic;
}

// 지역 이동 방해 엔티티(assets/effects/asset_effect/{regionId}_asset.png) - cloud/water/electric
// 3개 지역 전용. 몬스터 공격이 아니라 비행 중 맵에 랜덤 등장하는 필드 장애물로, 배경에 합성하지
// 않고 다른 비행 엔티티(코인/돈/장애물)와 동일하게 rt.entities에 스크롤되는 독립 개체로 다룬다.
// 장애물처럼 부딪혀서 사라지지 않고, 반경 안에 있는 동안 데미지 없이 이동속도만 늦추다가
// 화면 밖으로 스크롤되면 사라진다(§8).
const HAZARD_REGIONS = ["cloud", "water", "electric"];
const HAZARD_SPRITE = {};
HAZARD_REGIONS.forEach(id => {
  const img = new Image();
  img.src = `assets/effects/asset_effect/${id}_asset.png`;
  HAZARD_SPRITE[id] = img;
});
const HAZARD_RADIUS = 85;
const HAZARD_SPEED_MUL = 0.45;
const HAZARD_SPAWN_MIN = 5, HAZARD_SPAWN_MAX = 9;
function hazardImgReady() {
  const img = HAZARD_SPRITE[currentRegionWingId()];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// 몬스터 = 지역(날개) 수호자 7종(GAME_DESIGN_BIBLE_v1.2 반영, 2026-09).
// 구 40종 랜덤 로스터는 폐기: 지역마다 elite_{wingId}.png 1종이 "그 지역의 유일한 전투 상대"다.
// id를 wingId와 동일하게 둬서 currentRegionMonster()가 MONSTER_MAP[currentRegionWingId()]로
// 바로 조회할 수 있게 한다. basic 지역은 항목이 없다 = 그 지역은 턴 종료 전투 자체가 없다(§Ch).
// tier는 기존처럼 projectile/thrown/minion 이펙트의 세기(_1~_5) 선택에만 쓰이며, 챕터
// 진행 순서(구름→황금→무지개→하늘→불꽃→물→전기)를 따라 점진적으로 올렸다.
const MONSTERS = [
  { id: "cloud",    name: "구름 수호자",       sprite: "assets/elite/elite_cloud.png",    pattern: "circle", tier: 1 },
  { id: "golden",   name: "황금 유적 수호자",   sprite: "assets/elite/elite_golden.png",   pattern: "pace",   tier: 2 },
  { id: "rainbow",  name: "무지개 수호자",      sprite: "assets/elite/elite_rainbow.png",  pattern: "hover",  tier: 2 },
  { id: "sky",      name: "하늘 도시 수호자",   sprite: "assets/elite/elite_sky.png",      pattern: "pace",   tier: 3 },
  { id: "flame",    name: "화산 수호자",        sprite: "assets/elite/elite_flame.png",    pattern: "bounce", tier: 3 },
  { id: "water",    name: "심해 수호자",        sprite: "assets/elite/elite_water.png",    pattern: "circle", tier: 4 },
  { id: "electric", name: "번개 폭풍 수호자",   sprite: "assets/elite/elite_electric.png", pattern: "zigzag", tier: 5 },
];
const MONSTER_MAP = Object.fromEntries(MONSTERS.map(m => [m.id, m]));

// ---------------------------- 보스전(11장 날개지기 / 18장 천사, §P2) ----------------------------
// 승리 조건은 일반 지역 수호자와 동일하게 HP 0(사용자 확정) - 별도 처치 연출 없이 기존
// applyChargeProjectileHit()의 보상/정산 흐름을 그대로 재사용한다. 스토리상 정화/분리 연출은
// 스토리 만화가 담당하므로 게임 쪽엔 승리 조건 로직을 더 만들지 않는다.
const BOSSES = {
  // 날개지기: "진짜 악당이 아님, 공격보다 회피/방어 중심"(Bible §16) - 빠른 이동 + 주기적
  // 무적 배리어로 방어적인 인상을 주고, 공격은 배리어를 지면에 깔거나(zone) 직접 쏘는(projectile)
  // 두 방식을 번갈아 쓴다(사용자 확정).
  wing_guardian: {
    id: "wing_guardian", name: "날개지기", sprite: "assets/elite/boss_wing_guardian.png",
    battleHeight: 380, hpMul: 3, pattern: "zigzag", speedMul: 1.6, // 크기 2배(사용자 확정). 전체 속도 하향 이후에도 일반 수호자보다는 빠르게 유지
    attackKind: "wingkeeper_barrier",
    shieldOnDur: 4, shieldOffDur: 3.5, // 배리어 활성/비활성 주기(초)
  },
  // 천사: 8개 날개 능력을 순차 페이즈로 사용(Bible §16, 18장 콘티 순서 - 구름→황금→
  // 무지개/하늘→불꽃/물→전기). 새 애니메이션을 만들지 않고 기존 지역 수호자 공격에 쓰던
  // 이펙트 자산·패턴을 그대로 재사용해 페이즈마다 특수 공격이 바뀌게 한다.
  angel: {
    id: "angel", name: "천사", sprite: "assets/elite/boss_angel_full.png",
    battleHeight: 460, hpMul: 5, pattern: "circle", speedMul: 1.0, // 크기 2배(사용자 확정)
    phaseAttackKinds: ["slowfield", "obstaclePattern", "feint", "obstacleSummon", "projectile", "projectile"],
    phaseImgPaths: [
      "assets/effects/zone/wind_vortex.png",       // 구름
      "assets/effects/thrown/sandstorm_5.png",     // 황금
      null,                                         // 무지개/하늘 - feint는 이미지 불필요
      "assets/effects/thrown/lava_chunk_5.png",    // 불꽃
      "assets/effects/projectile/water_breath_5.png",  // 물
      "assets/effects/projectile/lightning_bolt_5.png", // 전기
    ],
  },
};
const BOSS_SPRITE = {};
Object.keys(BOSSES).forEach(id => {
  const img = new Image();
  img.src = BOSSES[id].sprite;
  BOSS_SPRITE[id] = img;
});
// 날개지기 전용 "배리어" 공격(§P2, 기존 8종 몬스터 공격에 없는 신규 조합) 이미지.
// 전용 자산이 없어 기존 이펙트 중 마법진/화살 느낌이 가장 가까운 것을 재사용한다.
const BOSS_BARRIER_ZONE_PATH = "assets/effects/zone/wind_vortex.png";
const BOSS_BARRIER_PROJECTILE_PATH = "assets/effects/projectile/arrow_5.png";

const MONSTER_SPRITE = {};
MONSTERS.forEach(m => {
  const img = new Image();
  img.src = m.sprite;
  MONSTER_SPRITE[m.id] = img;
});
function monsterSpriteReady(id) {
  const img = MONSTER_SPRITE[id];
  return img && img.complete && img.naturalWidth > 0;
}

// 지역(챕터) 진행에 따라 그 지역 수호자 1종을 그대로 반환한다(§Ch, currentRegionWingId 참조).
// basic 지역은 MONSTER_MAP에 항목이 없으므로 null을 반환 - 호출부(startTurnEndBattle
// 진입 여부를 가르는 turnTimer<=0 분기)가 이 경우 전투 자체를 건너뛴다.
function currentRegionMonster() {
  return MONSTER_MAP[currentRegionWingId()] || null;
}

// 지역 수호자별 전투 이펙트 자산(assets/effects/, §6-1 참조) 매핑 - id가 곧 wingId다.
// category는 이펙트 연출 종류(projectile/thrown/minion/zone)를 가리키며, MONSTERS의
// pattern(배회 움직임)과는 별개 개념이다. projectile/thrown/minion은 5단계 세기별
// 이미지(_1~_5)가 있어 그 수호자의 tier(MONSTERS 배열 값)를 그대로 세기로 재사용한다.
// zone은 세기 단계가 없는 고정 이미지 1장만 존재한다.
// 여기 없는 지역(rainbow, sky)은 이펙트 자산이 없다는 뜻 - monsterAttackKind()가 대신
// MONSTERS.pattern(배회 방식)만으로 페인트/몸통박치기를 가른다.
const EFFECT_ASSETS = {
  cloud:    { category: "zone",       typeSlug: "wind_vortex" },   // 바람 소용돌이 → 슬로우필드
  golden:   { category: "thrown",     typeSlug: "sandstorm" },     // 사막 유적 모래폭풍 → 장애물패턴
  sky:      { category: "thrown",     typeSlug: "boulder" },       // 공중 도시 파편 투척 → 장애물소환
  flame:    { category: "thrown",     typeSlug: "lava_chunk" },    // 화산 용암 덩이 → 장애물소환
  water:    { category: "projectile", typeSlug: "water_breath" }, // 물줄기 투사체
  electric: { category: "projectile", typeSlug: "lightning_bolt" }, // 번개 투사체
  // rainbow: 매핑 없음 → pattern("hover") 기준 feint(페인트)로 자동 분류
};

// monsterId(+선택적으로 세기로 쓸 tier, 기본값은 그 몬스터 자신의 MONSTERS.tier)를
// assets/effects/ 아래 실제 이미지 경로로 변환한다. 매핑이 없는 몬스터는 null.
function effectAssetPath(monsterId, tier) {
  const cfg = EFFECT_ASSETS[monsterId];
  if (!cfg) return null;
  if (cfg.category === "zone") return `assets/effects/zone/${cfg.typeSlug}.png`;
  const fallbackTier = MONSTER_MAP[monsterId] ? MONSTER_MAP[monsterId].tier : 1;
  const t = Math.max(1, Math.min(5, tier || fallbackTier));
  return `assets/effects/${cfg.category}/${cfg.typeSlug}_${t}.png`;
}

// EFFECT_ASSETS(+매핑이 없는 몬스터는 MONSTERS의 배회 pattern)를 실제 전투 공격
// 패턴 8종으로 분류한다(§6-3).
// - projectile/minion은 category 그대로.
// - thrown은 typeSlug로 한 번 더 나눈다: "모래폭풍"(sandstorm, sand_worm)은 흩뿌리는
//   느낌이 강해 장애물패턴(확산 스폰)으로, 나머지 4종(가시/돌덩이/빙편/용암)은 낱개
//   투척인 장애물소환으로 처리한다.
// - zone도 typeSlug로 나눈다: extract_effects.py의 ZONE_TYPES 중 "지속형" 2종
//   (sticky_puddle=sticky_blob, wind_vortex=wind_sprite)만 슬로우필드, 나머지 7종
//   ("장판형")은 기존처럼 1초 뒤 데미지를 주는 zone.
// - EFFECT_ASSETS에 없는 몬스터는 MONSTERS.pattern(배회 방식)을 기준으로 다시 나눈다:
//   hover/zigzag(유령·박쥐·늑대류 등 변칙적으로 움직이는 유형)는 페인트, 나머지
//   (pace/bounce/circle)는 몸통박치기 — pattern 필드가 여기서 처음으로 공격 종류
//   선택에 직접 쓰인다.
function monsterAttackKind(monsterId) {
  const cfg = EFFECT_ASSETS[monsterId];
  if (cfg) {
    if (cfg.category === "projectile") return "projectile";
    if (cfg.category === "minion") return "minion";
    if (cfg.category === "thrown") return cfg.typeSlug === "sandstorm" ? "obstaclePattern" : "obstacleSummon";
    if (cfg.category === "zone") {
      return (cfg.typeSlug === "sticky_puddle" || cfg.typeSlug === "wind_vortex") ? "slowfield" : "zone";
    }
  }
  const wanderPattern = MONSTER_MAP[monsterId] ? MONSTER_MAP[monsterId].pattern : "pace";
  return (wanderPattern === "hover" || wanderPattern === "zigzag") ? "feint" : "charge";
}

// effectAssetPath()가 반환하는 경로는 몬스터/티어 조합마다 달라 WING_SPRITE처럼 전부
// 미리 만들어두기보다, 실제로 필요해지는 시점에 하나씩 생성해 캐싱한다(지연 로딩).
const EFFECT_IMG_CACHE = {};
function getEffectImage(path) {
  if (!path) return null;
  let img = EFFECT_IMG_CACHE[path];
  if (!img) {
    img = new Image();
    img.src = path;
    EFFECT_IMG_CACHE[path] = img;
  }
  return img;
}
function effectImageReady(path) {
  const img = EFFECT_IMG_CACHE[path];
  return img && img.complete && img.naturalWidth > 0;
}

const ITEMS = [
  { id: "peach",  name: "복이 온다 복숭아",       emoji: "🍑", desc: "목숨 +1" },
  { id: "gem",    name: "반짝반짝 보석",          emoji: "💎", icon: "assets/icons/gem.png", desc: "보유 보석 +1" },
  { id: "monkey", name: "원숭이는 바나나를 좋아해", emoji: "🐒", desc: "60초 동안 미보유 날개로 임시 변신" },
  { id: "chair",  name: "마사지 의자",            emoji: "💺", desc: "10초 동안 획득하는 돈이 보석으로 대신 지급됨" },
];
// 비행 중 2P 모드 전용 아이템 단축키(ITEMS 인덱스와 동일 순서). 이동키 손 위치에 맞춰
// 1P(화살표+P, 오른손)는 오른쪽의 7/8/9/0, 2P(RFDG+Q, 왼손)는 왼쪽의 1/2/3/4를 쓴다.
// 1인 모드/방·상점 화면은 기존 그대로 1/2/3/4(ITEM_KEYS_SOLO, 무변경).
const ITEM_KEYS_SOLO = ["1", "2", "3", "4"];
const ITEM_KEYS_2P_P1 = ["7", "8", "9", "0"];
const ITEM_KEYS_2P_P2 = ["1", "2", "3", "4"];
const DIGIT_TO_ITEM_INDEX_P1 = { Digit7: 0, Digit8: 1, Digit9: 2, Digit0: 3 };
const SAVE_KEY = "wingsAdventureSave_v1";

// ---------------------------- 임시 QA 테스트 모드(§신규-날개2, 사용자 요청) ----------------------------
// 날개 획득 방식 변경(트로피->지역 수호자 처치) 검증을 빠르게 반복하기 위한 임시 장치.
// true인 동안 플레이어는 목숨이 전혀 줄지 않는다(장애물/몬스터 공격 모두 무효, loseLife/
// resolveMonsterHit 맨 앞에서 막음). 검증이 끝나면 false로 되돌리거나 이 플래그 및
// index.html/style.css의 관련 버튼 3개(.debug-btn)를 함께 제거할 것.
const DEBUG_MODE = true;

// 우편 편지 목록. apply()는 편지를 읽는 즉시 실행된다.
const LETTERS = [
  {
    id: "monster_ate_gem",
    text: "집을 나간 사이, 몬스터가 들어와서 보석을 먹었습니다.",
    effectText: "보석 1개 감소",
    apply: () => { const w = activeWallet(); w.gems = Math.max(0, w.gems - 1); },
  },
  {
    id: "gembox_warning",
    text: "보석 하나가 곧 없어질 것입니다. 어서 보석 상자 안으로 숨으세요!",
    eventText: "방으로 돌아가면 5초 안에 보석함에 숨어야 합니다. 숨지 못하면 몬스터에게 목숨 0.5를 잃습니다.",
    apply: () => { state.mailFlags.gemboxDangerQueued = true; },
  },
  {
    id: "gem_mine",
    text: "몬스터가 오늘 보석 광산에 갔다고 합니다.",
    effectText: "다음 비행에서 몬스터를 처치하면 보석 1개 추가 획득",
    apply: () => { state.mailFlags.nextTurnGemBonus = true; },
  },
  {
    id: "heatwave",
    text: "오늘부터 무더위가 시작됩니다. 전기세 인상",
    effectText: "돈 1개 감소",
    apply: () => { const w = activeWallet(); w.money = Math.max(0, w.money - 1); },
  },
  {
    id: "snack",
    text: "당신이 주문한 과자가 왔어요",
    effectText: "돈 1개 감소, 목숨 0.5 증가",
    apply: () => {
      const w = activeWallet();
      w.money = Math.max(0, w.money - 1);
      w.lives = clamp(+(w.lives + 0.5).toFixed(1), 0, MAX_LIVES);
    },
  },
];
const LETTER_MAP = Object.fromEntries(LETTERS.map(l => [l.id, l]));

/* ---------------------------- 상태(State) ---------------------------- */

const START_LIVES = 3; // 최초 시작(및 게임오버 재시작) 시 목숨
const MAX_LIVES = 10;  // 아이템 등으로 늘릴 수 있는 목숨 최대치

// 2인 플레이 기본 조작키(§4). 1인 플레이는 기존 그대로 마우스+공격키 1개(soloAttackKey)만 쓴다.
const DEFAULT_SOLO_ATTACK_KEY = "Space";
const DEFAULT_P1_KEYS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", attack: "KeyP" };
const DEFAULT_P2_KEYS = { up: "KeyR", down: "KeyF", left: "KeyD", right: "KeyG", attack: "KeyQ" };
const KEY_LABEL = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "Space",
  KeyP: "P", KeyQ: "Q", KeyR: "R", KeyF: "F", KeyD: "D", KeyG: "G",
};
function keyLabel(code) {
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  if (code && code.startsWith("Key")) return code.slice(3);
  if (code && code.startsWith("Digit")) return code.slice(5);
  return code || "?";
}

function defaultInventory() { return { peach: 0, gem: 0, monkey: 0, chair: 0 }; }
// 플레이어별로 완전히 분리되는 자원: 목숨/보석/코인/돈 4종(지갑, §6) + 아이템 인벤토리(§신규-1).
function defaultPlayerWallet() {
  return { lives: START_LIVES, gems: 2, coins: 2, money: 2 };
}

function defaultState() {
  return {
    hasStartedBefore: false,
    hasChosenPlayerCount: false, // 최초 인원수/캐릭터 선택 플로우 게이팅
    playerCount: 1,
    chapter: 1,              // 현재 진행 중인 스토리 챕터(1~19, §Ch)
    chapterImageShown: false, // 이번 챕터의 스토리 컷신을 이미 봤는지(방 진입 시 1회만 표시)
    pendingDeferredComic: null, // comicTiming:"after"인 챕터의 컷신 번호(다음 "비행 출발" 클릭까지 대기, §신규-날개7)
    money: 2,
    coins: 2,
    gems: 2,
    lives: START_LIVES,
    trophies: 0,          // 다음 날개까지 진행도 (0~9, 1P/2P 공용 - §Context)
    totalTrophies: 0,      // 누적 트로피 (전시용, 공용)
    fridgeDrinks: 3,
    ownedWings: ["basic"], // 날개 보유는 공용 풀(§Context)
    equippedWing: "basic", // 1인 플레이 전용(기존 그대로)
    inventory: defaultInventory(), // 1인 플레이 전용(기존 그대로)
    turnsCompleted: 0,
    coinMilestone: 0,      // 1인 플레이 전용 - 마지막으로 아이템을 지급한 코인 10단위 값
    mailbox: { hasLetter: false, letterId: null, letterId2: null }, // letterId2는 2P 전용(§신규-4)
    mailFlags: { nextTurnGemBonus: false, gemboxDangerQueued: false },

    // ---- 2인 협동 플레이(§신규) ----
    p1CharacterId: "hero1", p2CharacterId: "hero1",
    p1CharacterNextTurn: "hero1", p2CharacterNextTurn: "hero1",
    p1EquippedWing: "basic", p2EquippedWing: "basic",
    soloAttackKey: DEFAULT_SOLO_ATTACK_KEY,
    p1Keys: { ...DEFAULT_P1_KEYS }, p2Keys: { ...DEFAULT_P2_KEYS },
    roomActivePlayer: 1, // 2P 모드에서 방/상점(냉장고/우편함/교환/아이템)이 적용될 대상
    p1Wallet: defaultPlayerWallet(), p2Wallet: defaultPlayerWallet(),
    p1Inventory: defaultInventory(), p2Inventory: defaultInventory(), // 2P 전용 개별 인벤토리(§신규-1)
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    }
  } catch (e) { /* ignore corrupt save */ }
  return defaultState();
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

/* ---------------------------- 유틸리티 ---------------------------- */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

const MODAL_IDS = [
  "modal-drink", "modal-wingselect", "modal-monkey", "modal-weather",
  "modal-gameover", "modal-mail", "modal-hide", "modal-settlement",
  "modal-playercount", "modal-charselect", "modal-keybind", "modal-story",
];
function isAnyModalOpen() {
  return MODAL_IDS.some(id => !document.getElementById(id).classList.contains("hidden"));
}

/* ---------------------------- 화면 전환 ---------------------------- */

const scenes = {
  room: document.getElementById("scene-room"),
  shop: document.getElementById("scene-shop"),
  flight: document.getElementById("scene-flight"),
};

let currentScene = "room";

function switchScene(name) {
  currentScene = name;
  for (const key in scenes) scenes[key].classList.toggle("hidden", key !== name);
  if (name === "room") {
    fitStage("room");
    renderRoom();
    settleRoomEntry();
  }
  if (name === "shop") { fitStage("shop"); renderShop(); }
  if (name === "flight") { /* handled by startFlight() */ }
}

/* ---------------------------- 스토리 챕터 인트로(§Ch, §신규-날개3/6) ---------------------------- */
// "재생 불가"(순수 스토리) 챕터는 자체 비행 턴이 없다 - 컷신만 연속으로 보여주고 자동으로 다음
// 챕터로 넘어간다(CHAPTERS[].playable===false, 사용자 확정: 2·3장/12·13장/14·16·17장 묶음).
// "재생 가능" 챕터의 컷신은 더 이상 방 진입 시 자동으로 뜨지 않는다 - "비행 출발" 버튼을 누른
// 순간에만 보여주고(§3), 닫으면 바로 그 턴의 비행이 시작된다(pendingFlightStart).
function isPlayableChapter(n) {
  return chapterData(n).playable !== false;
}
let pendingFlightStart = false;
let showingDeferredComic = null; // 지금 열려 있는 게 지연된(comicTiming:"after") 컷신이면 그 장 번호

// 방 진입/온보딩 완료/챕터 전환마다 호출: 재생 불가 챕터가 남아 있으면 컷신을 이어서 자동
// 재생하고, 재생 가능한 챕터에 도달하면(또는 이미 다 봤으면) 평소 방 상태로 정착한다.
// 지연된 컷신(pendingDeferredComic)이 있으면 여기서는 아무 것도 하지 않는다 - "비행 출발"을
// 눌러야만 열린다(§신규-날개7, 아래 btn-start-flight 참고).
function settleRoomEntry() {
  if (!state.hasChosenPlayerCount || !state.hasStartedBefore) return;
  if (state.pendingDeferredComic) return;
  if (!isPlayableChapter(state.chapter) && !state.chapterImageShown) {
    pendingFlightStart = false;
    openChapterIntro();
    return;
  }
  if (state.mailFlags.gemboxDangerQueued) {
    state.mailFlags.gemboxDangerQueued = false;
    saveState();
    startGemboxDanger();
  }
}
function openChapterIntro() {
  const ch = chapterData(state.chapter);
  document.getElementById("story-title").textContent = `${ch.n}장. ${ch.title}`;
  document.getElementById("story-img").src = ch.img;
  document.getElementById("modal-story").classList.remove("hidden");
}
// pendingDeferredComic으로 미뤄둔 컷신을 연다(§신규-날개7) - state.chapter가 아니라 그 챕터
// 번호(n)를 직접 받는다: 이미 전투가 끝나 현재 챕터는 그 다음(예: 15)으로 넘어가 있기 때문.
function openDeferredComic(n) {
  showingDeferredComic = n;
  const ch = chapterData(n);
  document.getElementById("story-title").textContent = `${ch.n}장. ${ch.title}`;
  document.getElementById("story-img").src = ch.img;
  document.getElementById("modal-story").classList.remove("hidden");
}
document.getElementById("btn-story-continue").addEventListener("click", () => {
  document.getElementById("modal-story").classList.add("hidden");
  if (showingDeferredComic != null) {
    // 지연됐던 컷신을 닫았다 - 원래 그 챕터가 재생 불가였다면(§신규-날개7 그룹의 15~17장처럼)
    // settleRoomEntry()가 기존 묶어보기 로직으로 자연스럽게 이어서 보여준다.
    showingDeferredComic = null;
    state.pendingDeferredComic = null;
    saveState();
    settleRoomEntry();
    return;
  }
  const wasPlayable = isPlayableChapter(state.chapter);
  state.chapterImageShown = true;
  saveState();
  if (!wasPlayable) {
    // 재생 불가 챕터의 컷신을 봤다 = 바로 다음 챕터로 넘어가 이어본다(§7 묶어보기).
    advanceChapter();
    saveState();
    settleRoomEntry();
    return;
  }
  // 재생 가능한 챕터의 컷신은 "비행 출발" 클릭으로만 열린다(§3) - 닫히면 바로 비행 시작.
  if (pendingFlightStart) {
    pendingFlightStart = false;
    startFlight();
  } else if (state.mailFlags.gemboxDangerQueued) {
    state.mailFlags.gemboxDangerQueued = false;
    saveState();
    startGemboxDanger();
  }
});

// 방/상점 배경 일러스트(1536x1024)를 object-fit:contain처럼 정확히 맞추고,
// 그 위의 핫스팟 버튼들이 픽셀 단위로 정렬되도록 stage-fit 레이어 크기를 계산한다.
const STAGE_NATURAL_W = 1536, STAGE_NATURAL_H = 1024;
function fitStage(name) {
  const wrap = document.getElementById(`${name}-stage-wrap`);
  const fit = document.getElementById(`${name}-stage-fit`);
  if (!wrap || !fit) return;
  const ww = wrap.clientWidth, wh = wrap.clientHeight;
  if (ww === 0 || wh === 0) return;
  const scale = Math.min(ww / STAGE_NATURAL_W, wh / STAGE_NATURAL_H);
  const w = STAGE_NATURAL_W * scale, h = STAGE_NATURAL_H * scale;
  fit.style.width = `${w}px`;
  fit.style.height = `${h}px`;
  fit.style.left = `${(ww - w) / 2}px`;
  fit.style.top = `${(wh - h) / 2}px`;
}
window.addEventListener("resize", () => {
  if (currentScene === "room") fitStage("room");
  if (currentScene === "shop") fitStage("shop");
});

/* ---------------------------- 재화 로직 (공용, 1P/2P 분리 §6) ---------------------------- */

// playerIdx(1|2)가 있고 playerCount===2면 해당 플레이어의 지갑(p{n}Wallet)을, 아니면(1인
// 플레이) 기존 단일 state 필드를 그대로 쓴다. 지갑과 state가 lives/gems/coins/money/
// inventory/coinMilestone 필드명을 그대로 공유하도록 설계해(defaultPlayerWallet 참고)
// 아래 함수들이 대상 객체만 바꿔가며 기존 로직을 그대로 재사용할 수 있게 했다.
function wallet(playerIdx) {
  if (state.playerCount !== 2) return null;
  return playerIdx === 2 ? state.p2Wallet : state.p1Wallet;
}
// 아이템 인벤토리도 지갑과 동일한 패턴(§신규-1): 2P면 플레이어별 개별 인벤토리, 1P면 기존
// 공용 state.inventory를 그대로 쓴다.
function inventoryFor(playerIdx) {
  if (state.playerCount !== 2) return state.inventory;
  return playerIdx === 2 ? state.p2Inventory : state.p1Inventory;
}
// 2P 모드에서만 "P1 "/"P2 " 접두사를 붙이고, 1P는 빈 문자열(기존 메시지 형식 그대로).
function playerTag(playerIdx) { return state.playerCount === 2 ? `P${playerIdx} ` : ""; }
// 방/상점처럼 "어느 플레이어 화면인지"가 마우스 클릭 하나로 고정되는 곳에서 쓰는 단축 접근자.
// 2P 모드에서는 state.roomActivePlayer(방 상단 P1/P2 토글)가 가리키는 플레이어의 지갑.
function activeWallet() { return wallet(state.roomActivePlayer) || state; }
function getLives(playerIdx) { return (wallet(playerIdx) || state).lives; }
function getGems(playerIdx) { return (wallet(playerIdx) || state).gems; }
function getCoins(playerIdx) { return (wallet(playerIdx) || state).coins; }
function getMoney(playerIdx) { return (wallet(playerIdx) || state).money; }

function addGems(n, playerIdx) {
  const g = wallet(playerIdx) || state;
  g.gems += n;
  while (g.gems >= 20) {
    g.gems -= 20;
    // 트로피/날개 보유는 1P/2P 공용 풀(§Context) - 어느 플레이어의 보석이 20개를 채우든
    // 같은 공용 트로피 진행도에 적립된다.
    state.trophies += 1;
    state.totalTrophies += 1;
    toast("🏆 보석 20개 모아 트로피 획득!");
    // 날개는 더 이상 트로피로 교환하지 않는다(§신규-날개2 사용자 확정) - 대신 각 지역
    // 수호자를 처치하면 그 지역 날개를 바로 획득한다(applyChargeProjectileHit 참고).
    // 트로피는 순수 수집 마일스톤으로 남기고 10개마다 그대로 리셋만 한다.
    while (state.trophies >= 10) {
      state.trophies -= 10;
      toast("🎖️ 트로피 10개 달성!");
    }
  }
}

function addCoins(n, playerIdx) {
  const g = wallet(playerIdx) || state;
  const before = g.coins;
  g.coins += n;
  // 10코인 단위마다 아이템 지급
  const beforeStep = Math.floor(before / 10);
  const afterStep = Math.floor(g.coins / 10);
  for (let i = beforeStep; i < afterStep; i++) {
    grantRandomItem(playerIdx);
  }
}

// 1P는 기존처럼 공용 state.inventory, 2P는 코인을 모은 그 플레이어의 개별 인벤토리(§신규-1).
function grantRandomItem(playerIdx) {
  const item = pick(ITEMS);
  const inv = inventoryFor(playerIdx);
  inv[item.id] = (inv[item.id] || 0) + 1;
  toast(`🎁 ${playerTag(playerIdx)}아이템 획득: ${item.emoji} ${item.name}`);
}

// playerIdx는 2인 플레이에서 "어느 플레이어가 맞았는지"를 가리킨다(생략 시 1인 플레이 취급).
// 게임오버 조건은 모드에 따라 다르다: 1인은 기존처럼 본인 목숨 0, 2인은 두 플레이어 모두 0일 때만.
// 2인 플레이에서 한 명만 목숨이 0이 되면(§신규-2) 게임오버 대신 그 플레이어만 "사망" 상태로
// 전환해 이동/공격/아이템/충돌에서 제외하고, 살아있는 다른 플레이어는 계속 플레이한다. 사망한
// 플레이어는 다음 방 화면 진입 시(endFlightTurn -> reviveDeadPlayers) 부활한다.
function loseLife(amount, reason, playerIdx) {
  if (DEBUG_MODE) return false; // QA 테스트 모드: 목숨 무적(§신규-날개2)
  const g = wallet(playerIdx) || state;
  const p = playerAt(playerIdx || 1);
  if (p.dead) return false; // 이미 사망한 플레이어는 추가 피해를 받지 않는다
  g.lives = Math.max(0, +(g.lives - amount).toFixed(1));
  resetCombo(); // 목숨이 감소하는 모든 경로(장애물 피격, 보석함 위기 실패 등)에서 공통으로 콤보 리셋
  updateAllHUD();
  const overallDead = state.playerCount === 2 ? (getLives(1) <= 0 && getLives(2) <= 0) : g.lives <= 0;
  if (g.lives <= 0) {
    p.dead = true;
    p.charging = false; p.chargeT = 0; // 진행 중이던 차지 공격은 즉시 취소
    if (!overallDead) toast(`💀 ${playerTag(playerIdx || 1)}쓰러졌습니다! (다음 방 진입 시 부활)`);
  }
  if (overallDead) {
    triggerGameOver(reason);
    return true;
  }
  return false;
}

/* =========================================================================
   ROOM SCENE
   ========================================================================= */

let restRemaining = 0; // seconds, 0 이면 휴식 없음(비행 가능)
let gemboxDanger = { active: false, timer: 0 }; // 우편(보석함 경고) 이벤트 진행 상태

function startGemboxDanger() {
  gemboxDanger = { active: true, timer: 5 };
  document.getElementById("obj-gembox").classList.add("danger");
  toast("⚠️ 몬스터가 보석을 노리고 있습니다! 보석함에 숨으세요! (5초)");
}

function endGemboxDanger(hid) {
  gemboxDanger.active = false;
  document.getElementById("obj-gembox").classList.remove("danger");
  if (hid) {
    toast("🫣 보석함 안에 숨어 위기를 넘겼습니다!");
  } else {
    const dead = loseLife(0.5, "몬스터에게 들켜", state.roomActivePlayer);
    if (!dead) toast("💥 몬스터가 나타나 꿀밤을 먹이고 갔습니다! 목숨 -0.5");
  }
}

// 방 배경 일러스트 속 날개걸이는 WINGS 배열 순서와 동일하게 4열x2행으로 배치되어 있음
const ROOM_WING_GRID = { left0: 455 / 1536, top0: 130 / 1024, cellW: 132.5 / 1536, cellH: 150 / 1024 };

// 2P 모드에서 "지금 화면이 다루는 캐릭터"의 장착 날개. 1P는 기존 state.equippedWing 그대로.
function activeEquippedWing() {
  if (state.playerCount !== 2) return state.equippedWing;
  return state.roomActivePlayer === 2 ? state.p2EquippedWing : state.p1EquippedWing;
}
function setActiveEquippedWing(wingId) {
  if (state.playerCount !== 2) { state.equippedWing = wingId; return; }
  if (state.roomActivePlayer === 2) state.p2EquippedWing = wingId; else state.p1EquippedWing = wingId;
}
// 2P 모드에서 "지금 화면이 다루는 캐릭터"의 주인공(hero) id. 1P는 항상 hero1.
function activeCharacterId() {
  // effectiveCharacterId()와 동일한 이유로 1인 플레이도 p1CharacterId를 그대로 쓴다(사용자 확정).
  if (state.playerCount !== 2) return state.p1CharacterId;
  return state.roomActivePlayer === 2 ? state.p2CharacterId : state.p1CharacterId;
}

// 방 배경 이미지(§Ch, room/room_{0..9}.png): 벽의 "나의 날개 컬렉션" 그림이 실제 보유 날개
// 수(N)에 맞춰 아이콘 N개를 보여주도록 미리 그려진 10장짜리 시퀀스다(0/1장은 아이콘 없이
// 막 날기 시작한 연출, 2~8장은 보유 날개 아이콘이 하나씩 늘어남). 19장 엔딩 이후엔 8장
// 전부가 빈 명패로 바뀐 9번 그림으로 고정 - "누구도 날개를 소유하지 않는다"는 결말을
// 코드로 별도 구현하지 않고 이 배경 한 장 교체만으로 표현한다(Bible §11, §22).
function hasReachedEnding() {
  return state.chapter >= CHAPTER_COUNT && state.chapterImageShown;
}
function roomImageSrc() {
  if (hasReachedEnding()) return "room/room_9.png";
  const n = clamp(state.ownedWings.length, 0, 8);
  return `room/room_${n}.png`;
}

function renderRoom() {
  document.getElementById("room-bg-img").src = roomImageSrc();
  updateAllHUD();
  document.getElementById("gembox-badge").textContent = `💎 ${activeWallet().gems} / 20`;
  document.getElementById("trophy-badge").textContent = `🏆 ${state.trophies} / 10`;
  document.getElementById("fridge-badge").textContent = `음료 ${state.fridgeDrinks}개`;
  renderRoomActivePlayerToggle();

  const idx = Math.max(0, WINGS.findIndex(w => w.id === activeEquippedWing()));
  const col = idx % 4, row = Math.floor(idx / 4);
  const badge = document.getElementById("equipped-badge");
  badge.style.left = `${(ROOM_WING_GRID.left0 + col * ROOM_WING_GRID.cellW) * 100}%`;
  badge.style.top = `${(ROOM_WING_GRID.top0 + row * ROOM_WING_GRID.cellH) * 100}%`;

  const restBox = document.getElementById("rest-box");
  const startBtn = document.getElementById("btn-start-flight");
  if (restRemaining > 0) {
    restBox.classList.remove("hidden");
    document.getElementById("rest-timer").textContent = fmtTime(restRemaining);
    startBtn.disabled = true;
  } else {
    restBox.classList.add("hidden");
    startBtn.disabled = false;
  }
  renderInventoryBar("inventory-bar-room");
}

setInterval(() => {
  if (currentScene !== "room") return;
  if (restRemaining > 0) {
    restRemaining -= 1;
    if (restRemaining <= 0) { restRemaining = 0; toast("😊 휴식 완료! 다시 비행할 수 있어요."); }
    renderRoom();
  }
  if (gemboxDanger.active) {
    gemboxDanger.timer -= 1;
    if (gemboxDanger.timer <= 0) endGemboxDanger(false);
  }
}, 1000);

document.getElementById("btn-skip-rest").addEventListener("click", () => {
  restRemaining = 0;
  renderRoom();
});

document.getElementById("btn-start-flight").addEventListener("click", () => {
  if (restRemaining > 0) return;
  // 미뤄둔 컷신(§신규-날개7, 예: 14장)이 있으면 이번 클릭에서 그것부터 연속으로 보여준다.
  if (state.pendingDeferredComic) {
    openDeferredComic(state.pendingDeferredComic);
    return;
  }
  // comicTiming:"after"인 챕터(§신규-날개7)는 컷신 없이 곧장 비행을 시작한다 - 그 컷신은
  // advanceChapter()가 pendingDeferredComic에 담아뒀다가 다음 챕터 이후 묶어서 보여준다.
  if (chapterData(state.chapter).comicTiming === "after") {
    startFlight();
    return;
  }
  // 이번 챕터 컷신을 아직 안 봤으면(§3, 재생 가능 챕터는 여기서만 컷신을 띄운다) 먼저 보여주고,
  // 닫히면 btn-story-continue 핸들러가 이어서 startFlight()를 호출한다.
  if (!state.chapterImageShown) {
    pendingFlightStart = true;
    openChapterIntro();
    return;
  }
  startFlight();
});

document.getElementById("btn-goto-shop").addEventListener("click", () => {
  switchScene("shop");
});

document.getElementById("btn-reset-game").addEventListener("click", () => {
  const ok = confirm("정말 처음부터 새로 시작하시겠습니까?\n모든 진행 상황(돈/코인/보석/날개/트로피)이 초기화됩니다.");
  if (!ok) return;
  localStorage.removeItem(SAVE_KEY);
  state = defaultState();
  restRemaining = 0;
  rt.running = false;
  saveState();
  switchScene("room");
  maybeStartFirstEntry();
  toast("🔄 새로운 모험을 시작합니다!");
});

document.getElementById("obj-door").addEventListener("click", () => {
  switchScene("shop");
});

/* ---- Room objects ---- */

document.getElementById("obj-gembox").addEventListener("click", () => {
  if (gemboxDanger.active) {
    document.getElementById("modal-hide").classList.remove("hidden");
    return;
  }
  toast(`💎 보석함: ${activeWallet().gems}/20 (20개 모으면 트로피 1개 획득)`);
});

document.getElementById("btn-hide-yes").addEventListener("click", () => {
  document.getElementById("modal-hide").classList.add("hidden");
  if (gemboxDanger.active) endGemboxDanger(true);
});
document.getElementById("btn-hide-no").addEventListener("click", () => {
  document.getElementById("modal-hide").classList.add("hidden");
});

document.getElementById("obj-trophy").addEventListener("click", () => {
  toast(`🏆 트로피: ${state.trophies}/10 (10개 모으면 새 날개 획득) · 누적 ${state.totalTrophies}개`);
});

document.getElementById("obj-fridge").addEventListener("click", () => {
  openDrinkModal(false);
});

document.getElementById("obj-wingrack").addEventListener("click", () => {
  openWingSelect(false);
});

/* ---- Drink modal ---- */

function openDrinkModal(forced) {
  const modal = document.getElementById("modal-drink");
  const text = document.getElementById("drink-text");
  if (state.fridgeDrinks <= 0 && !forced) {
    toast("🧊 냉장고에 음료가 없어요. 비행을 마치면 음료가 보충됩니다.");
    return;
  }
  text.textContent = forced
    ? "음료수를 드시겠습니까?"
    : `음료수를 드시겠습니까? (냉장고에 ${state.fridgeDrinks}개 남음)`;
  modal.classList.remove("hidden");
  modal.dataset.forced = forced ? "1" : "0";
}

document.getElementById("btn-drink-yes").addEventListener("click", () => {
  const modal = document.getElementById("modal-drink");
  const forced = modal.dataset.forced === "1";
  if (state.fridgeDrinks > 0) {
    state.fridgeDrinks -= 1;
    addGems(1, state.roomActivePlayer);
    toast("🧊 음료를 마셨습니다! 보석 +1");
  } else if (forced) {
    // 최초 시작 시엔 재고가 있어야 하지만, 안전장치로 그냥 보석 지급
    addGems(1, state.roomActivePlayer);
    toast("🧊 음료를 마셨습니다! 보석 +1");
  }
  saveState();
  modal.classList.add("hidden");
  if (forced) openWingSelect(true);
  else renderRoom();
});

document.getElementById("btn-drink-no").addEventListener("click", () => {
  const modal = document.getElementById("modal-drink");
  const forced = modal.dataset.forced === "1";
  modal.classList.add("hidden");
  if (forced) openWingSelect(true);
});

/* ---- Wing select modal ---- */

// 날개 선택 카드 썸네일: hero1은 기존 assets/cards, hero2/3는 각자의 디자인 시트에서 동일하게
// 잘라낸 assets/cards/{spriteDir}(배경 일러스트 포함된 원본 카드 - 캐릭터별 미리보기 요청)를 쓴다.
function wingThumbSrc(wingId, charId) {
  const c = CHARACTER_MAP[charId] || CHARACTERS[0];
  return c.spriteDir ? `assets/cards/${c.spriteDir}/${wingId}.png` : `assets/cards/${wingId}.png`;
}

function openWingSelect(forced) {
  const modal = document.getElementById("modal-wingselect");
  const list = document.getElementById("wing-list");
  const closeBtn = document.getElementById("btn-close-wingselect");
  document.getElementById("wingselect-title").textContent =
    state.playerCount === 2 ? `🪽 날개 선택 (P${state.roomActivePlayer})` : "🪽 날개 선택";
  list.innerHTML = "";
  const charId = activeCharacterId();
  WINGS.forEach(w => {
    const owned = state.ownedWings.includes(w.id);
    const div = document.createElement("div");
    div.className = "wing-option" + (w.id === activeEquippedWing() ? " equipped" : "") + (!owned ? " locked" : "");
    div.innerHTML = `<img class="w-thumb" src="${wingThumbSrc(w.id, charId)}" alt="${w.name}"><div class="w-name">${w.name}</div><div class="w-desc">${w.desc}</div>`;
    if (owned) {
      div.addEventListener("click", () => {
        setActiveEquippedWing(w.id);
        saveState();
        modal.classList.add("hidden");
        if (forced) finishFirstEntryFlow();
        else { toast(`🪽 [${w.name}] 장착!`); renderRoom(); }
      });
    }
    list.appendChild(div);
  });
  closeBtn.classList.toggle("hidden", forced);
  modal.classList.remove("hidden");
}

document.getElementById("btn-close-wingselect").addEventListener("click", () => {
  document.getElementById("modal-wingselect").classList.add("hidden");
});

/* ---- First entry flow ---- */

function finishFirstEntryFlow() {
  state.hasStartedBefore = true;
  saveState();
  renderRoom();
  settleRoomEntry(); // 1장은 재생 가능 챕터라 여기선 아무 것도 안 뜸 - "비행 출발" 클릭 시 표시(§3)
}

// 최초 진입 흐름(§2,3): 인원수 선택 -> 캐릭터 선택(1P, 2P면 P1/P2 순서) -> 기존 음료/날개
// 선택 흐름. hasChosenPlayerCount가 없으면 그 전 어떤 저장도 없는 완전 최초 실행이다.
function maybeStartFirstEntry() {
  if (!state.hasChosenPlayerCount) {
    openPlayerCountModal();
    return;
  }
  if (!state.hasStartedBefore) {
    openDrinkModal(true);
  }
}

/* ---------------------------- 인원수 선택(§2) ---------------------------- */

function openPlayerCountModal() {
  document.getElementById("modal-playercount").classList.remove("hidden");
}
function choosePlayerCount(n) {
  state.playerCount = n;
  state.hasChosenPlayerCount = true;
  state.roomActivePlayer = 1;
  saveState();
  document.getElementById("modal-playercount").classList.add("hidden");
  openCharacterSelectModal(true);
}
document.getElementById("btn-pc-1").addEventListener("click", () => choosePlayerCount(1));
document.getElementById("btn-pc-2").addEventListener("click", () => choosePlayerCount(2));

/* ---------------------------- 캐릭터 선택(§3, §10) ----------------------------
   온보딩(최초 진입)과 방의 "캐릭터 변경" 버튼이 이 모달 하나를 공유한다. 온보딩 중엔
   선택 즉시 현재 캐릭터에도 반영되고(플레이할 캐릭터가 아직 없으므로), 방에서 다시 열면
   선택은 *NextTurn에만 쌓여 다음 startFlight()에서 반영된다(§10 "다음 턴부터 적용"). */
let charSelectOnboarding = false;

function openCharacterSelectModal(onboarding) {
  charSelectOnboarding = !!onboarding;
  const modal = document.getElementById("modal-charselect");
  const toggleWrap = document.getElementById("charselect-player-toggle");
  toggleWrap.classList.toggle("hidden", state.playerCount !== 2 || charSelectOnboarding);
  document.getElementById("charselect-p1-btn").classList.toggle("active", state.roomActivePlayer === 1);
  document.getElementById("charselect-p2-btn").classList.toggle("active", state.roomActivePlayer === 2);
  document.getElementById("charselect-title").textContent =
    state.playerCount === 2 ? `캐릭터 선택 (P${state.roomActivePlayer})` : "캐릭터 선택";

  const list = document.getElementById("charselect-list");
  list.innerHTML = "";
  const currentPending = state.roomActivePlayer === 2 ? state.p2CharacterNextTurn : state.p1CharacterNextTurn;
  CHARACTERS.forEach(c => {
    const div = document.createElement("div");
    div.className = "wing-option" + (c.id === currentPending ? " equipped" : "");
    div.innerHTML = `<img class="w-thumb" src="${c.card}" alt="${c.name}"><div class="w-name">${c.name}</div>`;
    div.addEventListener("click", () => selectCharacter(c.id));
    list.appendChild(div);
  });
  document.getElementById("btn-close-charselect").classList.toggle("hidden", charSelectOnboarding);
  modal.classList.remove("hidden");
}

function selectCharacter(charId) {
  if (state.roomActivePlayer === 2) {
    state.p2CharacterNextTurn = charId;
    if (charSelectOnboarding) state.p2CharacterId = charId;
  } else {
    state.p1CharacterNextTurn = charId;
    if (charSelectOnboarding) state.p1CharacterId = charId;
  }
  saveState();

  if (charSelectOnboarding) {
    if (state.playerCount === 2 && state.roomActivePlayer === 1) {
      state.roomActivePlayer = 2;
      openCharacterSelectModal(true);
      return;
    }
    state.roomActivePlayer = 1;
    document.getElementById("modal-charselect").classList.add("hidden");
    openDrinkModal(true); // 기존 첫 진입 흐름(음료->날개 선택)으로 이어짐
    return;
  }
  document.getElementById("modal-charselect").classList.add("hidden");
  toast(`🧑 ${CHARACTER_MAP[charId].name} 선택! 다음 턴부터 적용됩니다.`);
  renderRoom();
}

document.getElementById("charselect-p1-btn").addEventListener("click", () => {
  state.roomActivePlayer = 1;
  openCharacterSelectModal(false);
});
document.getElementById("charselect-p2-btn").addEventListener("click", () => {
  state.roomActivePlayer = 2;
  openCharacterSelectModal(false);
});
document.getElementById("btn-close-charselect").addEventListener("click", () => {
  document.getElementById("modal-charselect").classList.add("hidden");
});
document.getElementById("btn-change-character").addEventListener("click", () => {
  openCharacterSelectModal(false);
});

/* ---------------------------- 방/상점 "조작 대상 플레이어" 토글(§Context) ----------------------------
   2P 모드에서 방(냉장고/보석함/날개걸이)과 상점(교환)이 어느 플레이어의 자원에 적용될지
   결정한다. 1P 모드에서는 항상 숨김. */
function renderRoomActivePlayerToggle() {
  document.querySelectorAll(".room-active-player-toggle").forEach(el => {
    el.classList.toggle("hidden", state.playerCount !== 2);
    el.querySelectorAll("[data-player]").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.player) === state.roomActivePlayer);
    });
  });
}
document.querySelectorAll(".room-active-player-toggle [data-player]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.roomActivePlayer = Number(btn.dataset.player);
    saveState();
    if (currentScene === "room") renderRoom();
    if (currentScene === "shop") renderShop();
  });
});

/* ---------------------------- 조작키 변경(§10, §11) ---------------------------- */
const KEYBIND_ACTION_LABEL = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽", attack: "공격" };

function buildKeyChip(action, code, player) {
  const row = document.createElement("div");
  row.className = "keybind-row";
  const label = document.createElement("span");
  label.className = "keybind-action";
  label.textContent = KEYBIND_ACTION_LABEL[action] || action;
  const chip = document.createElement("button");
  chip.className = "keybind-chip";
  chip.type = "button";
  chip.textContent = keyLabel(code);
  chip.addEventListener("click", () => startKeyRebind(player, action, chip));
  row.appendChild(label);
  row.appendChild(chip);
  return row;
}
function buildKeybindGroup(title, keys, player) {
  const group = document.createElement("div");
  group.className = "keybind-group";
  const h = document.createElement("div");
  h.className = "keybind-group-title";
  h.textContent = title;
  group.appendChild(h);
  Object.keys(keys).forEach(action => group.appendChild(buildKeyChip(action, keys[action], player)));
  return group;
}

function renderKeybindModal() {
  const container = document.getElementById("keybind-list");
  container.innerHTML = "";
  if (state.playerCount === 2) {
    container.appendChild(buildKeybindGroup("1P (↑↓←→ / 공격 / 아이템 7890)", state.p1Keys, 1));
    container.appendChild(buildKeybindGroup("2P (RFDG / 공격 / 아이템 1234)", state.p2Keys, 2));
  } else {
    container.appendChild(buildKeybindGroup("1P", { attack: state.soloAttackKey }, null));
  }
  const err = document.getElementById("keybind-error");
  err.textContent = "";
  err.classList.add("hidden");
}

function startKeyRebind(player, action, chipEl) {
  rt.keyRebindTarget = { player, action };
  chipEl.textContent = "새 키를 입력하세요";
  chipEl.classList.add("waiting");
  const err = document.getElementById("keybind-error");
  err.textContent = "";
  err.classList.add("hidden");
}

function isKeyInUse(code, exclude) {
  const matches = (player, action) => exclude.player === player && exclude.action === action;
  if (state.playerCount === 2) {
    for (const [action, k] of Object.entries(state.p1Keys)) if (k === code && !matches(1, action)) return true;
    for (const [action, k] of Object.entries(state.p2Keys)) if (k === code && !matches(2, action)) return true;
  } else if (state.soloAttackKey === code && !matches(null, "attack")) {
    return true;
  }
  return false;
}

// keydown 핸들러(§11)가 rt.keyRebindTarget이 있을 때 다음 키 입력을 이 함수로 넘긴다.
// 1P/2P를 통틀어 이미 쓰이는 키(자기 자신 제외)면 저장하지 않고 경고만 표시한다.
function captureRebindKey(code) {
  const target = rt.keyRebindTarget;
  rt.keyRebindTarget = null;
  if (!target) return;
  if (isKeyInUse(code, target)) {
    // renderKeybindModal()이 칩 목록을 다시 그리면서 에러 영역도 초기화하므로, 먼저
    // 다시 그린 뒤에 에러 메시지를 얹어야 지워지지 않는다(순서 중요).
    renderKeybindModal();
    const err = document.getElementById("keybind-error");
    err.textContent = "이미 사용 중인 키입니다.";
    err.classList.remove("hidden");
    return;
  }
  if (target.player === 1) state.p1Keys[target.action] = code;
  else if (target.player === 2) state.p2Keys[target.action] = code;
  else state.soloAttackKey = code;
  saveState();
  renderKeybindModal();
}

document.getElementById("btn-change-controls").addEventListener("click", () => {
  renderKeybindModal();
  document.getElementById("modal-keybind").classList.remove("hidden");
});
document.getElementById("btn-close-keybind").addEventListener("click", () => {
  rt.keyRebindTarget = null;
  document.getElementById("modal-keybind").classList.add("hidden");
});

/* =========================================================================
   SHOP SCENE
   ========================================================================= */

function renderShop() {
  const w = activeWallet();
  document.getElementById("shop-money").textContent = w.money;
  document.getElementById("shop-gems").textContent = w.gems;
  document.getElementById("btn-exchange").disabled = w.money < 10;
  document.getElementById("mail-badge").classList.toggle("hidden", !state.mailbox.hasLetter);
  renderRoomActivePlayerToggle();
}

document.getElementById("btn-exchange").addEventListener("click", () => {
  const w = activeWallet();
  if (w.money < 10) return;
  w.money -= 10;
  addGems(1, state.roomActivePlayer);
  saveState();
  toast("💰 돈 10개를 보석 1개로 교환했습니다!");
  renderShop();
  updateAllHUD();
});

document.getElementById("btn-back-room").addEventListener("click", () => {
  switchScene("room");
});

/* ---- 우편함 ---- */

// 편지 하나를 화면에 표시 + 적용한다. playerIdx가 있으면(2P, §신규-4) apply()가 참조하는
// activeWallet()/roomActivePlayer를 그 플레이어로 임시 전환해 개인 효과가 정확히 그 플레이어
// 에게만 적용되게 한 뒤(기존 편지들의 apply() 로직은 전혀 건드리지 않고 그대로 재사용) 원래
// 토글로 복구한다. 이미 공용 자원(예: nextTurnGemBonus)을 다루는 편지는 기존처럼 공용으로 남는다.
function showMailLetter(letter, playerIdx) {
  if (playerIdx) {
    const savedActive = state.roomActivePlayer;
    state.roomActivePlayer = playerIdx;
    letter.apply();
    state.roomActivePlayer = savedActive;
  } else {
    letter.apply();
  }
  saveState();
  updateAllHUD();
  renderShop();

  const prefix = playerIdx ? `[P${playerIdx}] ` : "";
  document.getElementById("mail-text").textContent = prefix + letter.text;
  const effectEl = document.getElementById("mail-effect-text");
  const desc = letter.effectText ? `✨ ${letter.effectText}` : (letter.eventText ? `⚠️ ${letter.eventText}` : "");
  effectEl.textContent = desc;
  effectEl.classList.toggle("hidden", !desc);
  document.getElementById("modal-mail").classList.remove("hidden");
}

// 대기열에서 다음 편지를 꺼내 보여준다(§신규-4). 2P는 obj-mail 클릭 시 [P1, P2] 순서로 큐가
// 채워지고, 이 함수가 모달 하나가 닫힐 때마다 재호출되어 "동시에 두 모달이 뜨는 일 없이" P1 ->
// (닫기) -> P2 -> (닫기) 순서를 강제한다.
function showNextQueuedMail() {
  if (rt.mailQueue.length === 0) return;
  const next = rt.mailQueue.shift();
  showMailLetter(next.letter, next.playerIdx);
}

document.getElementById("obj-mail").addEventListener("click", () => {
  if (!state.mailbox.hasLetter) {
    toast("📭 새 우편이 없습니다.");
    return;
  }
  if (state.playerCount === 2) {
    // 두 편지는 endFlightTurn()에서 이미 각자 독립적으로 뽑아 둔 결과(letterId/letterId2)를
    // 그대로 쓴다 - 여기서 다시 뽑지 않으므로 우연이 아닌 한 두 플레이어가 같은 편지를
    // "복사"해서 받는 일은 없다(요청사항: 우연히 같아지는 것은 허용, 강제 복사는 금지).
    // letterId2가 없는 옛 저장 데이터(이 기능 이전에 이미 hasLetter:true였던 경우)에 대한
    // 안전장치로 pick(LETTERS)를 폴백으로 둔다.
    rt.mailQueue = [
      { playerIdx: 1, letter: LETTER_MAP[state.mailbox.letterId] || pick(LETTERS) },
      { playerIdx: 2, letter: LETTER_MAP[state.mailbox.letterId2] || pick(LETTERS) },
    ];
    state.mailbox = { hasLetter: false, letterId: null, letterId2: null };
    showNextQueuedMail();
  } else {
    const letter = LETTER_MAP[state.mailbox.letterId];
    state.mailbox = { hasLetter: false, letterId: null, letterId2: null };
    showMailLetter(letter, null);
  }
});

document.getElementById("btn-close-mail").addEventListener("click", () => {
  document.getElementById("modal-mail").classList.add("hidden");
  if (rt.mailQueue.length > 0) showNextQueuedMail();
});

/* =========================================================================
   INVENTORY BAR (공용)
   ========================================================================= */

// containerId가 가리키는 창이 어느 플레이어 것인지: playerIdx를 명시하면 그 플레이어(비행 중
// 1P/2P 개별 창, §신규-1), 생략하면 방/상점 화면의 roomActivePlayer 토글 대상(기존 그대로).
function renderInventoryBar(containerId, playerIdx) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  const pIdx = playerIdx || state.roomActivePlayer;
  const inv = inventoryFor(pIdx);
  // playerIdx가 명시된 경우(비행 중 개별 창)에만 2P 전용 단축키 표시. 방/상점 창(playerIdx
  // 생략, roomActivePlayer 토글 대상)은 실제 키 동작이 그대로이므로 라벨도 기존 1/2/3/4 그대로.
  let keys = ITEM_KEYS_SOLO;
  if (playerIdx && state.playerCount === 2) keys = playerIdx === 2 ? ITEM_KEYS_2P_P2 : ITEM_KEYS_2P_P1;
  ITEMS.forEach((item, i) => {
    const count = inv[item.id] || 0;
    const div = document.createElement("div");
    const flightOnly = (item.id === "monkey" || item.id === "chair");
    const usable = count > 0 && (!flightOnly || currentScene === "flight");
    div.className = "inv-item" + (usable ? "" : " disabled");
    div.title = `[${keys[i]}] ${item.name}\n${item.desc}`;
    const iconHtml = item.icon ? `<img class="icon-inline" src="${item.icon}" alt="${item.name}">` : item.emoji;
    div.innerHTML = `<span class="inv-key">${keys[i]}</span>${iconHtml}<span class="inv-count">${count}</span>`;
    if (usable) div.addEventListener("click", () => useItem(item.id, pIdx));
    el.appendChild(div);
  });
}

// 비행 중 1P/2P 개별 아이템 창(§신규-1)을 함께 갱신하는 헬퍼. 1P 모드는 P2 창을 숨긴 채 P1
// 창만 그리고, 2P 모드는 두 창을 각자의 개별 인벤토리로 그린다.
function renderInventoryBars() {
  renderInventoryBar("inventory-bar-flight", 1);
  // 2P 모드에서만 1P 창을 우측하단으로 옮긴다(1인 모드는 기존처럼 좌측하단 그대로).
  // 2P 창(#inventory-bar-flight-p2)은 기본 위치(좌측하단)를 그대로 쓴다.
  document.getElementById("inventory-bar-flight").classList.toggle("inventory-bar-right", state.playerCount === 2);
  const p2Bar = document.getElementById("inventory-bar-flight-p2");
  if (p2Bar) {
    p2Bar.classList.toggle("hidden", state.playerCount !== 2);
    if (state.playerCount === 2) renderInventoryBar("inventory-bar-flight-p2", 2);
  }
}

// playerIdx를 생략하면 기존처럼 roomActivePlayer(방/상점 화면)를 대상으로 한다(§Context).
// 명시하면 그 플레이어의 개별 인벤토리/지갑만 사용한다(비행 중 1P/2P 단축키, §신규-1).
function useItem(id, playerIdx) {
  const pIdx = playerIdx || state.roomActivePlayer;
  const actor = playerAt(pIdx);
  if (actor && actor.dead) return; // 사망한 플레이어는 아이템 사용 불가(§신규-2)
  const inv = inventoryFor(pIdx);
  const count = inv[id] || 0;
  if (count <= 0) return;
  if ((id === "monkey" || id === "chair") && currentScene !== "flight") {
    toast("비행 중에만 사용할 수 있는 아이템입니다.");
    return;
  }
  const tag = playerTag(pIdx);
  switch (id) {
    case "peach": {
      inv.peach -= 1;
      const w = wallet(pIdx) || state;
      w.lives = clamp(+(w.lives + 1).toFixed(1), 0, MAX_LIVES);
      toast(`🍑 ${tag}목숨 +1!`);
      break;
    }
    case "gem":
      inv.gem -= 1;
      addGems(1, pIdx);
      toast(`💎 ${tag}보석 +1!`);
      break;
    case "monkey": {
      const selectable = WINGS.filter(w => state.ownedWings.includes(w.id) && w.id !== effectiveWing(pIdx));
      if (selectable.length === 0) {
        toast("🐒 지금 바꿔 쓸 수 있는 다른 보유 날개가 없습니다.");
        return;
      }
      inv.monkey -= 1;
      rt.paused = true; // 날개를 선택할 때까지 비행 진행을 멈춘다
      openMonkeyModal(pIdx);
      break;
    }
    case "chair":
      inv.chair -= 1;
      playerAt(pIdx).moneyToGemTimer = 10;
      toast(`💺 ${tag}10초 동안 획득하는 돈이 보석으로 대신 지급됩니다!`);
      break;
  }
  saveState();
  updateAllHUD();
  renderInventoryBar("inventory-bar-room");
  renderInventoryBars();
}

function openMonkeyModal(playerIdx) {
  const pIdx = playerIdx || state.roomActivePlayer;
  const modal = document.getElementById("modal-monkey");
  const list = document.getElementById("monkey-wing-list");
  list.innerHTML = "";
  const charId = effectiveCharacterId(pIdx);
  // 스토리 진행에 따라 보유 날개가 늘수록 선택지도 함께 늘어난다(사용자 확정, §신규-날개3) -
  // "미보유 날개 체험용"에서 "보유 날개 중 임시로 바꿔 쓰는 로드아웃"으로 변경. 지금 이미
  // 장착 중인 날개는 골라도 의미가 없으니 목록에서 제외한다.
  const current = effectiveWing(pIdx);
  const selectable = WINGS.filter(w => state.ownedWings.includes(w.id) && w.id !== current);
  selectable.forEach(w => {
    const div = document.createElement("div");
    div.className = "wing-option";
    div.innerHTML = `<img class="w-thumb" src="${wingThumbSrc(w.id, charId)}" alt="${w.name}"><div class="w-name">${w.name}</div><div class="w-desc">${w.desc}</div>`;
    div.addEventListener("click", () => {
      const p = playerAt(pIdx);
      p.tempWing = w.id;
      p.tempWingTimer = 60;
      toast(`🐒 ${playerTag(pIdx)}60초 동안 [${w.name}]로 변신!`);
      modal.classList.add("hidden");
      rt.paused = false;
    });
    list.appendChild(div);
  });
  modal.classList.remove("hidden");
}
document.getElementById("btn-close-monkey").addEventListener("click", () => {
  document.getElementById("modal-monkey").classList.add("hidden");
  rt.paused = false;
});

/* =========================================================================
   HUD (공용 갱신)
   ========================================================================= */

function updateAllHUD() {
  const rw = activeWallet();
  document.getElementById("hud-money").textContent = rw.money;
  document.getElementById("hud-gems").textContent = rw.gems;
  document.getElementById("hud-trophies").textContent = state.totalTrophies;
  document.getElementById("hud-lives").textContent = rw.lives.toFixed(1);

  document.getElementById("flight-timer").textContent = Math.ceil(rt.turnTimer);
  if (state.playerCount === 2) {
    document.getElementById("flight-lives").textContent = getLives(1).toFixed(1);
    document.getElementById("flight-coins").textContent = getCoins(1);
    document.getElementById("flight-money").textContent = getMoney(1);
    document.getElementById("flight-gems").textContent = getGems(1);
    document.getElementById("flight-lives-p2").textContent = getLives(2).toFixed(1);
    document.getElementById("flight-coins-p2").textContent = getCoins(2);
    document.getElementById("flight-money-p2").textContent = getMoney(2);
    document.getElementById("flight-gems-p2").textContent = getGems(2);
  } else {
    document.getElementById("flight-lives").textContent = state.lives.toFixed(1);
    document.getElementById("flight-coins").textContent = state.coins;
    document.getElementById("flight-money").textContent = state.money;
    document.getElementById("flight-gems").textContent = state.gems;
  }
  document.getElementById("hud-p2-group").classList.toggle("hidden", state.playerCount !== 2);
  updateComboDisplay();
}

/* =========================================================================
   FLIGHT + BATTLE SCENE
   ========================================================================= */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// 플레이 화면(카메라) 크기 영구 고정: 월드 크기(vw/vh)에 쓰이는 캔버스 CSS 크기는 게임 전체에서
// "최초 1회"만 측정(captureFixedViewport)하고, 그 이후로는 턴이 바뀌든(startFlight) 실제
// 브라우저 창 크기·DPI·확대/축소가 바뀌든(window resize) 절대 다시 측정하지 않는다.
// 원인: 예전 코드는 "실제 브라우저 resize 이벤트"에서마다 fixedViewW/H를 다시 측정
// (recaptureViewport=true)했는데, 브라우저 창 크기/DPI/줌이 조금이라도 바뀌면(예: 창 이동,
// 디스플레이 배율 변경, 브라우저 줌) 그 순간의 (보통 더 큰) 창 크기로 재캡처되어 버려 다음
// 판의 화면이 갑자기 커져 있었다 - "장애물 회피 첫 판은 축소, 2판부터 원래대로" 증상의 원인.
// 요구사항(§15-… 배틀 뷰포트는 항상 동일해야 함)에 맞춰 재측정 자체를 완전히 없앴다.
// canvas의 실제 표시 픽셀(backing store)만은 매번 최신 CSS 크기로 맞춰야 렌더링이 또렷하므로
// resizeCanvas()는 여전히 호출하되, "월드" 크기(fixedViewW/H)에는 더 이상 영향을 주지 않는다.
let fixedViewW = 0, fixedViewH = 0;
function captureFixedViewport(w, h) {
  if (w > 0 && h > 0) { fixedViewW = w; fixedViewH = h; }
}
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (fixedViewW === 0) captureFixedViewport(w, h); // 게임 전체에서 최초 1회만 캡처, 이후 영구 고정
}
window.addEventListener("resize", () => { if (currentScene === "flight") resizeCanvas(); });

function cw() { return canvas.clientWidth; }
function ch() { return canvas.clientHeight; }

// 카메라 줌: 실제 canvas 표시 크기(cw/ch)는 그대로 두고, 게임 로직(스폰 범위/이동 경계/충돌)이
// 사용하는 "월드" 영역만 비율로 줄인다. render()에서 이 축소된 월드(vw x vh)를 1/비율배로
// 확대해 canvas 전체를 채우도록 그리므로, 캐릭터/몬스터/장애물이 화면에서 더 크게 보이면서도
// 실제 좌표계·충돌판정은 그대로 유지된다. vw()/vh()는 매 프레임 cw()/ch()를 다시 읽지 않고
// 고정된 fixedViewW/H를 기준으로 계산해 턴이 진행돼도 크기가 흔들리지 않는다.
// 장애물 회피(비전투) 화면과 몬스터 전투 화면은 서로 다른 비율을 쓴다 - 전투 화면은 별도
// 요청으로 기존 배율(0.8)을 그대로 유지하고, 회피 화면만 더 확대(축소된 월드 노출)했다.
const FLIGHT_VIEW_SCALE = 0.65;  // 장애물 회피(비전투) 중 월드 노출 비율
const BATTLE_VIEW_SCALE = 0.8;   // 몬스터 전투 중 월드 노출 비율(기존 값 그대로 유지)
function currentViewScale() { return inBattle() ? BATTLE_VIEW_SCALE : FLIGHT_VIEW_SCALE; }
function vw() { return (fixedViewW || cw()) * currentViewScale(); }
function vh() { return (fixedViewH || ch()) * currentViewScale(); }
function cameraScale() { return 1 / currentViewScale(); }

// runtime (비영구) 상태
// 플레이어 1명의 런타임 상태(§6): 위치/이동/차지/투사체/캐릭터/날개/아이템 타이머까지 전부
// 여기 담아 rt.players[0](P1)/rt.players[1](P2)가 서로 공유하는 것이 하나도 없게 한다.
function createPlayerState(playerIdx) {
  return {
    playerIdx,           // 1 또는 2 (wallet()/getLives() 등과 동일한 1-based 인덱스)
    x: 400, y: 300, tx: 400, ty: 300, invuln: 0, hiddenTimer: 0, facing: 0,
    charging: false, chargeT: 0, projectiles: [], // 차지 공격(§7) - 플레이어 소유
    moneyToGemTimer: 0, tempWing: null, tempWingTimer: 0,
    electricUseCount: 0, powerPenaltyTimer: 0,
    dead: false, // 목숨 0 -> 사망(§신규-2). 다음 방 진입 시 reviveDeadPlayers()가 되돌린다.
  };
}

let rt = {
  players: [createPlayerState(1)], // startFlight()에서 playerCount만큼 재생성
  battles: [],          // 몬스터별 독립 전투 상태(§5 startBattle) - 1P는 항상 0~1개, 2P는 0~2개
  entities: [],
  spawnT: { coin: 0, money: 0, obstacle: 0 },
  turnTimer: 60,
  running: false,
  weather: "sun",
  clouds: [],
  bgOffset: 0,
  paused: false,
  turnGemBonusOnKill: false,
  combo: 0,           // 코인 연속 획득 콤보. 목숨이 감소하는 순간에만 0으로 리셋(resetCombo). 1P/2P 공용.
  magnetActive: false, // 콤보 10 달성 시 true. 시간제 아님 - 콤보가 리셋될 때까지 유지
  particles: [],       // 코인/돈 획득 피드백 파티클
  turnDuration: 0,     // 이번 턴의 전체 길이(초). turnTimer는 여기서부터 카운트다운되므로
                        // 미니 이벤트 타이밍/길이를 턴 길이에 비례해 계산하는 기준값으로 쓴다.
  miniEvents: [],       // 이번 턴에 예약된 미니 이벤트 목록
  activeMiniEvent: null, // 현재 스폰 로직에 영향을 주고 있는 이벤트 종류(coin_storm/obstacle_rush) 또는 null
  rainbowBridge: null,   // 무지개다리 이벤트 진행 상태
  keysDown: new Set(),   // 2P 모드 방향키 눌림 상태(§4)
  keyRebindTarget: null, // 조작키 변경 UI가 다음 keydown을 가로채 저장할 대상 {player, action} (§11)
  mailQueue: [],          // 2P 우편함 순차 처리 대기열(§신규-4) - [{playerIdx, letter}, ...]
};

// rt.battles.length > 0 을 매번 풀어 쓰지 않도록 하는 파생값(기존 rt.inBattle 자리를 대신함).
function inBattle() { return rt.battles.length > 0; }
// 1-based playerIdx -> rt.players 원소. 범위를 벗어나면 안전하게 0번째로 폴백.
function playerAt(playerIdx) { return rt.players[(playerIdx || 1) - 1] || rt.players[0]; }
// 전투 b가 조준(초기 발사각/장판·슬로우필드 중심 등) 기준으로 삼는 플레이어.
function targetPlayer(b) { return playerAt(b.targetPlayerIdx); }
// (x,y) 반경 r 안에 있는 플레이어를 찾아 1-based playerIdx를 반환(없으면 null). 몬스터
// 공격/투사체 피격 판정이 "어느 플레이어가 맞았는지" 결정할 때 공용으로 쓴다.
function playerHitAt(x, y, r) {
  for (let i = 0; i < rt.players.length; i++) {
    if (rt.players[i].dead) continue; // 사망한 플레이어는 공격 판정 대상에서 제외(§신규-2)
    if (Math.hypot(rt.players[i].x - x, rt.players[i].y - y) < r) return rt.players[i].playerIdx;
  }
  return null;
}

// 콤보 10 도달 시 발동하는 코인 자석: 시간제가 아니라 "콤보가 리셋될 때까지" 유지되고,
// 마일스톤(콤보 표시와 동일한 §5-4-3 단계)을 더 높이 지나갈수록 유효 반경이 함께 늘어난다.
const COMBO_MAGNET_THRESHOLD = 10;
const MAGNET_RADIUS_BY_TIER = { 1: 100, 2: 150, 3: 220, 4: 290, 5: 360, 6: 440 };

// 콤보 표시(#combo-display, 화면 상단 중앙): 마일스톤(5/10/20/30/50/100)마다 색상 단계가
// 바뀌고, 그 순간 살짝 커졌다 돌아오는 팝 효과를 준다. 위 MAGNET_RADIUS_BY_TIER도 이
// 마일스톤 단계(tier)를 그대로 공유해서 쓴다(comboMilestoneTier 참조).
const COMBO_MILESTONES = [
  { value: 5, tier: 1 },
  { value: 10, tier: 2 },
  { value: 20, tier: 3 },
  { value: 30, tier: 4 },
  { value: 50, tier: 5 },
  { value: 100, tier: 6 },
];
let comboDisplayShownCombo = -1; // 마지막으로 화면에 반영한 combo 값(변화 없는 프레임은 건너뜀)
let comboDisplayTier = 0;
let comboPopTimeoutId = null;

// 콤보 값 -> 마일스톤 단계(0~6). 콤보 표시 색상과 자석 반경(MAGNET_RADIUS_BY_TIER)이 공유한다.
function comboMilestoneTier(combo) {
  let tier = 0;
  for (const m of COMBO_MILESTONES) if (combo >= m.value) tier = m.tier;
  return tier;
}

// 콤보 리셋: 목숨이 감소하는 시점에만 호출된다(loseLife, 전투 피격). 코인을 놓치거나
// 장애물에 스치기만 해서는(무적으로 막히면) 리셋되지 않는다.
function resetCombo() {
  if (rt.combo === 0 && !rt.magnetActive) return; // 이미 리셋 상태면 조용히 무시
  const hadMagnet = rt.magnetActive;
  rt.combo = 0;
  rt.magnetActive = false;
  if (hadMagnet) toast("🧲 콤보가 끊겨 코인 자석 효과가 사라졌습니다.");
}

function updateComboDisplay() {
  const combo = rt.combo || 0;
  if (combo === comboDisplayShownCombo) return; // 값이 안 바뀐 프레임은 DOM/애니메이션 재계산 생략
  const grew = combo > comboDisplayShownCombo;
  comboDisplayShownCombo = combo;

  const el = document.getElementById("combo-display");
  if (!el) return;

  if (combo <= 0) {
    el.classList.add("hidden");
    comboDisplayTier = 0;
    return;
  }
  el.classList.remove("hidden");
  document.getElementById("combo-value").textContent = combo;

  const tier = comboMilestoneTier(combo);
  if (tier !== comboDisplayTier) {
    comboDisplayTier = tier;
    for (const m of COMBO_MILESTONES) el.classList.remove(`combo-tier-${m.tier}`);
    if (tier > 0) el.classList.add(`combo-tier-${tier}`);
  }

  if (grew && COMBO_MILESTONES.some(m => m.value === combo)) {
    el.classList.add("combo-pop");
    if (comboPopTimeoutId) clearTimeout(comboPopTimeoutId);
    comboPopTimeoutId = setTimeout(() => { el.classList.remove("combo-pop"); comboPopTimeoutId = null; }, 160);
  }
}

/* ---------------------------- 코인/돈 획득 피드백(파티클+사운드) ----------------------------
   전투 씬 텔레그래프(⚠️)와 같은 톤을 사용: 부드러운 발광(shadowColor+shadowBlur) 위주로,
   콤보가 높을수록(§5-4-1 5/10단계) 입자 수·속도·글로우가 커지고 강조색이 섞인다. */

// 콤보 값 -> 강도 단계(0/1/2). 5, 10은 콤보 자석 임계치(COMBO_MAGNET_THRESHOLD)와 맞춘 기준점.
function comboFxTier(combo) {
  if (combo >= COMBO_MAGNET_THRESHOLD) return 2;
  if (combo >= 5) return 1;
  return 0;
}

const PICKUP_PARTICLE_TIERS = [
  { count: 6, speed: [60, 110], life: [0.32, 0.45], size: [2, 4], glow: 6 },
  { count: 10, speed: [90, 150], life: [0.38, 0.55], size: [2.5, 5], glow: 11 },
  { count: 16, speed: [120, 200], life: [0.5, 0.7], size: [3, 6], glow: 18 },
];
// 기본색은 기존 drawCoin/drawMoney 그라디언트, 강조색은 자석 발동 시 쓰이는 청록(#4fd0e0)과
// 몬스터 텔레그래프의 경고색(#ffcf3f) 계열을 재사용해 기존 톤과 통일감을 준다.
const PICKUP_COLORS = {
  coin: { base: ["#fff6c9", "#ffd23f", "#c97f00"], accent: "#ffcf3f" },
  money: { base: ["#d9f7c8", "#3aa66d", "#1a5c39"], accent: "#4fd0e0" },
};

function spawnPickupParticles(x, y, kind, combo) {
  const tier = comboFxTier(combo);
  const spec = PICKUP_PARTICLE_TIERS[tier];
  const palette = PICKUP_COLORS[kind];
  for (let i = 0; i < spec.count; i++) {
    const a = rand(0, Math.PI * 2);
    const speed = rand(spec.speed[0], spec.speed[1]);
    const useAccent = tier >= 1 && Math.random() < (tier === 2 ? 0.5 : 0.25);
    rt.particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 30,
      life: 0,
      maxLife: rand(spec.life[0], spec.life[1]),
      size: rand(spec.size[0], spec.size[1]),
      color: useAccent ? palette.accent : pick(palette.base),
      glow: spec.glow,
    });
  }
  if (tier === 2) {
    // 콤보 임계치 도달 순간엔 텔레그래프 경고 마크처럼 확장하는 글로우 링을 한 번 더 얹는다.
    rt.particles.push({ x, y, ring: true, life: 0, maxLife: 0.4, size: 6, maxSize: 46, color: palette.accent, glow: 24 });
  }
}

function updateParticles(dt) {
  for (const p of rt.particles) {
    p.life += dt;
    if (!p.ring) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt; // 중력
      p.vx *= Math.max(0, 1 - 3 * dt);
    }
  }
  rt.particles = rt.particles.filter(p => p.life < p.maxLife);
}

function renderParticles() {
  for (const p of rt.particles) {
    const t = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.glow;
    if (p.ring) {
      const rr = p.size + (p.maxSize - p.size) * t;
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// Web Audio API로 합성한 짧은 픽업 사운드 (별도 오디오 에셋 없이 재생). 코인=높은 마림바풍
// 톤(triangle), 돈=낮고 묵직한 톤(sine). 콤보 단계가 높을수록 음이 살짝 올라가고, 자석
// 임계치(tier 2)에서는 5도 화음이 한 번 더 얹혀 축포처럼 들린다.
let pickupAudioCtx = null;
function getPickupAudioCtx() {
  if (pickupAudioCtx) return pickupAudioCtx;
  try {
    pickupAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    pickupAudioCtx = null;
  }
  return pickupAudioCtx;
}

function playPickupSound(kind, tier) {
  const actx = getPickupAudioCtx();
  if (!actx) return;
  if (actx.state === "suspended") actx.resume();
  const now = actx.currentTime;

  const baseFreq = kind === "coin" ? 880 : 440;
  const freq = baseFreq * (1 + tier * 0.12);
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = kind === "coin" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.1 + tier * 0.03, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + tier * 0.03);
  osc.connect(gain); gain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 0.25 + tier * 0.05);

  if (tier >= 2) {
    const osc2 = actx.createOscillator();
    const gain2 = actx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * 1.5, now + 0.05);
    gain2.gain.setValueAtTime(0.0001, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.09, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc2.connect(gain2); gain2.connect(actx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.35);
  }
}

// 턴 정산 화면(코인 -> 보석)에서 보석이 늘어날 때마다 재생하는 짧은 벨 소리.
// playPickupSound와 같은 AudioContext(getPickupAudioCtx)를 재사용한다.
function playGemChime() {
  const actx = getPickupAudioCtx();
  if (!actx) return;
  if (actx.state === "suspended") actx.resume();
  const now = actx.currentTime;
  [1046.5, 1568.0].forEach((freq, i) => { // C6 -> G6 짧은 두음 벨
    const t0 = now + i * 0.02;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(gain); gain.connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  });
}

/* ---------------------------- 턴 정산(코인 -> 보석 전환) 화면 ---------------------------- */
// 몬스터를 처치해 턴이 끝날 때(§6, releaseCharge) endFlightTurn() 직전에 실행된다.
// 코인을 20개 단위로 보석으로 자동 교환하며, 화면(비행 루프)을 멈추고 애니메이션으로 보여준다.
const COIN_TO_GEM_RATE = 20;
const SETTLEMENT_START_DELAY_MS = 1500; // 화면이 뜨고 나서 전환 시작까지 대기 시간
const SETTLEMENT_END_DELAY_MS = 1500;   // 정산 완료(또는 변환할 코인 없음) 후 방 복귀까지 대기 시간
let settlementTimeoutId = null;

function pulseSettlementStat(el) {
  el.classList.remove("settlement-pulse");
  void el.offsetWidth; // 리플로우를 강제해 같은 클래스를 다시 붙여도 트랜지션이 재생되게 한다
  el.classList.add("settlement-pulse");
}

// 2P 모드에서는 P1 -> P2 순서로 각자의 코인을 독립적으로 정산한다(§6, 재화 완전 분리).
// 같은 애니메이션/DOM을 그대로 재사용하고 대상 플레이어만 바뀐다.
function startCoinSettlement() {
  rt.running = false; // 화면(비행 루프) 정지
  const modal = document.getElementById("modal-settlement");
  const coinEl = document.getElementById("settlement-coins");
  const gemEl = document.getElementById("settlement-gems");
  const coinStat = coinEl.parentElement;
  const gemStat = gemEl.parentElement;
  const labelEl = document.getElementById("settlement-player-label");
  modal.classList.remove("hidden"); // 교환할 코인이 없어도 화면 자체는 항상 거쳐간다

  const playerQueue = state.playerCount === 2 ? [1, 2] : [1];
  const walletFor = (p) => wallet(p) || state;
  let qi = 0;
  let remaining = 0;
  let tickMs = 0;
  let finished = false;

  function applyOneConversion() {
    const w = walletFor(playerQueue[qi]);
    w.coins -= COIN_TO_GEM_RATE;
    addGems(1, playerQueue[qi]); // 기존 보석 20개->트로피 전환 체인도 자연스럽게 함께 처리됨
    remaining -= 1;
    coinEl.textContent = w.coins;
    gemEl.textContent = w.gems;
  }

  // 정산 완료(변환할 코인이 없었던 경우 포함) 후 1.5초 뒤 방으로 복귀
  function finish() {
    if (finished) return;
    finished = true;
    if (settlementTimeoutId) { clearTimeout(settlementTimeoutId); settlementTimeoutId = null; }
    saveState();
    settlementTimeoutId = setTimeout(() => {
      settlementTimeoutId = null;
      modal.classList.add("hidden");
      endFlightTurn();
    }, SETTLEMENT_END_DELAY_MS);
  }

  function advanceOrFinish() {
    qi += 1;
    if (qi < playerQueue.length) { startPlayer(); return; }
    finish();
  }

  function tick() {
    if (finished) return;
    if (remaining <= 0) { advanceOrFinish(); return; }
    applyOneConversion();
    pulseSettlementStat(coinStat);
    pulseSettlementStat(gemStat);
    playGemChime();
    updateAllHUD();
    settlementTimeoutId = setTimeout(tick, tickMs);
  }

  function startPlayer() {
    const p = playerQueue[qi];
    const w = walletFor(p);
    coinEl.textContent = w.coins;
    gemEl.textContent = w.gems;
    if (labelEl) {
      labelEl.textContent = `P${p}`;
      labelEl.classList.toggle("hidden", playerQueue.length < 2);
    }
    const conversions = Math.floor(w.coins / COIN_TO_GEM_RATE);
    remaining = conversions;
    tickMs = conversions > 0 ? clamp(2200 / conversions, 70, 220) : 0; // 코인이 많아도 전체 애니메이션이 너무 길어지지 않도록
    if (conversions <= 0) {
      // 변환할 코인이 없어도 화면은 그대로 보여준 채, 다음 플레이어로 넘어가거나(2P) 곧바로
      // "정산 완료"로 간주한다(시작 지연은 건너뜀 - 할 일이 없으므로).
      advanceOrFinish();
    } else {
      settlementTimeoutId = setTimeout(tick, SETTLEMENT_START_DELAY_MS);
    }
  }

  document.getElementById("btn-skip-settlement").onclick = () => {
    if (finished) return;
    if (settlementTimeoutId) { clearTimeout(settlementTimeoutId); settlementTimeoutId = null; }
    for (; qi < playerQueue.length; qi++) {
      const w = walletFor(playerQueue[qi]);
      while (w.coins >= COIN_TO_GEM_RATE) { w.coins -= COIN_TO_GEM_RATE; addGems(1, playerQueue[qi]); }
      coinEl.textContent = w.coins;
      gemEl.textContent = w.gems;
    }
    updateAllHUD();
    finish();
  };

  startPlayer();
}

const MAGNET_PULL_SPEED = 650;

// 2인 플레이에서는 각 플레이어가 서로 다른 캐릭터/장착 날개를 쓸 수 있으므로 playerIdx로
// 구분한다. 인자를 생략하면(=기존 1인 플레이 호출부) 1P(=유일한 플레이어) 기준으로 동작한다.
function effectiveWing(playerIdx) {
  const p = playerAt(playerIdx || 1);
  if (p.tempWing) return p.tempWing;
  if (state.playerCount === 2) return p.playerIdx === 2 ? state.p2EquippedWing : state.p1EquippedWing;
  return state.equippedWing;
}
function effectiveCharacterId(playerIdx) {
  // 1인 플레이도 온보딩에서 고른 캐릭터(state.p1CharacterId)를 그대로 써야 한다 - "hero1"로
  // 고정하면 hero2/3를 선택해도 항상 hero1로 렌더링/썸네일 표시되는 버그였다(사용자 확정).
  if (state.playerCount !== 2) return state.p1CharacterId;
  return playerAt(playerIdx || 1).playerIdx === 2 ? state.p2CharacterId : state.p1CharacterId;
}
// 구름/하늘 날개처럼 화면 전체에 영향을 주는 연출은 2P 모드에서 두 플레이어 중 한 명이라도
// 해당 날개면 켠다(각자 따로 관리하지 않고 화면 공용으로 취급).
function anyPlayerHasWing(wingId) {
  return rt.players.some(p => effectiveWing(p.playerIdx) === wingId);
}

function difficultyLevel() {
  return Math.min(state.turnsCompleted, 15);
}

// 캐릭터 변경(§10)은 "다음 턴부터 적용"이므로 실제 반영은 여기, 새 턴이 시작되는 시점에만 한다.
function applyPendingCharacterChanges() {
  state.p1CharacterId = state.p1CharacterNextTurn;
  state.p2CharacterId = state.p2CharacterNextTurn;
}

function initPlayers() {
  const count = state.playerCount === 2 ? 2 : 1;
  rt.players = [];
  for (let i = 1; i <= count; i++) {
    const p = createPlayerState(i);
    p.x = vw() / 2 || 400;
    p.y = vh() / 2 + (count === 2 ? (i === 1 ? -90 : 90) : 0) || 300; // 2P는 위/아래로 갈라서 시작(1P/2P 라벨이 서로 안 겹칠 정도로 충분히 띄움)
    p.tx = p.x; p.ty = p.y;
    p.invuln = 1.0;
    rt.players.push(p);
  }
}

function startFlight() {
  applyPendingCharacterChanges();
  rt.entities = [];
  rt.spawnT = { coin: 0, money: 0.4, obstacle: 0.8, hazard: rand(HAZARD_SPAWN_MIN, HAZARD_SPAWN_MAX) };
  rt.turnTimer = 30; // TODO: 테스트용 임시 단축값(원래 60초). 완성 후 60으로 되돌릴 것.
  rt.battles = [];
  rt.clouds = [];
  rt.bgOffset = 0;
  rt.paused = false;
  rt.combo = 0;
  rt.magnetActive = false;
  rt.particles = [];
  rt.turnDuration = rt.turnTimer;
  rt.rainbowBridge = null;
  rt.keysDown = new Set();
  scheduleMiniEvents();
  comboDisplayShownCombo = -1;
  comboDisplayTier = 0;
  if (comboPopTimeoutId) { clearTimeout(comboPopTimeoutId); comboPopTimeoutId = null; }

  rt.turnGemBonusOnKill = state.mailFlags.nextTurnGemBonus;
  state.mailFlags.nextTurnGemBonus = false;
  saveState();
  if (rt.turnGemBonusOnKill) toast("⛏️ 보석 광산 정보! 이번 비행에서 몬스터를 처치하면 보석 1개 추가 획득!");

  switchScene("flight");
  resizeCanvas();
  // vw()/vh()는 canvas가 실제로 보이고 크기가 잡힌 뒤에야 올바른 값을 반환하므로(§1),
  // 이를 사용하는 initPlayers()는 switchScene/resizeCanvas 다음에 호출해야 한다 - 순서가
  // 바뀌면 최초 비행 시 플레이어가 화면 중앙이 아닌 구석에서 시작하는 문제가 있었다(실측 확인).
  initPlayers();
  document.getElementById("battle-banner").classList.add("hidden");
  document.getElementById("btn-weather").classList.toggle("hidden", !anyPlayerHasWing("sky"));
  renderInventoryBars();
  updateAllHUD();

  rt.running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endFlightTurn() {
  rt.running = false;
  state.turnsCompleted += 1;
  restRemaining = 300;
  state.fridgeDrinks = Math.min(5, state.fridgeDrinks + 1);
  reviveDeadPlayers(); // §신규-2: 다음 방 화면 진입 시점에 사망한 플레이어를 부활시킨다
  advanceChapter(); // §Ch: 비행 1턴 완료 = 다음 스토리 챕터로 진행(19장에서 정지)
  if (!state.mailbox.hasLetter) {
    // 2P는 편지 2통(플레이어별 독립 추첨)을, 1P는 기존처럼 1통만 미리 뽑아 둔다(§신규-4).
    state.mailbox = state.playerCount === 2
      ? { hasLetter: true, letterId: pick(LETTERS).id, letterId2: pick(LETTERS).id }
      : { hasLetter: true, letterId: pick(LETTERS).id, letterId2: null };
  }
  saveState();
  toast("⏱️ 비행 턴 종료! 방으로 귀환합니다. (상점 우편함을 확인해보세요)");
  switchScene("room");
}

// 비행 1턴 완료 = 다음 챕터로 진행(임시 매핑, §Ch 상단 주석 참조). 19장(엔딩)에서는 더
// 진행하지 않는다 - 19장 이후 엔딩 처리(빈 날개 전시대 등)는 별도 단계에서 구현한다.
function advanceChapter() {
  if (state.chapter < CHAPTER_COUNT) {
    // comicTiming:"after"인 챕터(§신규-날개7, 예: 14장)를 막 완료했다면, 그 컷신을 아직 못 봤으니
    // pendingDeferredComic에 담아둔다 - 다음 "비행 출발" 클릭 때 열리고, 그 뒤로 재생 불가
    // 챕터들이 이어서 묶여 보인다.
    const prev = chapterData(state.chapter);
    if (prev.comicTiming === "after") state.pendingDeferredComic = prev.n;
    state.chapter += 1;
    state.chapterImageShown = false;
  }
}

// 사망 상태(§신규-2)로 전투가 끝난 플레이어를 다음 방 화면 진입 시점에 되돌린다. 목숨을
// 회복시키는 기존 턴 시작/방 진입 규칙이 없으므로 최대 목숨(MAX_LIVES)까지 채워 부활시킨다.
function reviveDeadPlayers() {
  for (const p of rt.players) {
    if (!p.dead) continue;
    p.dead = false;
    p.invuln = 1.0;
    const w = wallet(p.playerIdx) || state;
    w.lives = MAX_LIVES;
  }
  saveState();
}

function triggerGameOver(reason) {
  rt.running = false;
  document.getElementById("gameover-text").textContent =
    `${reason} 목숨을 모두 잃었습니다.\n(코인은 초기화되며, 보석/돈/트로피/날개는 유지됩니다)`;
  document.getElementById("modal-gameover").classList.remove("hidden");
}

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("modal-gameover").classList.add("hidden");
  if (state.playerCount === 2) {
    state.p1Wallet.lives = START_LIVES; state.p1Wallet.coins = 0;
    state.p2Wallet.lives = START_LIVES; state.p2Wallet.coins = 0;
  } else {
    state.lives = START_LIVES;
    state.coins = 0;
  }
  restRemaining = 0;
  for (const p of rt.players) p.dead = false; // 게임오버 재시작 시 사망 플래그도 함께 초기화(§신규-2)
  saveState();
  switchScene("room");
});

/* ---------------------------- 입력 ---------------------------- */

// 마우스/터치 좌표는 화면(CSS px) 기준이므로, 카메라가 축소해서 보여주는 월드 좌표계로
// 변환하려면 현재 배율(currentViewScale, 회피/전투 화면이 서로 다름)을 곱해야 한다
// (화면 px * 배율 = 월드 px, render()의 확대와 반대 방향).
// 마우스/터치 이동은 1인 플레이 전용(§4). 2인 플레이는 방향키로만 움직인다(아래 keysDown).
canvas.addEventListener("mousemove", (e) => {
  if (state.playerCount !== 1) return;
  const r = canvas.getBoundingClientRect();
  const p = rt.players[0];
  if (!p) return;
  p.tx = clamp((e.clientX - r.left) * currentViewScale(), 24, vw() - 24);
  p.ty = clamp((e.clientY - r.top) * currentViewScale(), 24, vh() - 24);
});
canvas.addEventListener("touchmove", (e) => {
  if (state.playerCount !== 1) return;
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const p = rt.players[0];
  if (!t || !p) return;
  p.tx = clamp((t.clientX - r.left) * currentViewScale(), 24, vw() - 24);
  p.ty = clamp((t.clientY - r.top) * currentViewScale(), 24, vh() - 24);
  e.preventDefault();
}, { passive: false });

// 2P 방향키는 keysDown 집합에 눌림 상태만 기록하고, 실제 이동은 update()가 매 프레임 이
// 집합을 읽어 속도 기반으로 처리한다(§4) - keydown 반복 이벤트 타이밍에 의존하지 않는다.
window.addEventListener("keydown", (e) => {
  // 조작키 변경(§11) 대기 중이면 다음 keydown을 그대로 캡처하고 나머지 로직은 건너뛴다.
  if (rt.keyRebindTarget) { captureRebindKey(e.code); e.preventDefault(); return; }
  if (isAnyModalOpen()) return;

  if (currentScene === "flight") {
    rt.keysDown.add(e.code);
    if (state.playerCount === 2) {
      if (e.code === state.p1Keys.attack && inBattle()) { e.preventDefault(); if (!e.repeat) startCharge(1); }
      if (e.code === state.p2Keys.attack && inBattle()) { e.preventDefault(); if (!e.repeat) startCharge(2); }
    } else if (e.code === state.soloAttackKey && inBattle()) {
      e.preventDefault();
      if (!e.repeat) startCharge(1);
    }
  }

  // 방/상점의 1/2/3/4는 기존 그대로 roomActivePlayer 대상(무변경). 비행 중 1인 모드도 기존
  // 그대로 1/2/3/4 = P1(무변경). 비행 중 2인 모드에서는 이동키 손 위치에 맞춰 P1은 7/8/9/0,
  // P2는 1/2/3/4를 쓰며 각자 자기 인벤토리만 사용한다.
  if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
    const item = ITEMS[Number(e.code.slice(-1)) - 1];
    if (item) {
      if (currentScene === "flight" && state.playerCount === 2) useItem(item.id, 2);
      else useItem(item.id, currentScene === "flight" ? 1 : state.roomActivePlayer);
    }
  }
  if (currentScene === "flight" && state.playerCount === 2 && DIGIT_TO_ITEM_INDEX_P1[e.code] != null) {
    const item = ITEMS[DIGIT_TO_ITEM_INDEX_P1[e.code]];
    if (item) useItem(item.id, 1);
  }
});

// 키를 떼는 순간 그때까지 누르고 있던 시간만큼 차지 공격을 발사한다(§6, §7).
window.addEventListener("keyup", (e) => {
  rt.keysDown.delete(e.code);
  if (state.playerCount === 2) {
    if (e.code === state.p1Keys.attack) releaseCharge(1);
    if (e.code === state.p2Keys.attack) releaseCharge(2);
  } else if (e.code === state.soloAttackKey) {
    releaseCharge(1);
  }
});

document.getElementById("btn-weather").addEventListener("click", () => {
  document.getElementById("modal-weather").classList.remove("hidden");
});

// 테스트용: 턴이 끝나기 전에 즉시 턴을 종료하고 방으로 돌아간다.
document.getElementById("btn-exit-flight").addEventListener("click", () => {
  if (currentScene !== "flight") return;
  endFlightTurn();
});

// QA 테스트 버튼 3개(§신규-날개2) - DEBUG_MODE 주석 참조.
document.getElementById("btn-debug-next-chapter").addEventListener("click", () => {
  advanceChapter();
  saveState();
  renderRoom();
  settleRoomEntry();
});
document.getElementById("btn-debug-goto-elite").addEventListener("click", () => {
  if (currentScene !== "flight" || inBattle()) return;
  startTurnEndBattle();
});
document.getElementById("btn-debug-skip-boss").addEventListener("click", () => {
  if (!inBattle()) return;
  for (const b of [...rt.battles]) {
    b.shieldActive = false; // 날개지기 배리어 중이어도 즉시 승리 처리되도록 무시
    applyChargeProjectileHit(b, { x: b.x, y: b.y, dmg: 999999, angle: 0, stage: "full" }, 1);
  }
});
document.querySelectorAll(".weather-choice").forEach(btn => {
  btn.addEventListener("click", () => {
    rt.weather = btn.dataset.weather;
    document.getElementById("modal-weather").classList.add("hidden");
    toast(`🌤️ 날씨가 [${{sun:"해",rain:"비",cloud:"구름"}[rt.weather]}](으)로 바뀌었습니다.`);
  });
});
document.getElementById("btn-close-weather").addEventListener("click", () => {
  document.getElementById("modal-weather").classList.add("hidden");
});

/* ---------------------------- 스폰 ---------------------------- */

// 코인/돈/장애물 원근감: 스폰 시 scale 0.3(멀리)로 작게 시작해서, 스폰 후 경과 시간에
// 비례해 ease-in 곡선(t^2)으로 scale 1.0(가까이)까지 커진다. 이동 속도도 scale에 비례해
// 함께 느렸다가 빨라지므로 "멀리서 서서히 다가오는" 느낌을 준다. 몬스터/구름은 대상 아님.
const PERSPECTIVE_SCALE_START = 0.3;
const PERSPECTIVE_RAMP_SEC = 1.3;

// 코인 지그재그: 스폰되는 코인 중 일정 비율은 좌우(x축)로 sine파 흔들림을 타며 이동한다.
const COIN_ZIGZAG_CHANCE = 0.2;

// 장애물 플러리시: 스폰되는 장애물 중 일정 비율은 회전 또는 scale 펄스(순수 시각 효과,
// 충돌판정용 e.r/OBSTACLE_RADIUS에는 영향 없음) 연출을 갖는다.
const OBSTACLE_FLOURISH_CHANCE = 0.3;

// 코인 편대: 아주 가끔 코인 5~8개가 하트/별 모양으로 한 번에 스폰된다.
const FORMATION_CHANCE = 0.05;
const FORMATION_SHAPES = ["heart", "star"];

/* ---------------------------- 미니 이벤트 ----------------------------
   턴 시작(startFlight) 시 코인 폭풍/장애물 러시/무지개다리 중 1~2개를 겹치지 않는
   랜덤 시점에 예약한다. 지속시간은 초 단위로 고정하지 않고 "이번 턴 길이(rt.turnDuration)의
   15~25%"로 계산하므로, 테스트용 30초 턴이든 나중에 복원될 60초 턴이든 동일한 비율로
   자연스럽게 동작한다. */
const MINI_EVENT_TYPES = ["coin_storm", "obstacle_rush", "rainbow_bridge"];
const MINI_EVENT_DURATION_RATIO = [0.15, 0.25]; // 턴 길이 대비 지속시간 비율
const MINI_EVENT_MARGIN_RATIO = 0.08;           // 턴 시작/끝에 이벤트가 걸치지 않도록 두는 여백 비율
const MINI_EVENT_COUNT_CHOICES = [1, 2];        // 한 턴에 발동하는 이벤트 개수(1~2개)

const MINI_EVENT_LABEL = {
  coin_storm: "🌟 코인 폭풍! 장애물이 잠잠해지고 코인이 쏟아집니다!",
  obstacle_rush: "⚠️ 장애물 러시! 장애물이 몰려옵니다, 조심하세요!",
  rainbow_bridge: "🌈 무지개다리가 나타났습니다! 별을 따라가면 보너스!",
};
// 코인 폭풍/장애물 러시가 updateSpawns()의 스폰 간격에 곱하는 배율(작을수록 자주 스폰).
// coin_storm은 장애물 스폰을 아예 멈춘다(stopObstacles).
const MINI_EVENT_MODIFIERS = {
  coin_storm: { coinMul: 0.35, stopObstacles: true },
  obstacle_rush: { coinMul: 1.8, obstacleMul: 0.45 },
};

const RAINBOW_BRIDGE_STAR_COUNT = 7;
const RAINBOW_BRIDGE_STAR_COIN_BONUS = 3;
const RAINBOW_BRIDGE_COMPLETE_GEM_BONUS = 2;

function scheduleMiniEvents() {
  rt.miniEvents = [];
  rt.activeMiniEvent = null;
  const total = rt.turnDuration;
  if (!total || total <= 0) return;

  const count = pick(MINI_EVENT_COUNT_CHOICES);
  const types = [...MINI_EVENT_TYPES].sort(() => Math.random() - 0.5).slice(0, count);

  const margin = total * MINI_EVENT_MARGIN_RATIO;
  const usableStart = margin;
  const usableEnd = Math.max(usableStart, total - margin);
  const slice = (usableEnd - usableStart) / count;

  types.forEach((type, i) => {
    const duration = total * rand(MINI_EVENT_DURATION_RATIO[0], MINI_EVENT_DURATION_RATIO[1]);
    const slotStart = usableStart + slice * i;
    const slotEnd = usableStart + slice * (i + 1);
    const maxStart = Math.max(slotStart, slotEnd - duration);
    const startAt = rand(slotStart, maxStart);
    rt.miniEvents.push({ type, startAt, duration, triggered: false, ended: false });
  });
}

function updateMiniEvents(dt) {
  if (rt.miniEvents.length === 0) return;
  const elapsed = rt.turnDuration - rt.turnTimer;
  for (const ev of rt.miniEvents) {
    if (!ev.triggered && elapsed >= ev.startAt) {
      ev.triggered = true;
      startMiniEvent(ev);
    }
    if (ev.triggered && !ev.ended && elapsed >= ev.startAt + ev.duration) {
      ev.ended = true;
      endMiniEvent(ev);
    }
  }
}

function startMiniEvent(ev) {
  if (MINI_EVENT_MODIFIERS[ev.type]) rt.activeMiniEvent = ev.type;
  toast(MINI_EVENT_LABEL[ev.type]);
  if (ev.type === "rainbow_bridge") {
    rt.rainbowBridge = {
      total: RAINBOW_BRIDGE_STAR_COUNT,
      touched: 0,
      spawned: 0,
      spawnInterval: (ev.duration * 0.6) / RAINBOW_BRIDGE_STAR_COUNT,
      spawnT: 0,
      phase: rand(0, Math.PI * 2),
    };
  }
}

function endMiniEvent(ev) {
  if (rt.activeMiniEvent === ev.type) rt.activeMiniEvent = null;
  // 무지개다리는 별도 종료 처리 없음: 이미 스폰된 별은 rt.entities에 남아 평소처럼
  // 스크롤/수집되며, 별 하나하나가 즉시 보상을 주므로 정확한 종료 시점에 의존하지 않는다.
}

function spawnBridgeStar(rb) {
  const baseY = vh() / 2;
  const amp = Math.min(180, vh() * 0.28);
  const t = rb.total > 1 ? rb.spawned / (rb.total - 1) : 0;
  const y = clamp(baseY + Math.sin(rb.phase + t * Math.PI * 2) * amp, 40, vh() - 40);
  rt.entities.push({
    type: "bridgestar", x: vw() + 30, y,
    baseR: 20, scale: PERSPECTIVE_SCALE_START, r: 20 * PERSPECTIVE_SCALE_START,
    vy: 0, born: performance.now(),
  });
  rb.spawned += 1;
}

function updateRainbowBridge(dt) {
  const rb = rt.rainbowBridge;
  if (!rb || rb.spawned >= rb.total) return;
  rb.spawnT -= dt;
  if (rb.spawnT <= 0) {
    rb.spawnT = rb.spawnInterval;
    spawnBridgeStar(rb);
  }
}

function createCoinEntity(x, y, vy, opts = {}) {
  const e = { type: "coin", x, y, baseX: x, vy, born: performance.now(), baseR: 16 };
  e.scale = PERSPECTIVE_SCALE_START;
  e.r = e.baseR * e.scale;
  if (!opts.noZigzag && Math.random() < COIN_ZIGZAG_CHANCE) {
    e.zigzag = true;
    e.zigzagAmp = rand(40, 80);
    e.zigzagFreq = rand(2.5, 4.5);
    e.zigzagPhase = rand(0, Math.PI * 2);
  }
  return e;
}

// 하트 모양 위 n개 점 (표준 파라메트릭 하트 곡선을 화면 좌표계에 맞게 y 반전)
function formationHeartPoints(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x * 4.5, y * 4.5]);
  }
  return pts;
}

// 별 모양 위 n개 점 (바깥/안쪽 반지름을 번갈아 배치하는 별 폴리곤 꼭짓점)
function formationStarPoints(n) {
  const pts = [];
  const outerR = 70, innerR = 30;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return pts;
}

function spawnCoinFormation() {
  const shape = pick(FORMATION_SHAPES);
  const count = Math.floor(rand(5, 9)); // 5~8개
  const cx = vw() + 60;
  const cy = rand(140, vh() - 140);
  const points = shape === "heart" ? formationHeartPoints(count) : formationStarPoints(count);
  points.forEach(([dx, dy]) => {
    rt.entities.push(createCoinEntity(cx + dx, cy + dy, 0, { noZigzag: true }));
  });
}

function spawnEntity(type) {
  const y = rand(40, vh() - 40);
  if (type === "coin") { rt.entities.push(createCoinEntity(vw() + 30, y, rand(-10, 10))); return; }
  const base = { type, x: vw() + 30, y, r: 20, born: performance.now() };
  if (type === "money") { base.baseR = 18; base.vy = rand(-8, 8); }
  else if (type === "obstacle") {
    base.baseR = OBSTACLE_RADIUS;
    base.vy = rand(-20, 20);
    base.obstacleIdx = Math.floor(Math.random() * OBSTACLE_ICONS_PER_REGION);
    if (Math.random() < OBSTACLE_FLOURISH_CHANCE) {
      base.flourish = Math.random() < 0.5 ? "spin" : "pulse";
      if (base.flourish === "spin") {
        base.rotation = 0;
        base.spinSpeed = rand(1.2, 3.0) * (Math.random() < 0.5 ? -1 : 1);
      } else {
        base.pulseFreq = rand(1.5, 2.5);
        base.pulsePhase = rand(0, Math.PI * 2);
        base.pulseAmp = rand(0.12, 0.22);
      }
    }
  }
  else if (type === "hazard") {
    base.baseR = HAZARD_RADIUS;
    base.vy = rand(-10, 10);
    base.rotation = rand(0, Math.PI * 2);
    base.spinSpeed = rand(0.3, 0.6) * (Math.random() < 0.5 ? -1 : 1); // 소용돌이처럼 천천히 회전
  }
  if (base.baseR != null) {
    base.scale = PERSPECTIVE_SCALE_START;
    base.r = base.baseR * base.scale;
  }
  rt.entities.push(base);
}

// 2P 전용 난이도/보상 배율(§5) - playerCount===1이면 이 블록은 전혀 실행되지 않아 기존
// 1인 플레이 스폰 밸런스가 그대로 유지된다. 숫자를 스폰 로직 곳곳에 하드코딩하는 대신,
// 기존 간격 계산 직후 한 번만 나눠 빈도를 올린다(간격이 작을수록 자주 스폰).
const P2_OBSTACLE_SPAWN_MULTIPLIER = 1.6;
const P2_REWARD_SPAWN_MULTIPLIER = 1.5;

function updateSpawns(dt) {
  const diff = difficultyLevel();
  let coinInterval = Math.max(0.45, 0.9 - diff * 0.03);
  let moneyInterval = Math.max(1.4, 2.4 - diff * 0.06);
  let obstacleInterval = Math.max(0.7, 1.7 - diff * 0.06);

  if (state.playerCount === 2) {
    coinInterval /= P2_REWARD_SPAWN_MULTIPLIER;
    moneyInterval /= P2_REWARD_SPAWN_MULTIPLIER;
    obstacleInterval /= P2_OBSTACLE_SPAWN_MULTIPLIER;
  }

  // 미니 이벤트(코인 폭풍/장애물 러시)가 활성 중이면 스폰 간격에 배율을 적용한다.
  const mod = MINI_EVENT_MODIFIERS[rt.activeMiniEvent];
  const obstaclesStopped = !!(mod && mod.stopObstacles);
  if (mod) {
    if (mod.coinMul) coinInterval *= mod.coinMul;
    if (mod.obstacleMul) obstacleInterval *= mod.obstacleMul;
  }

  rt.spawnT.coin -= dt;
  if (rt.spawnT.coin <= 0) {
    if (Math.random() < FORMATION_CHANCE) spawnCoinFormation();
    else spawnEntity("coin");
    rt.spawnT.coin = coinInterval * rand(0.8, 1.2);
  }

  rt.spawnT.money -= dt;
  if (rt.spawnT.money <= 0) { spawnEntity("money"); rt.spawnT.money = moneyInterval * rand(0.8, 1.2); }

  if (obstaclesStopped) {
    // 코인 폭풍 동안은 장애물을 아예 스폰하지 않는다. spawnT.obstacle은 그대로 두어
    // 이벤트가 끝나면 멈췄던 지점부터 카운트다운을 이어간다.
  } else {
    rt.spawnT.obstacle -= dt;
    if (rt.spawnT.obstacle <= 0) { spawnEntity("obstacle"); rt.spawnT.obstacle = obstacleInterval * rand(0.8, 1.2); }
  }

  // 지역 이동 방해 엔티티(§8) - cloud/water/electric 지역에서만 스폰
  if (HAZARD_REGIONS.includes(currentRegionWingId())) {
    rt.spawnT.hazard -= dt;
    if (rt.spawnT.hazard <= 0) {
      spawnEntity("hazard");
      rt.spawnT.hazard = rand(HAZARD_SPAWN_MIN, HAZARD_SPAWN_MAX);
    }
  }

  updateRainbowBridge(dt);

  // 구름 날개용 은신 구름 - 2P는 둘 중 한 명이라도 구름 날개면 스폰(공용 화면 연출).
  if (anyPlayerHasWing("cloud")) {
    if (!rt._cloudT) rt._cloudT = 4;
    rt._cloudT -= dt;
    if (rt._cloudT <= 0) {
      rt.clouds.push({ x: vw() + 40, y: rand(40, vh() - 40), r: rand(50, 80) });
      rt._cloudT = rand(5, 8);
    }
  }
}

/* ---------------------------- 업데이트 ---------------------------- */

let lastTime = performance.now();

function loop(now) {
  if (!rt.running) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

// 플레이어 1명의 이동/타이머 갱신(§4, §6). 1인 플레이는 기존 마우스 목표점 보간, 2인
// 플레이는 rt.keysDown에 담긴 눌림 상태 기반 속도 이동을 쓴다.
function updatePlayerMovement(p, dt) {
  if (p.dead) return; // 사망한 플레이어는 이동/타이머 갱신 없음(§신규-2)
  let speed = state.playerCount === 2 ? 340 : 9; // 2P는 px/s 속도, 1P는 기존 lerp 계수(그대로 유지)
  // 슬로우필드(§6-3-8) 안에 있으면 이동속도만 낮춘다 - 데미지는 없음. 여러 몬스터가 있으면
  // 그중 하나라도 슬로우필드에 걸려 있으면 적용된다.
  for (const b of rt.battles) {
    if (b.slowField && Math.hypot(p.x - b.slowField.x, p.y - b.slowField.y) < b.slowField.r) {
      speed *= SLOWFIELD_SPEED_MUL;
      break;
    }
  }
  // 지역 이동 방해 엔티티(§8) - 데미지 없이 반경 안에서만 이동속도를 늦춘다.
  for (const e of rt.entities) {
    if (e.type === "hazard" && Math.hypot(p.x - e.x, p.y - e.y) < e.r) {
      speed *= HAZARD_SPEED_MUL;
      break;
    }
  }

  if (state.playerCount === 2) {
    const keys = p.playerIdx === 2 ? state.p2Keys : state.p1Keys;
    let dx = 0, dy = 0;
    if (rt.keysDown.has(keys.up)) dy -= 1;
    if (rt.keysDown.has(keys.down)) dy += 1;
    if (rt.keysDown.has(keys.left)) dx -= 1;
    if (rt.keysDown.has(keys.right)) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      p.facing = Math.atan2(dy, dx);
      p.x += (dx / len) * speed * dt;
      p.y += (dy / len) * speed * dt;
    }
  } else {
    // 마우스가 가리키는(=캐릭터가 실제로 이동해가는) 방향을 "바라보는 방향"으로 삼는다.
    // 제자리에 멈춰 있을 때(목표와 거리가 거의 0)는 마지막 방향을 그대로 유지한다.
    const moveDx = p.tx - p.x, moveDy = p.ty - p.y;
    if (Math.hypot(moveDx, moveDy) > 2) p.facing = Math.atan2(moveDy, moveDx);
    p.x += moveDx * Math.min(1, speed * dt);
    p.y += moveDy * Math.min(1, speed * dt);
  }
  p.x = clamp(p.x, 24, vw() - 24);
  p.y = clamp(p.y, 24, vh() - 24);

  if (p.invuln > 0) p.invuln -= dt;
  if (p.hiddenTimer > 0) p.hiddenTimer -= dt;

  if (p.moneyToGemTimer > 0) {
    p.moneyToGemTimer -= dt;
    if (p.moneyToGemTimer <= 0) { p.moneyToGemTimer = 0; toast("💺 돈-보석 전환 효과가 사라졌습니다."); }
  }
  if (p.tempWingTimer > 0) {
    p.tempWingTimer -= dt;
    if (p.tempWingTimer <= 0) {
      p.tempWing = null;
      toast("🐒 변신 효과가 사라졌습니다.");
    }
  }
  if (p.powerPenaltyTimer > 0) {
    p.powerPenaltyTimer -= dt;
    if (p.powerPenaltyTimer <= 0) { p.electricUseCount = 0; toast("⚡ 파워가 회복되었습니다."); }
  }
  if (p.charging) p.chargeT = Math.min(p.chargeT + dt, CHARGE_MAX_TIME);
}

function update(dt) {
  if (rt.paused) return; // 아이템(원숭이) 사용 등으로 일시정지된 경우 전체 로직 정지

  if (DEBUG_MODE) {
    const battling = inBattle();
    document.getElementById("btn-debug-goto-elite").classList.toggle("hidden", battling);
    document.getElementById("btn-debug-skip-boss").classList.toggle("hidden", !battling);
  }

  for (const p of rt.players) updatePlayerMovement(p, dt);
  // 자석은 더 이상 시간제가 아니라 콤보가 리셋될 때 resetCombo()에서 함께 꺼진다.
  updateParticles(dt);

  document.getElementById("btn-weather").classList.toggle("hidden", !anyPlayerHasWing("sky"));

  rt.bgOffset += dt * 20;

  if (inBattle()) {
    updateBattles(dt);
  } else {
    rt.turnTimer -= dt;
    if (rt.turnTimer <= 0) { rt.turnTimer = 0; startTurnEndBattle(); return; }
    updateMiniEvents(dt);
    updateSpawns(dt);
    updateEntities(dt);
  }

  updateAllHUD();
}

function updateEntities(dt) {
  const diff = difficultyLevel();
  const scrollSpeed = 200 + diff * 14;

  for (const c of rt.clouds) c.x -= scrollSpeed * 0.6 * dt;
  rt.clouds = rt.clouds.filter(c => c.x > -100);

  for (const p of rt.players) {
    const hiddenByCloud = effectiveWing(p.playerIdx) === "cloud" &&
      rt.clouds.some(c => Math.hypot(c.x - p.x, c.y - p.y) < c.r);
    if (hiddenByCloud) p.hiddenTimer = Math.max(p.hiddenTimer, 0.3);
  }

  for (const e of rt.entities) {
    if (e.baseR != null) {
      const elapsed = (performance.now() - e.born) / 1000;
      const t = clamp(elapsed / PERSPECTIVE_RAMP_SEC, 0, 1);
      const eased = t * t; // ease-in
      e.scale = PERSPECTIVE_SCALE_START + (1 - PERSPECTIVE_SCALE_START) * eased;
      e.r = e.baseR * e.scale;
    }
    const moveScale = e.scale != null ? e.scale : 1;

    // 장애물은 전체 스크롤 속도에 추가로 배율을 곱해 더 천천히 다가오게 한다(사용자 확정,
    // §신규-날개5) - 코인/돈/이동방해 엔티티는 기존 속도 그대로 유지.
    const entScroll = e.type === "obstacle" ? scrollSpeed * OBSTACLE_SPEED_MUL : scrollSpeed;
    if (e.zigzag) {
      e.baseX -= entScroll * moveScale * dt;
      const elapsed = (performance.now() - e.born) / 1000;
      e.x = e.baseX + Math.sin(elapsed * e.zigzagFreq + e.zigzagPhase) * e.zigzagAmp;
    } else {
      e.x -= entScroll * moveScale * dt;
    }
    e.y += (e.vy || 0) * dt;
    e.y = clamp(e.y, 30, vh() - 30);

    // 지역 이동 방해 엔티티 회전(순수 시각 효과)
    if (e.type === "hazard") {
      e.rotation = (e.rotation || 0) + e.spinSpeed * dt;
    }

    // 장애물 플러리시(순수 시각 효과 — e.r/충돌판정에는 관여하지 않음)
    if (e.flourish === "spin") {
      e.rotation = (e.rotation || 0) + e.spinSpeed * dt;
    } else if (e.flourish === "pulse") {
      const elapsed = (performance.now() - e.born) / 1000;
      e.pulseMul = 1 + Math.sin(elapsed * e.pulseFreq * Math.PI * 2 + e.pulsePhase) * e.pulseAmp;
    }

    // 코인 자석(콤보 10 보상, 콤보가 리셋될 때까지 유지): 마일스톤 단계가 높을수록
    // 반경이 넓어진다(MAGNET_RADIUS_BY_TIER). 2P는 더 가까운 플레이어 쪽으로 끌린다.
    if (rt.magnetActive && e.type === "coin") {
      let nearest = null, nd = Infinity;
      for (const p of rt.players) {
        if (p.dead) continue; // 사망한 플레이어는 자석 대상에서 제외(§신규-2)
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < nd) { nd = d; nearest = p; }
      }
      if (nearest) {
        const dx = nearest.x - e.x, dy = nearest.y - e.y;
        const radius = MAGNET_RADIUS_BY_TIER[comboMilestoneTier(rt.combo)] || MAGNET_RADIUS_BY_TIER[2];
        if (nd > 1 && nd < radius) {
          const pull = Math.min(nd, MAGNET_PULL_SPEED * dt);
          e.x += (dx / nd) * pull;
          e.y += (dy / nd) * pull;
        }
      }
    }
  }

  rt.entities = rt.entities.filter(e => {
    if (e.x < -50) return false; // 코인을 놓쳐도 콤보는 리셋되지 않음(목숨 감소 시에만 리셋, §5-4-1)
    // 이동 방해 엔티티(§8)는 "줍는" 대상이 아니다 - 부딪혀도 사라지지 않고, 화면 밖으로
    // 나갈 때만 제거된다. 감속 효과는 updatePlayerMovement()에서 매 프레임 별도로 체크한다.
    if (e.type === "hazard") return true;
    // 여러 플레이어 중 실제로 반경 안에 들어온 가장 가까운 쪽이 줍는다(§6, 보상 중복 없음 -
    // 엔티티 하나당 정확히 한 명에게만 적용).
    let picker = null, pd = Infinity;
    for (const p of rt.players) {
      if (p.dead) continue; // 사망한 플레이어는 장애물/코인/돈 충돌 대상에서 제외(§신규-2)
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < e.r + 18 && d < pd) { pd = d; picker = p; }
    }
    if (!picker) return true;

    if (e.type === "coin") {
      const gain = effectiveWing(picker.playerIdx) === "golden" ? 2 : 1;
      addCoins(gain, picker.playerIdx);
      spawnFloatText(e.x, e.y, `+${gain} 🪙`, "#e8b93b");
      rt.combo += 1;
      spawnPickupParticles(e.x, e.y, "coin", rt.combo);
      playPickupSound("coin", comboFxTier(rt.combo));
      // 콤보는 여기서 리셋하지 않는다 - 콤보 표시(§5-4-3)가 5/10/20/30/50/100 단위로 계속
      // 올라가야 하므로, 자석은 정확히 임계치를 "지나는 그 순간"에만 켜고 콤보가 리셋될
      // 때까지(resetCombo) 계속 유지한다.
      if (rt.combo === COMBO_MAGNET_THRESHOLD) {
        rt.magnetActive = true;
        toast(`🧲 콤보 ${COMBO_MAGNET_THRESHOLD} 달성! 콤보가 끊길 때까지 코인 자석이 유지됩니다!`);
      }
      return false;
    }
    if (e.type === "money") {
      if (picker.moneyToGemTimer > 0) {
        addGems(1, picker.playerIdx);
        spawnFloatText(e.x, e.y, "+1 💎", "#4fc3f7");
      } else {
        (wallet(picker.playerIdx) || state).money += 1;
        spawnFloatText(e.x, e.y, "+1 💰", "#3aa66d");
      }
      spawnPickupParticles(e.x, e.y, "money", rt.combo);
      playPickupSound("money", comboFxTier(rt.combo));
      saveState();
      return false;
    }
    if (e.type === "bridgestar") {
      addCoins(RAINBOW_BRIDGE_STAR_COIN_BONUS, picker.playerIdx);
      spawnFloatText(e.x, e.y, `⭐+${RAINBOW_BRIDGE_STAR_COIN_BONUS}`, "#ffd23f");
      spawnPickupParticles(e.x, e.y, "coin", 6); // 무지개다리 별은 항상 tier1 세기로 반짝임
      playPickupSound("coin", 1);
      if (rt.rainbowBridge) {
        rt.rainbowBridge.touched += 1;
        if (rt.rainbowBridge.touched >= rt.rainbowBridge.total) {
          addGems(RAINBOW_BRIDGE_COMPLETE_GEM_BONUS, picker.playerIdx);
          toast(`🌈 무지개다리 완주! 보너스 💎${RAINBOW_BRIDGE_COMPLETE_GEM_BONUS}`);
        }
      }
      saveState();
      return false;
    }
    if (e.type === "obstacle") {
      if (picker.invuln > 0) return true;
      picker.invuln = 1.0;
      const dead = loseLife(0.5, "장애물에 부딪혀", picker.playerIdx); // 콤보 리셋은 loseLife() 안에서 공통 처리(resetCombo)
      spawnFloatText(e.x, e.y, "-0.5 ❤️", "#e0503a");
      if (dead) rt.running = false;
      return false;
    }
    return true;
  });
}

let floatTexts = [];
function spawnFloatText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 1.0 });
}

/* ---------------------------- 전투(Battle) ---------------------------- */

// 비행 중 몬스터가 랜덤 스폰되는 로직은 완전히 제거되었다. 대신 rt.turnTimer가 0에
// 도달하면(§3-4) 이 함수가 호출되어 곧바로 턴 종료 전투로 진입한다. 몬스터는 현재
// 챕터의 지역 수호자 1종으로 고정된다(currentRegionMonster, §Ch) - basic 지역은 수호자가
// 없어 전투 자체가 없다. 체력/공격력은 몬스터별 개별 수치 없이 기존 diff 공식을 그대로 쓴다.
// MONSTER_HP_MULTIPLIER: 공격력/이동속도는 그대로 두고 체력만 일괄 6배로 올린다.
const MONSTER_HP_MULTIPLIER = 6;
const ELITE_WANDER_SPEED_MUL = 0.55; // 지역 수호자/보스 배회 이동속도 하향(사용자 확정, §신규-날개5)
// 1인 플레이는 기존처럼 몬스터 1마리, 2인 플레이는 매 턴 2마리(§5) - 서로 독립된 HP/위치/
// 공격 상태를 가지며 한 마리가 죽어도 나머지는 그대로 행동한다(rt.battles 배열).
function monsterCountForPlayerCount() {
  return state.playerCount === 2 ? 2 : 1;
}
function startTurnEndBattle() {
  const bossId = chapterData(state.chapter).boss;
  if (bossId) { startBossBattle(bossId); return; } // 11장/18장: 지역 수호자 대신 보스전(§P2)
  const monster = currentRegionMonster();
  if (!monster) { endFlightTurn(); return; } // basic 지역: 수호자 없음, 전투 없이 바로 턴 종료(§Ch)
  const count = monsterCountForPlayerCount();
  const names = [];
  for (let i = 0; i < count; i++) {
    const hp = (30 + difficultyLevel() * 4) * MONSTER_HP_MULTIPLIER;
    startBattle({ id: monster.id, name: monster.name, pattern: monster.pattern, hp, maxHp: hp }, i, count);
    names.push(monster.name);
  }
  toast(`⏰ 비행 시간 종료! ${names.join(", ")} 등장! 모두 처치해야 방으로 돌아갈 수 있습니다!`);
}

// 보스전(§P2) - 인원수와 무관하게 항상 1마리(2P여도 둘이 힘을 합쳐 같은 보스를 상대).
// startBattle()이 만든 표준 battle 객체(b)에 보스 전용 필드만 덧붙인다 - hp/보상/렌더 파이프라인은
// 기존 것을 그대로 재사용(§P2 사용자 확정: 승리 조건은 그냥 HP 0).
function startBossBattle(bossId) {
  const boss = BOSSES[bossId];
  const hp = (30 + difficultyLevel() * 4) * MONSTER_HP_MULTIPLIER * boss.hpMul;
  startBattle({ id: null, name: boss.name, pattern: boss.pattern, hp, maxHp: hp }, 0, 1);
  const b = rt.battles[rt.battles.length - 1];
  b.bossId = bossId;
  b.attackKind = boss.attackKind || null; // phaseAttackKinds가 있으면(천사) 매 캐스트마다 갱신됨
  b.phaseIdx = 0;
  b.wanderSeed *= boss.speedMul;
  if (boss.shieldOnDur) {
    b.shieldActive = false;
    b.shieldTimer = boss.shieldOffDur;
  }
  toast(`👑 ${boss.name} 등장! 처치해야 방으로 돌아갈 수 있습니다!`);
}

// 몬스터가 전투 중 배회할 수 있는 영역: 화면 우측 절반으로 제한(플레이어는 기존과 동일하게
// 화면 전체를 자유롭게 이동). 몬스터가 2마리(2P)면 이 영역을 위/아래로 나눠 배정해 초기
// 위치가 겹치지 않게 한다(§5) - b.slotIndex/slotCount는 startBattle에서 채워진다.
function monsterWanderBounds(b) {
  const xMin = vw() * 0.5 + 30, xMax = vw() - 40;
  const yMin = 140, yMax = vh() - 40;
  const slotCount = (b && b.slotCount) || 1;
  if (slotCount <= 1) return { xMin, xMax, yMin, yMax };
  const slotIndex = (b && b.slotIndex) || 0;
  const slotH = (yMax - yMin) / slotCount;
  return { xMin, xMax, yMin: yMin + slotH * slotIndex, yMax: yMin + slotH * (slotIndex + 1) };
}

function startBattle(monsterEntity, slotIndex, slotCount) {
  const b = {
    monsterId: monsterEntity.id || null,
    pattern: monsterEntity.pattern || "hover",
    hp: monsterEntity.hp,
    maxHp: monsterEntity.maxHp,
    slotIndex: slotIndex || 0, slotCount: slotCount || 1,
    // 2마리일 때 각자 다른 플레이어를 조준 기준으로 삼는다(§5) - 몬스터0->P1, 몬스터1->P2.
    // 실제 피격 판정은 targetPlayerIdx와 무관하게 rt.players 전원을 대상으로 한다(playerHitAt).
    targetPlayerIdx: (slotCount > 1 && slotIndex === 1 && rt.players[1]) ? 2 : 1,
    wanderT: rand(0, Math.PI * 2),
    wanderSeed: rand(0.85, 1.15) * ELITE_WANDER_SPEED_MUL, // 지역 수호자/보스 이동속도 하향(사용자 확정, §신규-날개5)
    vx: null,
    vy: null,
    telegraph: 0,
    shieldUsed: false,
    knockback: { x: 0, y: 0 }, // 완충 히트 시 부여되는 넉백 속도, 마찰로 감쇠
    attackKind: monsterAttackKind(monsterEntity.id), // 8종(§6-3)
    // 기본 공격(장애물 10종)과 특수 공격(몬스터 고유)은 서로 막지 않도록 완전히 독립된
    // 타이머/busy 플래그를 쓴다(§2) - 하나가 진행 중이어도 다른 하나는 자기 주기대로 시도한다.
    // 몬스터가 2마리일 때는 슬롯 인덱스만큼 살짝 지연을 둬 두 몬스터의 공격이 항상 같은
    // 타이밍에 겹치지 않게 한다(§5).
    baseAttackTimer: rand(BASE_ATTACK_INTERVAL_MIN, BASE_ATTACK_INTERVAL_MAX) + (slotIndex || 0) * 0.5,
    baseAttackBusy: false,
    specialAttackTimer: rand(SPECIAL_ATTACK_INTERVAL_MIN, SPECIAL_ATTACK_INTERVAL_MAX) + (slotIndex || 0) * 1.0,
    specialAttackBusy: false,
    dash: null,             // 몸통박치기 진행 상태
    monsterProjectiles: [], // 몬스터가 쏜 투사체/장애물 { x, y, vx, vy, angle, imgPath|img, hitRadius, source } (projectile/obstacleSummon/obstaclePattern/기본공격10종 공용, source로 구분)
    zone: null,             // 장판 위험구역 진행 상태
    minions: [],            // 소환된 부하들 { x, y, imgPath, life }
    slowField: null,        // 슬로우필드 진행 상태
    feint: null,            // 페인트(가짜 공격) 대기 상태
    basePattern: null,        // 공통 장애물 기본 공격(§6-4) 중 순차 스폰형 패턴의 진행 상태
    recentBasePatterns: [],   // 최근 사용한 공통 장애물 공격 id들(§6-6 반복 방지용)
  };
  // inBattle()(rt.battles.length>0)로 회피/전투 화면 배율(currentViewScale)이 갈리므로, 이
  // 몬스터 자신을 rt.battles에 먼저 등록한 뒤 위치를 계산해야 한다 - 그래야 2인 모드에서
  // 몬스터가 2마리 스폰될 때 첫 번째 몬스터도 (아직 전투 시작 전 취급되어 회피 화면 배율로
  // 계산되는 일 없이) 항상 전투 화면 배율의 vw()/vh() 기준으로 위치가 잡힌다.
  rt.battles.push(b);
  const bnd = monsterWanderBounds(b);
  b.x = (bnd.xMin + bnd.xMax) / 2;
  b.y = (bnd.yMin + bnd.yMax) / 2;
  for (const p of rt.players) { p.tx = vw() / 2 - 100; p.ty = vh() / 2; }
  document.getElementById("battle-banner").classList.remove("hidden");
}

// 몬스터별 배회 패턴. 배정된 영역(monsterWanderBounds(b))을 벗어나지 않도록 매 프레임
// b.x/b.y를 갱신한다. 같은 패턴이라도 wanderSeed(속도)·wanderT 시작 위상이 몬스터마다
// 달라 완전히 같은 움직임으로 보이지 않는다.
function updateMonsterWander(b, dt) {
  const bnd = monsterWanderBounds(b);
  b.wanderT += dt;
  const cx = (bnd.xMin + bnd.xMax) / 2;
  const cy = (bnd.yMin + bnd.yMax) / 2;
  const rx = (bnd.xMax - bnd.xMin) / 2;
  const ry = (bnd.yMax - bnd.yMin) / 2;
  const t = b.wanderT * b.wanderSeed;

  switch (b.pattern) {
    case "circle": // 넓게 원을 그리며 선회
      b.x = cx + Math.cos(t * 0.6) * rx * 0.85;
      b.y = cy + Math.sin(t * 0.6) * ry * 0.65;
      break;
    case "hover": // 좁은 범위에서 둥실둥실(8자形)
      b.x = cx + Math.sin(t * 0.9) * rx * 0.45;
      b.y = cy + Math.sin(t * 1.7) * ry * 0.35;
      break;
    case "zigzag": // 빠르고 각진 지그재그
      b.x = cx + Math.sin(t * 1.6) * rx * 0.85;
      b.y = cy + Math.sin(t * 3.1) * ry * 0.5;
      break;
    case "bounce": { // DVD 화면보호기처럼 대각선으로 튕김(속도 기반)
      if (b.vx == null) {
        b.vx = rx * 0.55 * (Math.random() < 0.5 ? -1 : 1);
        b.vy = ry * 0.55 * (Math.random() < 0.5 ? -1 : 1);
      }
      b.x += b.vx * dt * b.wanderSeed;
      b.y += b.vy * dt * b.wanderSeed;
      if (b.x < bnd.xMin || b.x > bnd.xMax) { b.vx *= -1; b.x = clamp(b.x, bnd.xMin, bnd.xMax); }
      if (b.y < bnd.yMin || b.y > bnd.yMax) { b.vy *= -1; b.y = clamp(b.y, bnd.yMin, bnd.yMax); }
      break;
    }
    case "pace": // 거의 일직선으로 천천히 좌우 왕복(땅 위 몬스터)
    default:
      b.x = cx + Math.sin(t * 0.5) * rx * 0.9;
      b.y = cy + Math.sin(t * 0.2) * ry * 0.12;
      break;
  }

  b.x = clamp(b.x, bnd.xMin, bnd.xMax);
  b.y = clamp(b.y, bnd.yMin, bnd.yMax);
}

function attackStatsForWing(wing) {
  let dmg = 10, cooldown = 0.45;
  if (wing === "rainbow") dmg *= 1.3;
  if (wing === "flame") dmg *= 1.2;
  if (wing === "water") { dmg *= 1.15; cooldown *= 0.9; }
  if (wing === "electric") cooldown *= 0.7;
  return { dmg, cooldown };
}

// ---------------------------- 차지 공격(검기, §6) ----------------------------
// 스페이스바를 누르고 있는 시간(0~2.0초)에 따라 데미지가 커지는 차지-릴리즈 공격.
// cooldown 기반 연타(구 playerAttack)는 이 방식으로 완전히 대체되었다 - attackStatsForWing의
// cooldown 필드는 더 이상 공격 페이스에 쓰이지 않고 dmg 배율만 재사용한다(아래 wingMult).
// 발사된 검기는 실제 위치를 가진 투사체(플레이어 소유, p.projectiles)로 존재하며, 몬스터
// 위치를 참조해 자동으로 조준/유도하지 않는다 - 캐릭터가 항상 오른쪽을 바라보는 스프라이트
// 이므로 검기도 항상 플레이어 위치에서 오른쪽 정면(각도 0)으로 고정 발사된다(p.facing은
// 이동 방향 추적용으로만 남아있고 여기서는 쓰지 않음). 몬스터가 없어도 그대로 발사되며,
// 실제로 몬스터와 부딪혀야만(updateChargeProjectiles의 충돌 판정) 데미지가 들어간다.
const CHARGE_MAX_TIME = 2.0;         // 이 이상 눌러도 데미지·이펙트는 더 커지지 않음(완충 상한)
const CHARGE_WEAK_THRESHOLD = 0.3;   // 0~0.3초는 약공격 데미지로 고정(짧게 눌러도 최소 타격 보장)
const CHARGE_MIN_DMG = 10;           // 약공격 기준 데미지(기존 기본 공격력과 동일)
// 완충(2.0초) 기준 데미지: attackStatsForWing의 기본 dmg(10)/cooldown(0.45초)이 "약공격 연타"의
// 실제 페이스(코드에 남아있는 유일한 연타 속도 기준값) - 2초간 연타 시 (2/0.45)*10 ≈ 44.4
// 데미지가 들어간다. 완충 1회가 그 1.3~1.5배가 되도록 60으로 올렸다(60/44.4 ≈ 1.35배).
// 날개별 배율(attackStatsForWing().dmg/10)은 연타·완충 양쪽에 동일하게 곱해지므로 이 비율은
// 날개가 달라져도(공격력만 다른 날개 기준) 그대로 유지된다.
const CHARGE_MAX_DMG = 60;
const CHARGE_KNOCKBACK = 260;        // 완충 히트 시 몬스터에게 주는 넉백 임펄스(px/s, updateBattle에서 마찰 감쇠)
const CHARGE_PROJECTILE_SPEED = 900; // 발사된 검기의 이동 속도(px/s)
const CHARGE_HIT_RADIUS = 55;        // 검기-몬스터 충돌 판정 반지름(px, MONSTER_BATTLE_HEIGHT=130 기준 대략치)

// 차지 시작: 이동속도(마우스/키 이동)는 이 상태와 무관하게 그대로 동작하므로 별도 페널티
// 코드 없음. playerIdx가 없으면(기존 1인 플레이 호출부) 1P로 취급한다.
function startCharge(playerIdx) {
  if (!inBattle() || isAnyModalOpen()) return;
  const p = playerAt(playerIdx || 1);
  if (p.dead || p.charging) return; // 사망한 플레이어는 공격 불가(§신규-2)
  p.charging = true;
  p.chargeT = 0;
}

// 차지 해제: 누르고 있던 시간에 따라 데미지를 계산해 두고, 플레이어 위치에서 항상
// 오른쪽 정면으로 실제 이동하는 검기 투사체를 하나 생성한다(몬스터 위치 참조/자동조준/유도
// 없음). 데미지는 여기서 바로 적용하지 않고, updateBattle의 충돌 판정에서 실제로 몬스터에
// 닿았을 때만 적용된다. 투사체에 ownerIdx/wing/charId를 태그해(§7) 어느 플레이어의 캐릭터·
// 날개·공격 배율을 썼는지, 처치 보상을 누구에게 줄지 나중에(applyChargeProjectileHit) 알 수 있다.
function releaseCharge(playerIdx) {
  const p = playerAt(playerIdx || 1);
  if (!p.charging) return;
  p.charging = false;
  const t = Math.min(p.chargeT, CHARGE_MAX_TIME);
  const isFull = t >= CHARGE_MAX_TIME;
  const wing = effectiveWing(p.playerIdx);

  let dmg;
  if (t <= CHARGE_WEAK_THRESHOLD) {
    dmg = CHARGE_MIN_DMG;
  } else {
    const ramp = (t - CHARGE_WEAK_THRESHOLD) / (CHARGE_MAX_TIME - CHARGE_WEAK_THRESHOLD);
    dmg = CHARGE_MIN_DMG + (CHARGE_MAX_DMG - CHARGE_MIN_DMG) * ramp;
  }
  dmg *= attackStatsForWing(wing).dmg / 10; // 날개별 공격력 배율(attackStatsForWing)을 그대로 곱함

  if (wing === "electric") {
    p.electricUseCount += 1;
    if (p.powerPenaltyTimer > 0) dmg *= 0.5;
    if (p.electricUseCount >= 10) {
      p.electricUseCount = 0;
      p.powerPenaltyTimer = 10;
      toast("⚡ 전기를 과하게 사용해 파워가 50% 감소합니다! (10초)");
    }
  }

  const angle = 0; // 항상 플레이어 위치에서 오른쪽 정면으로 직선 발사 (facing/조준/유도 사용 안 함)
  p.projectiles.push({
    x: p.x, y: p.y,
    vx: CHARGE_PROJECTILE_SPEED,
    vy: 0,
    angle,
    stage: isFull ? "full" : "weak",
    dmg,
    knockback: isFull,
    ownerIdx: p.playerIdx, wing, charId: effectiveCharacterId(p.playerIdx),
  });
}

// 검기 투사체가 몬스터에 실제로 부딪혔을 때만 호출된다(updateBattle). 기존
// releaseCharge()에 있던 즉시 데미지/처치 처리를 그대로 옮겨왔다. ownerIdx는 이 투사체를
// 쏜 플레이어(§7) - 처치 보상은 그 플레이어에게만 지급된다(§5, 보상 중복 없음).
function applyChargeProjectileHit(b, pr, ownerIdx) {
  if (b.shieldActive) { // 날개지기 배리어 활성 중엔 데미지가 통하지 않는다(§P2)
    spawnFloatText(pr.x, pr.y - 20, "막힘!", "#8ec9ff");
    return;
  }
  b.hp -= pr.dmg;
  spawnFloatText(pr.x, pr.y - 20, `-${Math.round(pr.dmg)}`, pr.stage === "full" ? "#ffcf3f" : "#fff");

  if (pr.knockback) {
    b.knockback.x += Math.cos(pr.angle) * CHARGE_KNOCKBACK;
    b.knockback.y += Math.sin(pr.angle) * CHARGE_KNOCKBACK;
  }

  if (b.hp <= 0) {
    const idx = rt.battles.indexOf(b);
    if (idx >= 0) rt.battles.splice(idx, 1);
    if (rt.battles.length === 0) document.getElementById("battle-banner").classList.add("hidden");
    const coinReward = pr.wing === "golden" ? 10 : 5;
    addCoins(coinReward, ownerIdx);
    (wallet(ownerIdx) || state).money += 3;
    playerAt(ownerIdx).invuln = 1.2;
    let rewardMsg = `⚔️ 몬스터 처치! 보상: 🪙${coinReward} 💰3`;
    // 날개 획득 방식 변경(사용자 확정, §신규-날개2): 트로피 교환이 아니라 그 지역 수호자를
    // 처치하면 그 지역 날개를 바로 획득한다. MONSTERS의 id가 곧 wingId라(§Ch) 별도 매핑 없이
    // b.monsterId를 그대로 쓴다 - 보스(bossId가 있음, monsterId는 null)는 대상에서 제외.
    if (!b.bossId && b.monsterId && WING_MAP[b.monsterId] && !state.ownedWings.includes(b.monsterId)) {
      state.ownedWings.push(b.monsterId);
      rewardMsg += ` 🪽[${WING_MAP[b.monsterId].name}] 획득!`;
    }
    if (rt.turnGemBonusOnKill) {
      rt.turnGemBonusOnKill = false;
      addGems(1, ownerIdx);
      rewardMsg += " 💎1(보석 광산 정보 보너스)";
    }
    saveState();
    toast(rewardMsg);
    // 몬스터를 랜덤 스폰하던 로직은 없어졌으므로, 전투는 항상 "턴 종료 전투"(§3-4)다.
    // 남은 몬스터가 모두 처치됐을 때만(rt.battles가 빔, §5) 턴 정산(코인->보석 전환)으로 넘어간다.
    if (rt.battles.length === 0) startCoinSettlement();
  }
}

// 몬스터 공격이 실제로 명중했을 때 공통으로 적용되는 결과(기존 로직 그대로) - 무적/무지개
// 방패를 먼저 확인하고, 막히지 않으면 그 플레이어의 목숨 -1·보석 -1 후 즉시 부활(또는
// 게임오버)한다. 몸통박치기/투사체/장판 등 모든 공격 패턴(§6-3)이 이 함수를 공유한다.
// hitIdx는 playerHitAt()이 찾아준 "실제로 맞은 플레이어"(1|2, 생략 시 1P).
function resolveMonsterHit(b, hitIdx) {
  if (DEBUG_MODE) return; // QA 테스트 모드: 목숨 무적(§신규-날개2)
  const p = playerAt(hitIdx || 1);
  if (p.dead || p.invuln > 0) return; // 사망/무적 중엔 회피(§신규-2 - playerHitAt이 이미 사망자를 걸러주지만 이중 방어)
  if (effectiveWing(p.playerIdx) === "rainbow" && b && !b.shieldUsed) {
    b.shieldUsed = true;
    toast("🌈 무지개 방패가 공격을 막았습니다!");
    return;
  }
  const w = wallet(p.playerIdx) || state;
  w.lives = Math.max(0, +(w.lives - 1).toFixed(1));
  w.gems = Math.max(0, w.gems - 1);
  resetCombo(); // loseLife()를 거치지 않는 경로라 여기서도 동일하게 콤보 리셋
  saveState();
  // 게임오버는 1인 플레이는 본인 목숨 0, 2인 플레이는 두 플레이어 모두 0일 때만(§Context).
  const overallDead = state.playerCount === 2 ? (getLives(1) <= 0 && getLives(2) <= 0) : w.lives <= 0;
  const who = state.playerCount === 2 ? `P${p.playerIdx} ` : "";
  if (w.lives <= 0) {
    p.dead = true;
    p.charging = false; p.chargeT = 0; // 진행 중이던 차지 공격은 즉시 취소(§신규-2)
  }
  if (overallDead) {
    triggerGameOver("몬스터에게 패배하여");
    return;
  }
  if (p.dead) {
    toast(`💀 ${who}쓰러졌습니다! (다음 방 진입 시 부활)`);
    return;
  }
  p.invuln = 1.2;
  toast(`💥 ${who}몬스터의 공격에 쓰러졌습니다! (목숨 -1, 보석 -1) 즉시 부활합니다.`);
}

// ---------------------------- 몬스터 공격 패턴 8종(§6-3, EFFECT_ASSETS/MONSTERS 기반) ----------------------------
const BODY_SLAM_HIT_RADIUS = 50;
const BODY_SLAM_OUT_DUR = 0.35;    // 좌측으로 돌진하는 데 걸리는 시간
const BODY_SLAM_RETURN_DUR = 0.5;  // 원래 있던 우측 절반 위치로 복귀하는 데 걸리는 시간
const BODY_SLAM_TARGET_X = 40;     // 돌진 목표 x(화면 왼쪽 끝 근처)
const MONSTER_PROJECTILE_SPEED = 500;
const MONSTER_PROJECTILE_HIT_RADIUS = 30;
const ZONE_RADIUS = 70;
const ZONE_DELAY = 1.0; // 위험구역 표시 후 데미지 판정까지 걸리는 시간
const OBSTACLE_THROW_SPEED = 480;               // 장애물소환/장애물패턴 공통 이동 속도
const OBSTACLE_HIT_RADIUS = 34;
const OBSTACLE_PATTERN_COUNT = 6;               // 장애물패턴 동시 스폰 개수
const OBSTACLE_PATTERN_SPREAD = Math.PI * 0.6;  // 장애물패턴 확산 각도 범위(라디안)
const MINION_HIT_RADIUS = 26;
const MINION_SPEED = 220;      // 부하가 플레이어를 향해 접근하는 속도(px/s)
const MINION_LIFETIME = 6.0;   // 이 시간 안에 플레이어에 닿지 못하면 회피로 소멸
const SLOWFIELD_DURATION = 4.0;
const SLOWFIELD_RADIUS = 90;
const SLOWFIELD_SPEED_MUL = 0.4; // 슬로우필드 안에서 이동속도 배율(update()의 플레이어 이동 로직이 참조)
const FEINT_CHANCE = 0.4;        // 페인트 몬스터가 텔레그래프 후 공격을 취소할 확률
const FEINT_PAUSE_MIN = 0.4, FEINT_PAUSE_MAX = 0.8; // 취소 후 진짜 공격까지의 텀

// 기본 공격(장애물 10종)/특수 공격(몬스터 고유) 재시도 간격(§2). 서로 다른 타이머를 쓰므로
// 한쪽이 진행 중이어도 다른 한쪽의 시도를 막지 않는다(updateBattle 참고).
const BASE_ATTACK_INTERVAL_MIN = 2, BASE_ATTACK_INTERVAL_MAX = 4;
const SPECIAL_ATTACK_INTERVAL_MIN = 6, SPECIAL_ATTACK_INTERVAL_MAX = 10;
// 난이도가 오를수록 두 공격 간격을 최대 25%까지 살짝 단축한다(화면 크기와는 무관 - §1과 분리).
function attackIntervalFactor() {
  return 1 - Math.min(1, difficultyLevel() / 15) * 0.25;
}

// 몸통박치기: 좌측으로 빠르게 돌진(경로상 플레이어와 겹치면 피격) -> 원래 있던 우측 절반
// 위치로 복귀. 진행 중에는 updateMonsterWander 대신 이 함수가 b.x/b.y를 직접 제어한다.
function updateBodySlam(b, dt) {
  const d = b.dash;
  d.t += dt;
  if (d.phase === "out") {
    const p = clamp(d.t / BODY_SLAM_OUT_DUR, 0, 1);
    b.x = d.fromX + (BODY_SLAM_TARGET_X - d.fromX) * p;
    b.y = d.fromY;
    if (!d.hasHit) {
      const hitIdx = playerHitAt(b.x, b.y, BODY_SLAM_HIT_RADIUS);
      if (hitIdx) { d.hasHit = true; resolveMonsterHit(b, hitIdx); }
    }
    if (p >= 1) { d.phase = "return"; d.t = 0; }
  } else {
    const p = clamp(d.t / BODY_SLAM_RETURN_DUR, 0, 1);
    b.x = BODY_SLAM_TARGET_X + (d.fromX - BODY_SLAM_TARGET_X) * p;
    b.y = d.fromY;
    if (p >= 1) b.dash = null;
  }
}

// 투사체/장애물소환/장애물패턴 공용: 캐스트 시점 방향으로 일직선 이동하다가 실제로
// 플레이어와 겹쳐야만 명중 처리된다(유도 없음). 몬스터 자신의 EFFECT_ASSETS 이미지
// (티어 반영 - effectAssetPath)를 쓰고, hitRadius는 스폰할 때 항목별로 지정한다.
// pr.motion이 없으면(기존 몬스터 고유 공격) vx/vy로 직선 이동하는 기존 방식 그대로다.
// pr.motion이 있으면(§6-4 공통 장애물 기본 공격 10종) pr.elapsed(이 dt를 누적한 경과 시간)를
// 기준으로 orbit(회전)/formation(대형 유지 이동)/sine(사인파)/pincer(위아래 조임) 궤적을
// 계산한다 - 다른 update*(b, dt) 함수들과 동일하게 시뮬레이션 dt를 누적하는 방식이라, 프레임이
// 밀리거나(rt.paused, 백그라운드 탭 스로틀 등) 실제 시간과 어긋나도 나머지 게임 로직과 같은
// 속도로 진행된다(performance.now() 실시간 기준으로 계산하면 이런 상황에서 어긋난다).
function updateMonsterProjectiles(b, dt) {
  const cwv = vw(), chv = vh();
  for (let i = b.monsterProjectiles.length - 1; i >= 0; i--) {
    const pr = b.monsterProjectiles[i];
    if (pr.motion) {
      pr.elapsed = (pr.elapsed || 0) + dt;
      const elapsed = pr.elapsed;
      if (pr.motion === "orbit") {
        const cx = pr.originX - pr.travelSpeed * elapsed;
        const ang = pr.angle0 + pr.angularSpeed * elapsed;
        pr.x = cx + Math.cos(ang) * pr.orbitR;
        pr.y = pr.originY + Math.sin(ang) * pr.orbitR;
        pr.angle = ang;
      } else if (pr.motion === "formation") {
        pr.x = pr.originX - pr.travelSpeed * elapsed + (pr.offsetX || 0);
        pr.y = pr.originY + (pr.offsetY || 0);
      } else if (pr.motion === "sine") {
        pr.x = pr.originX - pr.travelSpeed * elapsed;
        pr.y = pr.originY + Math.sin(elapsed * pr.waveFreq + (pr.wavePhase || 0)) * pr.waveAmp;
      } else if (pr.motion === "pincer") {
        const hump = Math.sin(clamp(elapsed / pr.squeezePeriod, 0, 1) * Math.PI);
        pr.x = pr.originX - pr.travelSpeed * elapsed;
        pr.y = pr.originY + pr.verticalDir * pr.squeezeAmp * hump;
      }
    } else {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
    }
    const offscreen = pr.x < -60 || pr.x > cwv + 60 || pr.y < -80 || pr.y > chv + 80;
    const hitIdx = !offscreen && playerHitAt(pr.x, pr.y, pr.hitRadius);
    if (offscreen || hitIdx) {
      b.monsterProjectiles.splice(i, 1);
      if (hitIdx) resolveMonsterHit(b, hitIdx);
    }
  }
}

// 미니언 소환: 부하 1~2마리가 스폰 지점에서 배정된 대상 플레이어(targetPlayer)를 향해 계속
// 접근(호밍)하다가 실제로 어떤 플레이어든 닿으면 그 부하만 소모되며 피격 처리된다. 일정
// 시간 안에 못 닿으면(회피) 소멸한다.
function updateMinions(b, dt) {
  const target = targetPlayer(b);
  for (let i = b.minions.length - 1; i >= 0; i--) {
    const m = b.minions[i];
    m.life -= dt;
    const dx = target.x - m.x, dy = target.y - m.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    m.x += (dx / dist) * MINION_SPEED * dt;
    m.y += (dy / dist) * MINION_SPEED * dt;
    const hitIdx = playerHitAt(m.x, m.y, MINION_HIT_RADIUS);
    if (hitIdx) {
      b.minions.splice(i, 1);
      resolveMonsterHit(b, hitIdx);
      continue;
    }
    if (m.life <= 0) b.minions.splice(i, 1); // 회피
  }
}

// 장판: 캐스트 시점 대상 플레이어 위치에 zone 이미지로 위험구역을 표시하고, ZONE_DELAY(1초)
// 뒤 그 자리에 어떤 플레이어든 그대로 있으면 피격(그 전에 움직여서 벗어나면 회피).
function updateZone(b, dt) {
  const z = b.zone;
  z.t += dt;
  if (z.t >= ZONE_DELAY) {
    const hitIdx = playerHitAt(z.x, z.y, z.r);
    b.zone = null;
    if (hitIdx) resolveMonsterHit(b, hitIdx);
  }
}

// 슬로우필드: 데미지는 없고, SLOWFIELD_DURATION 동안 그 자리에 감속 구역만 유지한다.
// 실제 감속 적용은 update()의 플레이어 이동 로직에서 b.slowField를 직접 참조한다.
function updateSlowField(b, dt) {
  b.slowField.t += dt;
  if (b.slowField.t >= SLOWFIELD_DURATION) b.slowField = null;
}

// 페인트: 대기(텀)가 끝나면 진짜 공격(몸통박치기)이 시작된다.
function updateFeintState(b, dt) {
  b.feint.t += dt;
  if (b.feint.t >= b.feint.dur) {
    b.feint = null;
    b.dash = { phase: "out", t: 0, fromX: b.x, fromY: b.y, hasHit: false };
  }
}

// ---------------------------- 공통 장애물 기본 공격 10종(§6-4) ----------------------------
// 몬스터 고유 공격(위 8종)은 그대로 두고, 매 공격 사이클마다 일정 확률로 "현재 턴 장애물
// 이미지"를 사용하는 공통 패턴 10종 중 하나를 대신 사용한다. 새 애니메이션 시스템을 따로 만들지
// 않고 기존 b.monsterProjectiles 배열 + updateMonsterProjectiles/renderMonsterProjectiles를
// 그대로 재사용하며, 회전/대형 유지/사인파 등 궤적만 pr.motion으로 얹었다(updateMonsterProjectiles 참고).
const BASE_ATTACK_TRAVEL_SPEED = 150; // 대형(원형/다이아몬드/벽 등)이 왼쪽으로 이동하는 속도(px/s)

function pickObstacleImage() {
  const arr = regionObstacleArr();
  return arr && arr.length ? pick(arr) : null;
}

// 공통 장애물 공격 전용 스폰 헬퍼: 현재 턴 장애물 이미지를 매번 무작위로 골라 붙인다
// (특정 장애물 하나만 계속 쓰지 않도록). 기존 obstacleSummon/obstaclePattern과 동일한
// hitRadius(OBSTACLE_HIT_RADIUS)를 재사용해 장애물 정적 충돌판정과는 별개 채널로 관리한다.
function pushObstacleProjectile(b, x, y, opts) {
  b.monsterProjectiles.push(Object.assign({
    x, y, vx: 0, vy: 0, angle: 0,
    hitRadius: OBSTACLE_HIT_RADIUS,
    img: pickObstacleImage(),
    elapsed: 0,
    originX: x, originY: y,
    source: "base", // baseAttackBusy와 무관하게 specialAttackBusy 판정에서 골라낼 수 있도록 표시
  }, opts));
}

// 패턴 1. 원형 롤링: 장애물 5개가 간격을 유지하며 회전하는 대형 전체가 왼쪽으로 이동.
function castRingRotate(b) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    pushObstacleProjectile(b, b.x, b.y, {
      motion: "orbit", travelSpeed: BASE_ATTACK_TRAVEL_SPEED,
      orbitR: 55, angle0: (i / n) * Math.PI * 2, angularSpeed: 1.8,
    });
  }
}

// 패턴 2. 다이아몬드 대형: 장애물 5개가 다이아몬드 형태를 유지한 채 왼쪽으로 직선 이동(추적 없음).
function castDiamondFormation(b) {
  const offsets = [[0, -55], [-38, 0], [38, 0], [0, 55], [0, 0]];
  for (const [ox, oy] of offsets) {
    pushObstacleProjectile(b, b.x, b.y, {
      motion: "formation", travelSpeed: BASE_ATTACK_TRAVEL_SPEED, offsetX: ox, offsetY: oy,
    });
  }
}

// 패턴 3. 5연발 x 3세트: 세트마다(3초 간격) 그 순간 플레이어 위치로 초기 방향만 다시 잡고,
// 같은 방향으로 5발을 빠르게(0.07초 간격) 연속 발사한다. 발사 후에는 유도하지 않는다.
function castBurst5x3(b) {
  const shotsPerSet = 5, sets = 3, shotGap = 0.07, setGap = 3.0;
  const spawnTimes = [];
  for (let s = 0; s < sets; s++) for (let k = 0; k < shotsPerSet; k++) spawnTimes.push(s * setGap + k * shotGap);
  b.basePattern = {
    t: 0, nextIdx: 0, spawnTimes, currentAngle: 0,
    spawnFn: (idx) => {
      if (idx % shotsPerSet === 0) {
        const tp = targetPlayer(b);
        b.basePattern.currentAngle = Math.atan2(tp.y - b.y, tp.x - b.x);
      }
      const a = b.basePattern.currentAngle;
      pushObstacleProjectile(b, b.x, b.y, {
        vx: Math.cos(a) * OBSTACLE_THROW_SPEED, vy: Math.sin(a) * OBSTACLE_THROW_SPEED, angle: a,
      });
    },
  };
}

// 패턴 4. 부채꼴 확산탄: 기존 obstaclePattern 공격과 동일한 방식(위/중앙/아래로 퍼지는 부채꼴)을
// 그대로 재사용하되 5~7개로 스폰한다.
function castFanSpread(b) {
  const count = Math.floor(rand(5, 8));
  const spread = Math.PI * 0.6;
  const tp = targetPlayer(b);
  const baseAngle = Math.atan2(tp.y - b.y, tp.x - b.x);
  for (let i = 0; i < count; i++) {
    const a = baseAngle - spread / 2 + (spread * i) / (count - 1);
    pushObstacleProjectile(b, b.x, b.y, {
      vx: Math.cos(a) * OBSTACLE_THROW_SPEED, vy: Math.sin(a) * OBSTACLE_THROW_SPEED, angle: a,
    });
  }
}

// 패턴 5. 세로 벽: 화면 오른쪽에서 위~아래로 장애물을 세로로 배치한 벽이 왼쪽으로 이동.
// 슬롯 간격이 너무 좁아지지 않도록 화면 높이에 맞춰 슬롯 수를 조절하고, 1~2곳은 반드시 비워둔다.
function castVerticalWall(b) {
  const top = 50, bottom = vh() - 50;
  const range = Math.max(100, bottom - top);
  const slots = clamp(Math.floor(range / 60) + 1, 4, 7);
  const step = range / (slots - 1);
  const gapCount = (slots >= 6 && Math.random() < 0.4) ? 2 : 1;
  const gapStart = Math.floor(rand(1, Math.max(2, slots - gapCount - 1)));
  const spawnX = vw() + 20;
  for (let i = 0; i < slots; i++) {
    if (i >= gapStart && i < gapStart + gapCount) continue; // 통과 가능한 틈
    pushObstacleProjectile(b, spawnX, top + step * i, { motion: "formation", travelSpeed: 140 });
  }
}

// 패턴 6. 지그재그 행렬: 장애물 5~7개가 위/아래로 번갈아 배치된 채 대형 전체가 왼쪽으로 이동.
function castZigzagMatrix(b) {
  const count = Math.floor(rand(5, 8));
  const spacingX = 70, amp = 90;
  const spawnX = vw() + 20;
  const baseY = clamp(b.y, 100, vh() - 100);
  for (let i = 0; i < count; i++) {
    pushObstacleProjectile(b, spawnX, baseY, {
      motion: "formation", travelSpeed: BASE_ATTACK_TRAVEL_SPEED,
      offsetX: i * spacingX, offsetY: (i % 2 === 0 ? -1 : 1) * amp,
    });
  }
}

// 패턴 7. 회전 십자: 장애물 4~5개가 십자 형태로, 이동하는 중심을 기준으로 천천히 회전.
function castRotatingCross(b) {
  const n = Math.random() < 0.5 ? 4 : 5;
  for (let i = 0; i < n; i++) {
    pushObstacleProjectile(b, b.x, b.y, {
      motion: "orbit", travelSpeed: BASE_ATTACK_TRAVEL_SPEED,
      orbitR: i < 4 ? 60 : 0, angle0: (i / 4) * Math.PI * 2, angularSpeed: 1.0,
    });
  }
}

// 패턴 8. 시간차 직선탄: 위/중간/아래 높이를 번갈아가며 0.3~0.5초 간격으로 한 발씩 순차 발사.
function castStaggeredLine(b) {
  const count = Math.floor(rand(5, 8));
  const heights = [vh() * 0.2, vh() * 0.5, vh() * 0.8];
  const spawnTimes = [];
  let acc = 0;
  for (let i = 0; i < count; i++) { spawnTimes.push(acc); acc += rand(0.3, 0.5); }
  const spawnX = vw() + 20;
  b.basePattern = {
    t: 0, nextIdx: 0, spawnTimes,
    spawnFn: (idx) => {
      pushObstacleProjectile(b, spawnX, heights[idx % heights.length], {
        vx: -OBSTACLE_THROW_SPEED * 0.85, vy: 0, angle: Math.PI,
      });
    },
  };
}

// 패턴 9. 양쪽 조임: 위/아래에서 등장한 장애물 무리가 왼쪽으로 진행하며 중앙 통로를 서서히
// 좁혔다가 다시 넓힌다(사인 형태 hump). 플레이어를 추적하지 않는다.
function castPincerSqueeze(b) {
  const squeezeAmp = Math.min(90, vh() * 0.18);
  const squeezePeriod = 2.2;
  const spawnX = vw() + 20;
  for (let i = 0; i < 3; i++) {
    pushObstacleProjectile(b, spawnX + i * 50, rand(30, 90), {
      motion: "pincer", travelSpeed: BASE_ATTACK_TRAVEL_SPEED, verticalDir: 1, squeezeAmp, squeezePeriod,
    });
  }
  for (let i = 0; i < 3; i++) {
    pushObstacleProjectile(b, spawnX + i * 50, rand(vh() - 90, vh() - 30), {
      motion: "pincer", travelSpeed: BASE_ATTACK_TRAVEL_SPEED, verticalDir: -1, squeezeAmp, squeezePeriod,
    });
  }
}

// 패턴 10. 웨이브/사인파: 0.25~0.35초 간격으로 장애물을 연속 생성, 각각 왼쪽으로 이동하며
// 위상이 조금씩 다른 사인파 궤적을 그린다.
function castSineWave(b) {
  const count = Math.floor(rand(5, 9));
  const spawnTimes = [];
  let acc = 0;
  for (let i = 0; i < count; i++) { spawnTimes.push(acc); acc += rand(0.25, 0.35); }
  const spawnX = vw() + 20;
  const baseY = clamp(b.y, 100, vh() - 100);
  b.basePattern = {
    t: 0, nextIdx: 0, spawnTimes,
    spawnFn: (idx) => {
      pushObstacleProjectile(b, spawnX, baseY, {
        motion: "sine", travelSpeed: 170, waveAmp: rand(50, 80), waveFreq: rand(1.4, 2.2), wavePhase: idx * 0.7,
      });
    },
  };
}

const BASE_ATTACK_CASTERS = {
  ring_rotate: castRingRotate,
  diamond_formation: castDiamondFormation,
  burst_5x3: castBurst5x3,
  fan_spread: castFanSpread,
  vertical_wall: castVerticalWall,
  zigzag_matrix: castZigzagMatrix,
  rotating_cross: castRotatingCross,
  staggered_line: castStaggeredLine,
  pincer_squeeze: castPincerSqueeze,
  sine_wave: castSineWave,
};
// 난이도(§6-6): 기존 턴 카운트(state.turnsCompleted)를 그대로 활용해 초반엔 4종(1/2/3/8),
// 중반엔 3종(4/5/6) 추가, 후반엔 나머지 3종(7/9/10)까지 열린다 - 새 난이도 체계를 따로 만들지 않는다.
const BASE_ATTACK_STAGE_UNLOCK = {
  ring_rotate: 1, diamond_formation: 1, burst_5x3: 1, staggered_line: 1,
  fan_spread: 7, vertical_wall: 7, zigzag_matrix: 7,
  rotating_cross: 15, pincer_squeeze: 15, sine_wave: 15,
};
const BASE_ATTACK_RECENT_MEMORY = 2; // 최근 이만큼의 패턴은 다시 뽑지 않아 반복을 줄인다

function availableBasePatterns() {
  const turnNumber = state.turnsCompleted + 1;
  return Object.keys(BASE_ATTACK_CASTERS).filter(id => turnNumber >= BASE_ATTACK_STAGE_UNLOCK[id]);
}

function chooseBasePattern(b) {
  const recent = b.recentBasePatterns || [];
  const pool = availableBasePatterns();
  const fresh = pool.filter(id => !recent.includes(id));
  const id = pick(fresh.length ? fresh : pool);
  b.recentBasePatterns = [...recent, id].slice(-BASE_ATTACK_RECENT_MEMORY);
  return id;
}

// 5연발x3세트/시간차 직선탄/웨이브처럼 한 번에 다 쏘지 않고 시간차를 두고 순차 스폰하는
// 패턴의 진행 상태(b.basePattern)를 갱신한다. 나머지 패턴은 캐스트 시점에 전부 스폰을
// 마치므로 이 함수를 거치지 않는다(완료 판정은 기존처럼 monsterProjectiles가 빌 때 처리).
function updateBasePattern(b, dt) {
  const bp = b.basePattern;
  if (!bp) return;
  bp.t += dt;
  while (bp.nextIdx < bp.spawnTimes.length && bp.t >= bp.spawnTimes[bp.nextIdx]) {
    bp.spawnFn(bp.nextIdx);
    bp.nextIdx += 1;
  }
  if (bp.nextIdx >= bp.spawnTimes.length) b.basePattern = null;
}

// 여러 몬스터(rt.battles, §5)를 매 프레임 각각 갱신한다 - 몬스터별 로직(updateBattle)은
// 그대로 재사용하고 순회만 새로 감쌌다. 차지 투사체는 몬스터가 아니라 "플레이어" 소유라(§7)
// 배틀별로 반복하지 않고 여기서 한 번만 갱신해 살아있는 모든 몬스터와 충돌 검사한다.
function updateBattles(dt) {
  updateChargeProjectiles(dt);
  for (const b of rt.battles.slice()) updateBattle(b, dt); // slice(): 콜백 중 배열이 바뀌어도 안전
}

// 검기 투사체 이동 + 충돌 판정(§7). 몬스터 위치를 조준에 쓰지 않는다 - 이미 releaseCharge()에서
// 고정된 방향(vx/vy)으로 직선 이동만 하고, 여기서는 매 프레임 위치를 갱신해 실제로 몬스터와
// 겹치는지만 확인한다. 화면 밖으로 나가면 그냥 제거. 플레이어 한 명의 투사체는 살아있는
// 모든 몬스터와 충돌 검사한다(2P 협공 허용, 몬스터당 한 발만 명중 처리).
function updateChargeProjectiles(dt) {
  const w = vw(), h = vh();
  for (const p of rt.players) {
    for (let i = p.projectiles.length - 1; i >= 0; i--) {
      const pr = p.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.x < -60 || pr.x > w + 60 || pr.y < -60 || pr.y > h + 60) {
        p.projectiles.splice(i, 1);
        continue;
      }
      for (const b of rt.battles) {
        if (Math.hypot(pr.x - b.x, pr.y - b.y) < CHARGE_HIT_RADIUS) {
          p.projectiles.splice(i, 1);
          applyChargeProjectileHit(b, pr, pr.ownerIdx);
          break;
        }
      }
    }
  }
}

// 몬스터 몸통 접촉 피해(§신규-6): 장애물 충돌(updateEntities의 e.type==="obstacle" 분기)과
// 완전히 동일한 패턴을 재사용한다 - invuln>0이면 무시하고, 맞으면 invuln=1.0으로 세팅해
// 겹쳐있는 동안 매 프레임 반복 피해가 들어가지 않게 한다(무적이 풀리고도 계속 닿아있으면
// 다시 적용). 데미지/무적 시간 수치도 장애물과 동일(0.5 목숨, 1.0초). 2P에서는 실제로 닿은
// 플레이어만 개별적으로 판정하며(사망자는 제외), 몬스터가 2마리여도 각자 독립적으로 검사한다.
const MONSTER_BODY_HIT_RADIUS = 60; // MONSTER_BATTLE_HEIGHT(130)/CHARGE_HIT_RADIUS(55) 기준 근접치
function updateMonsterBodyContact(b) {
  for (const p of rt.players) {
    if (p.dead || p.invuln > 0) continue;
    if (Math.hypot(p.x - b.x, p.y - b.y) >= MONSTER_BODY_HIT_RADIUS) continue;
    p.invuln = 1.0;
    const dead = loseLife(0.5, "몬스터 몸통에 부딪혀", p.playerIdx);
    spawnFloatText(p.x, p.y - 20, "-0.5 ❤️", "#e0503a");
    if (dead) rt.running = false;
  }
}

function updateBattle(b, dt) {
  // 날개지기 배리어(§P2): 켜짐/꺼짐을 주기적으로 반복한다 - 켜진 동안은 공격이 통하지 않는다
  // (applyChargeProjectileHit에서 확인). 결계를 뚫는 타이밍을 노려야 하는 방어 중심 보스 연출.
  if (b.shieldTimer != null) {
    b.shieldTimer -= dt;
    if (b.shieldTimer <= 0) {
      const boss = BOSSES[b.bossId];
      b.shieldActive = !b.shieldActive;
      b.shieldTimer = b.shieldActive ? boss.shieldOnDur : boss.shieldOffDur;
      toast(b.shieldActive ? "🛡️ 날개지기가 결계를 펼쳤습니다!" : "💥 결계가 풀렸습니다! 지금 공격하세요!");
    }
  }

  const wasDashing = !!b.dash;
  if (b.dash) updateBodySlam(b, dt); else updateMonsterWander(b, dt);
  // 몸통박치기(dash) 중엔 그 전용 충돌(BODY_SLAM_HIT_RADIUS, resolveMonsterHit)이 이미
  // 판정하므로 중복 피해를 막기 위해 몸통 접촉(§신규-6)은 배회/복귀 중일 때만 적용한다.
  if (!wasDashing) updateMonsterBodyContact(b);
  // 완충 히트 넉백: wander가 계산한 위치 위에 임펄스를 얹고 마찰로 감쇠시킨다
  // (다음 프레임에도 wander/몸통박치기가 b.x/b.y를 다시 계산하므로 매 프레임 새로 더해줘야 한다).
  if (b.knockback.x !== 0 || b.knockback.y !== 0) {
    b.x += b.knockback.x * dt;
    b.y += b.knockback.y * dt;
    const bnd = monsterWanderBounds(b);
    b.x = clamp(b.x, bnd.xMin, bnd.xMax);
    b.y = clamp(b.y, bnd.yMin, bnd.yMax);
    const friction = clamp(1 - dt * 4, 0, 1);
    b.knockback.x *= friction;
    b.knockback.y *= friction;
    if (Math.hypot(b.knockback.x, b.knockback.y) < 5) { b.knockback.x = 0; b.knockback.y = 0; }
  }

  updateMonsterProjectiles(b, dt);
  updateMinions(b, dt);
  if (b.zone) updateZone(b, dt);
  if (b.slowField) updateSlowField(b, dt);
  if (b.feint) updateFeintState(b, dt);
  if (b.basePattern) updateBasePattern(b, dt);

  // 기본 공격(장애물 10종)과 특수 공격(몬스터 고유 8종)은 완전히 독립된 타이머로 굴러간다(§2) -
  // 한쪽이 진행 중이라고 해서 다른 한쪽의 시도 주기가 멈추지 않는다. 다만 두 공격이 정확히 같은
  // 프레임에 겹쳐 시작되는 것만 살짝 피한다(아래 baseFiredThisTick).
  //
  // 완료 판정은 두 트랙이 서로 다르다:
  // - 기본 공격: 순차 스폰형 패턴(burst_5x3/staggered_line/sine_wave)이 basePattern으로 진행
  //   중일 때만 busy로 본다. 이미 스폰된 장애물이 화면을 다 가로지르는 것까지 기다리면
  //   대기시간이 지나치게 길어지므로(§2), 스폰이 끝나는 즉시 다음 시도를 받아들인다.
  // - 특수 공격: 기존과 동일하게 dash/zone/slowField/feint/minions/자신이 쏜 투사체
  //   (source !== "base")가 모두 끝나야 busy가 풀린다 - 장판/슬로우필드처럼 의도된 지속시간이
  //   있는 연출이라 여기서는 그대로 유지한다.
  if (b.baseAttackBusy && !b.basePattern) {
    b.baseAttackBusy = false;
    b.baseAttackTimer = rand(BASE_ATTACK_INTERVAL_MIN, BASE_ATTACK_INTERVAL_MAX) * attackIntervalFactor();
  }
  const specialProjCount = b.monsterProjectiles.reduce((n, p) => n + (p.source === "base" ? 0 : 1), 0);
  if (b.specialAttackBusy && !b.dash && !b.zone && !b.slowField && !b.feint &&
      specialProjCount === 0 && b.minions.length === 0) {
    b.specialAttackBusy = false;
    b.specialAttackTimer = rand(SPECIAL_ATTACK_INTERVAL_MIN, SPECIAL_ATTACK_INTERVAL_MAX) * attackIntervalFactor();
  }

  b.telegraph = 0;
  if (!b.baseAttackBusy && b.baseAttackTimer > 0 && b.baseAttackTimer <= 0.5) b.telegraph = 1;
  if (!b.specialAttackBusy && b.specialAttackTimer > 0 && b.specialAttackTimer <= 0.5) b.telegraph = 1;

  let baseFiredThisTick = false;
  if (!b.baseAttackBusy) {
    b.baseAttackTimer -= dt;
    if (b.baseAttackTimer <= 0) {
      b.baseAttackBusy = true;
      baseFiredThisTick = true;
      BASE_ATTACK_CASTERS[chooseBasePattern(b)](b);
    }
  }

  if (!b.specialAttackBusy) {
    b.specialAttackTimer -= dt;
    if (b.specialAttackTimer <= 0) {
      if (baseFiredThisTick) {
        // 기본 공격과 완전히 같은 순간에 겹치지 않도록 살짝만 미룬다(회피 불가능한 중첩 방지).
        b.specialAttackTimer = 0.6;
      } else {
        b.specialAttackBusy = true;
        let path = effectAssetPath(b.monsterId);
        // 천사(§P2): 캐스트마다 날개 페이즈를 한 칸씩 돌려 그 날개의 공격 종류/이미지로
        // attackKind와 path를 덮어쓴다 - 8개 날개 능력을 순차적으로 쓰는 연출(기존 지역
        // 수호자 공격 자산 재사용, 새 애니메이션 없음).
        if (b.bossId && BOSSES[b.bossId].phaseAttackKinds) {
          const boss = BOSSES[b.bossId];
          b.attackKind = boss.phaseAttackKinds[b.phaseIdx % boss.phaseAttackKinds.length];
          path = boss.phaseImgPaths[b.phaseIdx % boss.phaseImgPaths.length];
          b.phaseIdx += 1;
        }
        if (path) getEffectImage(path);
        if (b.attackKind === "wingkeeper_barrier") {
          // 날개지기(§P2): 배리어를 지면에 깔거나(zone) 직접 쏘는(projectile) 두 방식을
          // 절반 확률로 번갈아 쓴다(사용자 확정) - 전용 자산이 없어 기존 이펙트를 재사용.
          const tp = targetPlayer(b);
          if (Math.random() < 0.5) {
            getEffectImage(BOSS_BARRIER_PROJECTILE_PATH);
            const angle = Math.atan2(tp.y - b.y, tp.x - b.x);
            b.monsterProjectiles.push({
              x: b.x, y: b.y, vx: Math.cos(angle) * MONSTER_PROJECTILE_SPEED, vy: Math.sin(angle) * MONSTER_PROJECTILE_SPEED,
              angle, imgPath: BOSS_BARRIER_PROJECTILE_PATH, hitRadius: MONSTER_PROJECTILE_HIT_RADIUS, source: "special",
            });
          } else {
            getEffectImage(BOSS_BARRIER_ZONE_PATH);
            b.zone = { x: tp.x, y: tp.y, r: ZONE_RADIUS, t: 0, imgPath: BOSS_BARRIER_ZONE_PATH };
          }
        } else if (b.attackKind === "charge") {
          b.dash = { phase: "out", t: 0, fromX: b.x, fromY: b.y, hasHit: false };
        } else if (b.attackKind === "projectile" || b.attackKind === "obstacleSummon") {
          const speed = b.attackKind === "projectile" ? MONSTER_PROJECTILE_SPEED : OBSTACLE_THROW_SPEED;
          const radius = b.attackKind === "projectile" ? MONSTER_PROJECTILE_HIT_RADIUS : OBSTACLE_HIT_RADIUS;
          const tp = targetPlayer(b);
          const angle = Math.atan2(tp.y - b.y, tp.x - b.x);
          b.monsterProjectiles.push({
            x: b.x, y: b.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            angle, imgPath: path, hitRadius: radius, source: "special",
          });
        } else if (b.attackKind === "obstaclePattern") {
          const tp = targetPlayer(b);
          const baseAngle = Math.atan2(tp.y - b.y, tp.x - b.x);
          for (let i = 0; i < OBSTACLE_PATTERN_COUNT; i++) {
            const a = baseAngle - OBSTACLE_PATTERN_SPREAD / 2 + (OBSTACLE_PATTERN_SPREAD * i) / (OBSTACLE_PATTERN_COUNT - 1);
            b.monsterProjectiles.push({
              x: b.x, y: b.y, vx: Math.cos(a) * OBSTACLE_THROW_SPEED, vy: Math.sin(a) * OBSTACLE_THROW_SPEED,
              angle: a, imgPath: path, hitRadius: OBSTACLE_HIT_RADIUS, source: "special",
            });
          }
        } else if (b.attackKind === "minion") {
          const count = Math.random() < 0.5 ? 1 : 2;
          for (let i = 0; i < count; i++) {
            b.minions.push({ x: b.x + rand(-20, 20), y: b.y + rand(-20, 20), imgPath: path, life: MINION_LIFETIME });
          }
        } else if (b.attackKind === "zone") {
          const tp = targetPlayer(b);
          b.zone = { x: tp.x, y: tp.y, r: ZONE_RADIUS, t: 0, imgPath: path };
        } else if (b.attackKind === "slowfield") {
          const tp = targetPlayer(b);
          b.slowField = { x: tp.x, y: tp.y, r: SLOWFIELD_RADIUS, t: 0, imgPath: path };
        } else if (b.attackKind === "feint") {
          if (Math.random() < FEINT_CHANCE) {
            b.feint = { t: 0, dur: rand(FEINT_PAUSE_MIN, FEINT_PAUSE_MAX) };
          } else {
            b.dash = { phase: "out", t: 0, fromX: b.x, fromY: b.y, hasHit: false };
          }
        }
      }
    }
  }
}

/* ---------------------------- 렌더링 (벡터 드로잉) ---------------------------- */
/* 이모지 대신 캔버스 도형+그라디언트+글로우로 직접 그려서 크기와 상관없이 또렷하게 표시 */

const WEATHER_TINT = {
  sun: "rgba(255,230,150,0.10)",
  rain: "rgba(90,110,160,0.28)",
  cloud: "rgba(220,220,230,0.22)",
};

const WING_STYLE = {
  basic:    { c1: "#ffffff", c2: "#c7d3e0", glow: "#ffffff", accent: "#dfe7f0" },
  golden:   { c1: "#fff6cf", c2: "#e8b93b", glow: "#ffd23f", accent: "#ffe6a0" },
  cloud:    { c1: "#ffffff", c2: "#bfe4ff", glow: "#bfe4ff", accent: "#eaf7ff" },
  rainbow:  { c1: "#ff5b5b", c2: "#a05bff", glow: "#ff6bd6", accent: "#ffffff", rainbow: true },
  sky:      { c1: "#ffffff", c2: "#9fd3ff", glow: "#dff3ff", accent: "#cdeaff" },
  flame:    { c1: "#ffdf7a", c2: "#ff3c1e", glow: "#ff5b1e", accent: "#ffb37a", jag: true },
  water:    { c1: "#dff9ff", c2: "#1e9fdc", glow: "#4fd0e0", accent: "#bdf0ff" },
  electric: { c1: "#ffffff", c2: "#f6e500", glow: "#fff36b", accent: "#fff9b0", jag: true },
};

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBgCloud(x, y, scale) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffffff";
  [[0, 0, 18], [16, -6, 14], [-16, -4, 13], [8, 6, 12], [-8, 7, 11]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawSun(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#ffcf3f";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#ffe38a";
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWarningMark(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffcf3f";
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, r * 0.8); ctx.lineTo(-r * 0.9, r * 0.8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3a2a00";
  ctx.font = `bold ${r * 1.1}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("!", 0, r * 0.2);
  ctx.restore();
}

// 배경 레이어 1장을 canvas(w x h) 전체를 덮도록 확대한 뒤, 오른쪽에서 왼쪽으로 계속 흐르도록
// dw(레이어 실제 표시 너비) 간격으로 이어붙여 타일링한다(사용자 확정: 오른쪽→왼쪽 이동,
// speedMul이 클수록 빨리 흐름 - near(1.4) > mid(0.8) > far(0.35) 순으로 호출해 원근감을 만든다).
function drawBackgroundLayer(img, w, h, speedMul) {
  if (!bgImgReady(img)) return;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const y = (h - dh) / 2;
  const offset = (rt.bgOffset * speedMul) % dw;
  for (let x = -offset; x < w; x += dw) {
    ctx.drawImage(img, x, y, dw, dh);
  }
}

function render() {
  ctx.clearRect(0, 0, cw(), ch()); // 물리적 canvas 전체를 지운다(카메라 확대 전 좌표계)

  // 카메라 줌: 이 아래부터는 전부 축소된 월드 좌표계(vw x vh)로 그리고, 마지막에
  // cameraScale()배로 확대해 canvas 전체(cw x ch)를 채운다(회피/전투 배율이 다름, currentViewScale).
  ctx.save();
  ctx.scale(cameraScale(), cameraScale());
  const w = vw(), h = vh();

  // 지역별 배경(§Ch): 현재 챕터 지역의 far/mid/near 3레이어를 그린다. 로딩 전이거나 그 지역
  // 자산이 없으면(이론상 없음 - 9개 지역 전부 세트가 있음) 기존 그라디언트 하늘로 대체한다.
  const bgSet = BACKGROUND_SPRITE[currentRegionWingId()] || BACKGROUND_SPRITE.basic;
  const bgAnyReady = bgSet && (bgImgReady(bgSet.far) || bgImgReady(bgSet.mid) || bgImgReady(bgSet.near));
  if (bgAnyReady) {
    drawBackgroundLayer(bgSet.far, w, h, 0.35);
    drawBackgroundLayer(bgSet.mid, w, h, 0.8);
    drawBackgroundLayer(bgSet.near, w, h, 1.4);
  } else {
    // 하늘 배경 폴백 (구름 날개는 더 높은 고도 느낌으로 밝게)
    const isCloudWing = anyPlayerHasWing("cloud");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (isCloudWing) { g.addColorStop(0, "#bfe4ff"); g.addColorStop(1, "#eaf7ff"); }
    else { g.addColorStop(0, "#3f7fc9"); g.addColorStop(1, "#bfe4ff"); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 배경 구름 장식 (패럴랙스) - 실제 배경 일러스트가 있을 땐 그림과 겹쳐 지저분해지므로
    // 그라디언트 폴백일 때만 그린다.
    for (let i = 0; i < 5; i++) {
      const x = ((i * 260 - rt.bgOffset * 0.5) % (w + 300) + (w + 300)) % (w + 300) - 150;
      drawBgCloud(x, 60 + (i % 3) * 40, 1.1);
    }
  }

  // 날씨 연출
  ctx.fillStyle = WEATHER_TINT[rt.weather] || "transparent";
  ctx.fillRect(0, 0, w, h);
  if (rt.weather === "rain") {
    ctx.strokeStyle = "rgba(200,220,255,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const rx = (i * 53 + rt.bgOffset * 4) % w;
      const ry = (i * 91 + rt.bgOffset * 6) % h;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 14); ctx.stroke();
    }
  } else if (rt.weather === "sun") {
    drawSun(w - 80, 70, 30);
  }

  // 은신 구름 (구름 날개)
  for (const c of rt.clouds) drawBgCloud(c.x, c.y, c.r / 20);

  if (inBattle()) rt.battles.forEach(renderBattle); // 철창 연출 삭제(사용자 확정, §신규-날개4)
  else renderFlightEntities();

  rt.players.forEach(renderPlayer);
  if (inBattle()) rt.players.forEach(renderChargeProjectiles);
  renderParticles();
  renderFloatTexts();
  ctx.restore();
}

function drawIconOrFallback(name, targetH, fallback) {
  if (iconReady(name)) {
    const img = ICON_SPRITE[name];
    const w = img.naturalWidth * (targetH / img.naturalHeight);
    ctx.drawImage(img, -w / 2, -targetH / 2, w, targetH);
  } else {
    fallback();
  }
}

function drawCoin(r) {
  drawIconOrFallback("coin", r * 1.9, () => {
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#fff6c9");
    grad.addColorStop(0.55, "#ffd23f");
    grad.addColorStop(1, "#c97f00");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#8a5600"; ctx.stroke();
  });
}

function drawMoney(r) {
  drawIconOrFallback("money", r * 1.7, () => {
    const w = r * 1.9, h = r * 1.2;
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, "#a6f0b8"); grad.addColorStop(1, "#2f8f5c");
    ctx.fillStyle = grad;
    roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#1a5c39"; ctx.stroke();
  });
}

function drawGemPickup(r) {
  ctx.save();
  ctx.shadowColor = "#4fd0e0";
  ctx.shadowBlur = 16;
  drawIconOrFallback("gem", r * 1.6, () => {
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#dff9ff"); grad.addColorStop(0.5, "#4fd0e0"); grad.addColorStop(1, "#1e9fdc");
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#0e6e94"; ctx.stroke();
  });
  ctx.restore();
}

// 무지개다리 이벤트용 별 (drawGemPickup과 같은 톤: 부드러운 발광 + 그라디언트)
function drawBridgeStar(r) {
  ctx.save();
  ctx.shadowColor = "#ffe27a";
  ctx.shadowBlur = 18;
  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  grad.addColorStop(0, "#fffbe0");
  grad.addColorStop(0.55, "#ffd23f");
  grad.addColorStop(1, "#ff9d3f");
  ctx.beginPath();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (i % 2 === 0 ? 1 : 0.45);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#ff6fd8"; ctx.stroke();
  ctx.restore();
}

function drawObstacleFallback(r) {
  const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.15, 0, 0, r);
  grad.addColorStop(0, "#9096a3"); grad.addColorStop(1, "#333844");
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const rr = r * (i % 2 === 0 ? 1 : 0.72);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,90,70,0.8)"; ctx.stroke();
}

function drawObstacle(r, obstacleIdx) {
  ctx.save();
  ctx.shadowColor = "rgba(255,70,60,0.55)";
  ctx.shadowBlur = 10;

  const arr = regionObstacleArr();
  const img = arr && arr[obstacleIdx || 0];
  if (img && img.complete && img.naturalWidth > 0) {
    const targetH = r * 2.1;
    const w = img.naturalWidth * (targetH / img.naturalHeight);
    ctx.shadowBlur = 14;
    ctx.drawImage(img, -w / 2, -targetH / 2, w, targetH);
  } else {
    drawObstacleFallback(r);
  }
  ctx.restore();
}

function drawMonster(r, telegraph) {
  ctx.save();
  ctx.shadowColor = "#ff2d4d";
  ctx.shadowBlur = telegraph ? 30 : 16;
  const grad = ctx.createRadialGradient(0, -r * 0.3, r * 0.2, 0, 0, r);
  grad.addColorStop(0, "#6a4079"); grad.addColorStop(1, "#160c1f");
  ctx.beginPath();
  const spikes = 10;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const rr = r * (i % 2 === 0 ? 1 : 0.68);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.shadowBlur = 0;
  // 눈
  ctx.fillStyle = "#ff2d4d";
  ctx.shadowColor = "#ff2d4d"; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(-r * 0.26, -r * 0.05, r * 0.15, r * 0.09, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.26, -r * 0.05, r * 0.15, r * 0.09, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function renderFlightEntities() {
  for (const e of rt.entities) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === "coin") drawCoin(e.r);
    else if (e.type === "money") (rt.players.some(p => p.moneyToGemTimer > 0) ? drawGemPickup(e.r) : drawMoney(e.r));
    else if (e.type === "obstacle") {
      // 회전/펄스는 순수 시각 연출: e.r(충돌판정 반지름)은 그대로 두고 그리기용 값만 바꾼다.
      if (e.flourish === "spin") ctx.rotate(e.rotation || 0);
      const drawR = e.flourish === "pulse" ? e.r * (e.pulseMul || 1) : e.r;
      drawObstacle(drawR, e.obstacleIdx || 0);
    }
    else if (e.type === "bridgestar") drawBridgeStar(e.r);
    else if (e.type === "hazard") drawHazard(e.r, e.rotation || 0);
    ctx.restore();
  }
}

function drawHazard(r, rotation) {
  const img = hazardImgReady();
  if (!img) return; // 해당 지역 자산이 없으면(로딩 전 등) 조용히 건너뛴다
  ctx.save();
  ctx.rotate(rotation);
  ctx.globalAlpha = 0.85;
  const d = r * 2;
  ctx.drawImage(img, -r, -r, d, d);
  ctx.restore();
}

// 실제 몬스터 스프라이트(assets/monsters, MONSTER_SPRITE)를 그린다. 로딩 전이거나
// monsterId가 없는 경우(예: 구버전 호출부)에는 기존 벡터 드로잉으로 대체된다.
const MONSTER_BATTLE_HEIGHT = 260; // 지역 수호자 크기 2배(사용자 확정)
function drawBattleMonster(b) {
  if (b.bossId) { drawBossBattleSprite(b); return; }
  const img = b.monsterId && MONSTER_SPRITE[b.monsterId];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.shadowColor = "#ff2d4d";
    ctx.shadowBlur = b.telegraph ? 30 : 14;
    const targetH = MONSTER_BATTLE_HEIGHT;
    const dw = img.naturalWidth * (targetH / img.naturalHeight);
    ctx.drawImage(img, -dw / 2, -targetH / 2, dw, targetH);
    ctx.restore();
  } else {
    drawMonster(46, !!b.telegraph);
  }
}

// 보스(§P2) 전용 렌더링 - 일반 몬스터보다 크게 그리고, 날개지기 배리어 활성 중엔 파란
// 글로우 + 주변 링으로 "지금은 공격이 안 통한다"를 시각적으로 알려준다.
function drawBossBattleSprite(b) {
  const boss = BOSSES[b.bossId];
  const img = BOSS_SPRITE[b.bossId];
  const targetH = boss.battleHeight || 200;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    if (b.shieldActive) {
      ctx.shadowColor = "#8ec9ff";
      ctx.shadowBlur = 40;
    } else {
      ctx.shadowColor = "#ff2d4d";
      ctx.shadowBlur = b.telegraph ? 34 : 16;
    }
    const dw = img.naturalWidth * (targetH / img.naturalHeight);
    ctx.drawImage(img, -dw / 2, -targetH / 2, dw, targetH);
    ctx.restore();
  } else {
    drawMonster(70, !!b.telegraph);
  }
  if (b.shieldActive) {
    ctx.save();
    ctx.strokeStyle = "rgba(142,201,255,0.75)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#8ec9ff";
    ctx.shadowBlur = 20;
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, (targetH / 2 + 18) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// 장판(§6-3): zone 이미지를 위험구역 자리에 표시한다. ZONE_DELAY(1초)에 가까워질수록
// 펄스를 더 빠르고 크게 키워 "곧 터진다"는 긴박함을 표현한다. 플레이어보다 먼저 그려야
// (renderBattle -> renderPlayer 순서) 발밑 바닥처럼 보인다.
function renderZone(z) {
  const path = z.imgPath;
  if (!path || !effectImageReady(path)) return;
  const img = EFFECT_IMG_CACHE[path];
  const t = clamp(z.t / ZONE_DELAY, 0, 1);
  const pulse = Math.sin(performance.now() / (80 - t * 40)) * 0.5 + 0.5;
  const scale = (z.r * 2 / img.naturalHeight) * (0.9 + pulse * 0.15 * (0.4 + t));
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = 0.55 + t * 0.45;
  ctx.drawImage(img, z.x - dw / 2, z.y - dh / 2, dw, dh);
  ctx.restore();
}

// 몬스터 투사체/장애물(§6-3): 플레이어 쪽으로 날아가는 몬스터 자신의 이펙트 이미지를
// 방향에 맞춰 그린다. 플레이어 charge 투사체(renderChargeProjectiles)와 동일한 방식.
// 투사체/장애물소환/장애물패턴이 모두 이 하나의 배열·렌더 함수를 공유한다.
function renderMonsterProjectiles(b) {
  for (const pr of b.monsterProjectiles) {
    // pr.img: 공통 장애물 기본 공격(§6-4)이 OBSTACLE_SPRITE에서 직접 참조하는 이미지.
    // pr.imgPath: 기존 몬스터 고유 공격(§6-3)이 쓰는 지연 로딩 effect 이미지 경로.
    const img = pr.img || (pr.imgPath && effectImageReady(pr.imgPath) && EFFECT_IMG_CACHE[pr.imgPath]);
    if (!img || !img.complete || img.naturalWidth === 0) continue;
    const targetH = 60;
    const s = targetH / img.naturalHeight;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);
    ctx.drawImage(img, -img.naturalWidth * s / 2, -img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  }
}

// 미니언(§6-3): 플레이어를 향해 접근 중인 부하들을 그린다. 회전 없이 살짝 위아래로
// 둥실거리기만 해서(§5-4의 다른 이펙트들과 톤을 맞춤) 접근 방향이 위협적으로 보이게 한다.
function renderMinions(b) {
  for (const m of b.minions) {
    if (!m.imgPath || !effectImageReady(m.imgPath)) continue;
    const img = EFFECT_IMG_CACHE[m.imgPath];
    const targetH = 50;
    const s = targetH / img.naturalHeight;
    const bob = Math.sin(performance.now() / 160 + m.x) * 3;
    ctx.save();
    ctx.translate(m.x, m.y + bob);
    ctx.drawImage(img, -img.naturalWidth * s / 2, -img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  }
}

// 슬로우필드(§6-3): renderZone과 같은 자리(플레이어 발밑)에 그리되, 데미지 카운트다운이
// 아니라 지속 구역이라 펄스를 더 느리고 잔잔하게 유지한다.
function renderSlowField(sf) {
  const path = sf.imgPath;
  if (!path || !effectImageReady(path)) return;
  const img = EFFECT_IMG_CACHE[path];
  const pulse = Math.sin(performance.now() / 220) * 0.5 + 0.5;
  const scale = (sf.r * 2 / img.naturalHeight) * (0.95 + pulse * 0.06);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.drawImage(img, sf.x - dw / 2, sf.y - dh / 2, dw, dh);
  ctx.restore();
}

function renderBattle(b) {
  if (b.zone) renderZone(b.zone);
  if (b.slowField) renderSlowField(b.slowField);

  // 몬스터
  const shake = b.telegraph ? Math.sin(performance.now() / 30) * 5 : 0;
  ctx.save();
  ctx.translate(b.x + shake, b.y);
  drawBattleMonster(b);
  ctx.restore();

  // 몬스터 체력바 - 스프라이트 높이(보스는 battleHeight로 훨씬 큼, §P2)에 맞춰 머리 위
  // 여유를 두고 띄운다. 고정 오프셋(80px)을 그대로 쓰면 큰 보스일수록 얼굴을 가린다(실측 확인).
  const spriteH = b.bossId ? (BOSSES[b.bossId].battleHeight || 200) : MONSTER_BATTLE_HEIGHT;
  const barY = b.y - spriteH / 2 - 26;
  const barW = 160;
  ctx.fillStyle = "#222";
  ctx.fillRect(b.x - barW / 2, barY, barW, 14);
  ctx.fillStyle = "#ff4b4b";
  ctx.fillRect(b.x - barW / 2, barY, barW * clamp(b.hp / b.maxHp, 0, 1), 14);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(b.x - barW / 2, barY, barW, 14);

  if (b.telegraph) drawWarningMark(b.x, barY - 32, 16);

  renderMonsterProjectiles(b);
  renderMinions(b);
}

function wingBladePath(sign, jag) {
  ctx.beginPath();
  ctx.moveTo(0, -2);
  if (!jag) {
    ctx.quadraticCurveTo(sign * 20, -16, sign * 40, -8);
    ctx.quadraticCurveTo(sign * 50, -2, sign * 44, 12);
    ctx.quadraticCurveTo(sign * 30, 8, sign * 18, 18);
    ctx.quadraticCurveTo(sign * 8, 13, 0, 20);
  } else {
    ctx.lineTo(sign * 14, -18); ctx.lineTo(sign * 22, -7); ctx.lineTo(sign * 38, -16);
    ctx.lineTo(sign * 31, 2); ctx.lineTo(sign * 47, 5); ctx.lineTo(sign * 29, 13);
    ctx.lineTo(sign * 35, 21); ctx.lineTo(sign * 16, 15); ctx.lineTo(sign * 19, 23); ctx.lineTo(0, 18);
  }
  ctx.closePath();
}

function drawWing(wingId, sign) {
  const style = WING_STYLE[wingId] || WING_STYLE.basic;
  ctx.save();
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 16;

  if (wingId === "cloud") {
    ctx.fillStyle = "#eef8ff";
    [[8, -4, 13], [22, -9, 15], [34, -4, 12], [16, 5, 11], [27, 7, 10]].forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(sign * dx, dy, r, 0, Math.PI * 2); ctx.fill();
    });
  } else {
    wingBladePath(sign, !!style.jag);
    let grad;
    if (style.rainbow) {
      grad = ctx.createLinearGradient(0, -18, sign * 50, 16);
      ["#ff5b5b", "#ffb85b", "#fff45b", "#5bff8f", "#5bc8ff", "#a05bff"].forEach((c, i) => grad.addColorStop(i / 5, c));
    } else {
      grad = ctx.createLinearGradient(0, -18, sign * 50, 16);
      grad.addColorStop(0, style.c1);
      grad.addColorStop(1, style.c2);
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();
  }
  ctx.restore();
}

function drawSword(wingId) {
  const style = WING_STYLE[wingId] || WING_STYLE.basic;
  ctx.save();
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 16;
  const grad = ctx.createLinearGradient(0, -32, 0, 10);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, style.accent);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-3, 10); ctx.lineTo(-2.2, -28); ctx.lineTo(0, -35);
  ctx.lineTo(2.2, -28); ctx.lineTo(3, 10);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#3a2f22";
  ctx.fillRect(-7, 8, 14, 5);
  ctx.fillStyle = "#8a6b3f";
  ctx.fillRect(-2, 13, 4, 11);
  ctx.restore();
}

function drawPlayerBody(wingId) {
  const style = WING_STYLE[wingId] || WING_STYLE.basic;
  ctx.save();

  // 몸통(케이프)
  const bodyGrad = ctx.createLinearGradient(0, -18, 0, 22);
  bodyGrad.addColorStop(0, "#454b62"); bodyGrad.addColorStop(1, "#1c1f2b");
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.quadraticCurveTo(-17, 14, -8, 23);
  ctx.quadraticCurveTo(0, 27, 8, 23);
  ctx.quadraticCurveTo(17, 14, 14, -6);
  ctx.quadraticCurveTo(0, -15, -14, -6);
  ctx.closePath();
  ctx.fillStyle = bodyGrad; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = style.accent; ctx.stroke();

  // 머리
  ctx.beginPath(); ctx.arc(0, -21, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#2b2e3d"; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = style.accent; ctx.stroke();

  // 바이저(글로우)
  ctx.save();
  ctx.shadowColor = style.glow; ctx.shadowBlur = 10;
  ctx.fillStyle = style.glow;
  ctx.beginPath(); ctx.ellipse(0, -21, 7, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

const PLAYER_DISPLAY_HEIGHT = 108;
const PLAYER_BATTLE_HEIGHT = 168;

// 사망한 플레이어(§신규-2)는 옅게 반투명 처리하고 머리 위에 💀 표시만 얹어 "이 플레이어는
// 지금 조작 불가" 상태임을 분명히 드러낸다(차지 이펙트/1P·2P 라벨 등 나머지 연출은 생략).
function renderDeadPlayerMarker(p) {
  const charId = effectiveCharacterId(p.playerIdx);
  const wing = effectiveWing(p.playerIdx);
  ctx.save();
  ctx.translate(p.x, p.y);
  let dh = 90;
  if (spriteReady(charId, wing)) {
    const img = WING_SPRITE[charId][wing];
    const anchor = charWingAnchor(charId, wing);
    const targetH = inBattle() ? PLAYER_BATTLE_HEIGHT : PLAYER_DISPLAY_HEIGHT;
    const scale = targetH / img.naturalHeight;
    const dw = img.naturalWidth * scale; dh = targetH;
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, -dw * anchor.ax, -dh * anchor.ay, dw, dh);
  }
  ctx.globalAlpha = 1;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4;
  ctx.fillText("💀", 0, -dh * 0.62 - 4);
  ctx.restore();
}

function renderPlayer(p) {
  if (p.dead) { renderDeadPlayerMarker(p); return; }
  const charId = effectiveCharacterId(p.playerIdx);
  const wing = effectiveWing(p.playerIdx);
  const flashing = p.invuln > 0 && Math.floor(performance.now() / 100) % 2 === 0;
  const hidden = p.hiddenTimer > 0;

  ctx.save();
  ctx.globalAlpha = hidden ? 0.35 : (flashing ? 0.35 : 1);
  ctx.translate(p.x, p.y);
  ctx.translate(0, Math.sin(performance.now() / 220) * 2); // 미세한 상하 부양

  let dw = 90, dh = 90;

  if (spriteReady(charId, wing)) {
    const img = WING_SPRITE[charId][wing];
    const anchor = charWingAnchor(charId, wing);
    const targetH = inBattle() ? PLAYER_BATTLE_HEIGHT : PLAYER_DISPLAY_HEIGHT;
    const scale = targetH / img.naturalHeight;
    dw = img.naturalWidth * scale; dh = img.naturalHeight * scale;
    ctx.drawImage(img, -dw * anchor.ax, -dh * anchor.ay, dw, dh);
  } else {
    // 스프라이트 로딩 전 대체용 벡터 렌더링
    ctx.save(); ctx.translate(-6, -2); drawWing(wing, -1); ctx.restore();
    ctx.save(); ctx.translate(6, -2); drawWing(wing, 1); ctx.restore();
    drawPlayerBody(wing);
  }

  // 차지 중에는 칼을 휘두르지 않고, 캐릭터가 들고 있는 칼 주변에 에너지가 모이는
  // 듯한 빛/펄스/미세 떨림만 표현한다(§6). 발사는 renderChargeProjectiles가 그리는
  // 별도 투사체가 담당하므로 여기서는 "충전 중" 상태만 그린다.
  if (inBattle() && p.charging) {
    const t = clamp(p.chargeT / CHARGE_MAX_TIME, 0, 1);
    const isFull = p.chargeT >= CHARGE_MAX_TIME;
    const jitterMag = isFull ? 3 : 1.5 * t; // 완충에 가까울수록 더 크게 웅웅거림
    const jx = (Math.random() - 0.5) * jitterMag;
    const jy = (Math.random() - 0.5) * jitterMag;
    const pulse = Math.sin(performance.now() / (isFull ? 55 : 130)) * 0.5 + 0.5; // 완충일수록 빠르게 맥동

    ctx.save();
    ctx.translate(dw * 0.3 + jx, -dh * 0.02 + jy);
    ctx.rotate(-0.9);
    ctx.scale(dh / 90, dh / 90);
    ctx.shadowColor = (WING_STYLE[wing] && WING_STYLE[wing].glow) || "#ffffff";
    ctx.shadowBlur = 6 + t * 22 + pulse * (isFull ? 16 : 6);
    ctx.globalAlpha = 0.75 + t * 0.25;
    drawSword(wing);
    ctx.restore();
  }

  // 2인 플레이에서는 캐릭터 위에 1P/2P 표시를 얹어 쉽게 구분되게 한다(§13).
  if (state.playerCount === 2) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = p.playerIdx === 2 ? "#ff9f4f" : "#4fd0e0";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 4;
    ctx.fillText(`${p.playerIdx}P`, 0, -dh * 0.62 - 8);
    ctx.restore();
  }
  ctx.restore();
}

// 발사된 검기 투사체(플레이어 소유, §7)를 각자의 위치/방향으로 그린다. 몬스터
// 위치와 무관하게 순수히 투사체 자신의 각도(angle)만 사용한다(자동 조준 없음).
// drawImage만 호출하고 별도 배경 사각형은 그리지 않으므로, PNG의 투명 영역은
// 그대로 투명하게 나온다(§6-1-1 charge 자산은 alpha 채널이 있는 RGBA PNG).
function renderChargeProjectiles(p) {
  if (p.projectiles.length === 0) return;
  for (const pr of p.projectiles) {
    if (!chargeSpriteReady(pr.charId, pr.wing, pr.stage)) continue;
    const img = CHARGE_SPRITE[pr.charId][pr.wing][pr.stage];
    const targetH = pr.stage === "full" ? 90 : 60;
    const s = targetH / img.naturalHeight;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);
    ctx.drawImage(img, 0, -img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  }
}

function renderFloatTexts() {
  floatTexts.forEach(f => {
    ctx.save();
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 40);
    ctx.restore();
  });
  floatTexts.forEach(f => f.life -= 0.02);
  floatTexts = floatTexts.filter(f => f.life > 0);
}

/* =========================================================================
   초기화
   ========================================================================= */

function init() {
  updateAllHUD();
  switchScene("room");
  maybeStartFirstEntry();
}

init();
