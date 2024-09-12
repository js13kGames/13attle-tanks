let globalScale = .8;
let level = 1;
let time = tDiff = 0;
let scene = SCENES.START;
let cameraPos = null;
let objList = [];
let SCREEN_SIZE = vec2(1080);
let shakeTimer = new Timer;
let shakeLevel = 0;

let DEBUG_MESSAGES = [];

const THINK_RATE = .02;
const PLAYER_DETECT_RANGE = 700;
const ENEMY_ATTACK_RANGE = 300;

let currMap;
let player;

const startLevel = level => {
  currMap = new LevelMap({pathLen: 4, cellSize: 1e3, enemiesPerCell: 1});
  player = new PlayerUnit(currMap.size.scale(.5), 1);
};

//wasd, zqsd, arrow keys, space
// - u, l, r, d: WASD/ZQSD/arrow keys
// - s: space
// - S: shift
// - E: enter
// - R, T, Y, X, C, V, B, N, F, J: letters
// Ex: if(keys.r) { /* move to the right */ }
// Source: https://github.com/xem/miniGameTemplate/blob/gh-pages/index.html
const keys = {};
onkeydown=onkeyup=e=>{
  keys['E**S***************s****lurd************************lBCr*F***J***N**lRdT*VuXYu'[e.which-13]]=e.type[5]
};

window.addEventListener("wheel", e => {
  const direction = (e.detail < 0) ? 1 : (e.wheelDelta > 0) ? 1 : -1;
  globalScale = Math.min(3, Math.max(0.1, globalScale + direction * .2));
});

startLevel(1);

/***************************/ E=t=>{x.reset(tDiff = t - time)//loop and clear canvas
time = t;

// player controls
if (player && !player.isDead) {
  player.move(keys.u ? 1 : keys.d ? -1 : 0);
  player.rotate(keys.r ? 1 : keys.l ? -1 : 0);
  player.isFiring = keys.s;
}

// update
objList = objList.filter(o => !o.delete).sort((a, b) => a.isDead ? -1 : (a.pos?.y - a.center.y) - (b.pos?.y - b.center.y));
if (!shakeTimer.elapsed()) cameraPos = player.pos.copy().move(random() * PI2, shakeLevel * 20);
else cameraPos = player.pos.copy();
for(o of objList)o.update();
currMap.update();

//check collisions
DEBUG_COLLISIONS = [];
const len = objList.length;
for(i=0;i<len-1;i++)for(j=i+1;j<len;j++)
if(collided(o=objList[i],p=objList[j])){o.collidedWith(p);p.collidedWith(o);}

// render -------------------------
currMap.render(time);
for(o of objList)o.render(time)

// draw stats
if (debug) {
  x.font="16px'";
  x.fillStyle="black";
  let startPos = vec2(50, 30);
  [
    `currMap.playerRouteIndex = ${currMap.playerRouteIndex}`,
    `globalScale = ${globalScale}`,
    `objList.length: ${objList.length}`,
    ...player.toString(),
    ...objList[2].toString(),
    ...objList.filter(o => o instanceof Bullet).map(o => o.toString().join`, `),
    JSON.stringify(keys),
    ...DEBUG_COLLISIONS,
  ].map((s, i) => x.fillText(s, startPos.x, startPos.y + (i * 30)))
}


/*end of loop*/};