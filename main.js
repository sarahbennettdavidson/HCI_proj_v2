function createShader(gl, type, source) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  let vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  let fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  let prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog));
  }
  return prog;
}

// WebGL setup
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");
if (!gl) alert("WebGL2 not supported");

const vertSource = vertexShaderSource;
const fragSource = fragmentShaderSource;

let program, posLoc, timeLoc, uMVM, uPM, uMTM, uvLoc;

let patternCounter = 0;
const patternNames = ["Checks", "Stripes", "Dots", "WarpedStripes", "Perlin", "Flat"];
let pattern = patternNames[0];
let a1 = Math.random();
let a2 = Math.random();
let a3 = Math.random();

// cube buffers, made once
function makeShapeBuffers(pos, uv, idx) {
  const b = {};

  b.vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

  b.uvbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b.uvbo);
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);

  b.ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

  b.count = idx.length;
  return b;
}

const cubeBuffers = makeShapeBuffers(cubePos, cubeUVs, cubeIndices);

// background plane: a -1..1 square in x and y, uvs 0..1
const planePos = new Float32Array([
  -1, -1, 0,   1, -1, 0,   1,  1, 0,  -1,  1, 0
]);
const planeUVs = new Float32Array([
  0, 0,   1, 0,   1, 1,   0, 1
]);
const planeIndices = new Uint16Array([
  0, 1, 2,   0, 2, 3
]);
const planeBuffers = makeShapeBuffers(planePos, planeUVs, planeIndices);

// draw one shape with one model matrix
function drawShape(b, matrix) {
  gl.uniformMatrix4fv(uMTM, false, matrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, b.uvbo);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ibo);
  gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
}

function initShaderProgram() {
  try {
    program = createProgram(gl, vertSource, fragSource);
    gl.useProgram(program);
    posLoc = gl.getAttribLocation(program, "aPosition");
    uvLoc = gl.getAttribLocation(program, "aUV");
    timeLoc = gl.getUniformLocation(program, "uTime");
    uMVM = gl.getUniformLocation(program, "uModelViewMatrix");
    uPM = gl.getUniformLocation(program, "uProjectionMatrix");
    uMTM = gl.getUniformLocation(program, "uModelTransformationMatrix");
    patternNum = gl.getUniformLocation(program, "patternNum");

  } catch (e) { console.error(e); }
}
initShaderProgram();

// [x, y, z] rotation per cube: 0 = left cube, 1 = right cube
const cubeRots = [[0, 0, 0], [0, 0, 0]];
let camX = 0, camY = 0, camZ = -6;

// palette and pattern values, and faceMaps, come from init.js

const xRotSpeed = 0;
const yRotSpeed = 0;
const zRotSpeed = 0;


// floating: each cube drifts in a small circle, cos in x and sin in y, each with its own phase
const floatRadius = 0.12;            // world units (a cube is 2 wide)
const floatSpeed = 1.5;              // radians per second, about 4 s per circle
const floatPhase = [0, Math.PI];     // per cube: 0 = left, 1 = right

const aspect = canvas.width / canvas.height;
const orthoSize = 2.5;          // half the view height; half the view width is orthoSize * aspect
let proj = ortho(-orthoSize * aspect, orthoSize * aspect, -orthoSize, orthoSize, 0.1, 100);


let animating = false;   // true while any rotation runs; SPIN and FRONT do nothing then

function spin() {
  if (animating) {
    return;
  }
  animating = true;
  const guided = (guideStep === "spin");      // this click answers the SPIN pulse
  if (guided) {
    guideStep = "none";                       // nothing pulses while the cubes spin
    updatePulse();
  }
  playSound("spin");
  Promise.all([AnimateRotation(0, 500), AnimateRotation(1, 500)]).then(() => {
    animating = false;
    if (guided && guideStep === "none") {
      if (gameMode === "diabolical") {
        guideStep = "cross";                  // FRONT is disabled in diabolical: skip its pulse
      } else {
        guideStep = "front";
      }
      updatePulse();
    }
  });
}

function front() {
  if (animating) {
    return;
  }
  animating = true;
  const guided = (guideStep === "front");     // this click answers the FRONT pulse
  if (guided) {
    guideStep = "none";
    updatePulse();
  }
  Promise.all([resetCube(0, true), resetCube(1, false)]).then(() => {
    animating = false;
    if (guided && guideStep === "none") {
      guideStep = "cross";
      updatePulse();
    }
  });
}

// every rotation done so far, per cube: 0 = left, 1 = right. each entry is a signed axis, e.g. [0, -1, 0]
const rotations = [[], []];

// picks a random axis (x, y or z) and direction, and pushes it onto that cube's rotations
function createRandomRotation(cubeIndex) {
  const axisIndex = Math.floor(Math.random() * 3);   // 0 = x, 1 = y, 2 = z
  const sign = Math.sign(Math.random() * 2 - 1);      // direction: -1 or 1
  const axis = [0, 0, 0];
  axis[axisIndex] = sign;                             // e.g. [0, -1, 0]
  rotations[cubeIndex].push(axis);
}

//rotation animation function. can be triggered once or repeatedly so neeeds to report it's completed.
// Rotates one cube (0 = left, 1 = right) 90 degrees. With no axis given, it creates a random rotation
// and uses the newest one. resetCube passes an inverse axis instead.
// duration is in milliseconds. Returns a Promise that resolves with the axis when done.
function AnimateRotation(cubeIndex, duration, axis) {
  if (axis === undefined) {
    createRandomRotation(cubeIndex);
    const history = rotations[cubeIndex];
    axis = history[history.length - 1];               // newest rotation
  }

  const rot = cubeRots[cubeIndex];                    // the cube's angles, changed in place
  const start = [rot[0], rot[1], rot[2]];
  const total = Math.PI / 2;                          // 90 degrees in radians
  let t0 = null;

  return new Promise(resolve => {
    function step(now) {
      if (t0 === null) t0 = now;
      let t = 1;                                      // 0..1
      if (duration > 0) {
        t = Math.min((now - t0) / duration, 1);
      }
      const tEased = 1 - Math.sqrt(1 - t * t);        // circular ease-in, 0..1
      const ang = tEased * total;

      rot[0] = start[0] + axis[0] * ang;
      rot[1] = start[1] + axis[1] * ang;
      rot[2] = start[2] + axis[2] * ang;

      if (t < 1) requestAnimationFrame(step);
      else resolve(axis);
    }
    requestAnimationFrame(step);
  });
}

// undoes one cube's rotations, newest first, each with the inverse axis, so it ends back at the front.
// each step takes 150 ms, however many rotations there are.
// withSound: play the reset sound on each step. Both cubes always undo the same number of steps
// at the same time, so only one of the two calls passes true, or every sound would play twice.
async function resetCube(cubeIndex, withSound) {
  const history = rotations[cubeIndex];
  const duration = 150;
  for (let i = history.length - 1; i >= 0; i--) {
    const inverse = [-history[i][0], -history[i][1], -history[i][2]];
    if (withSound) {
      playSound("reset");
    }
    await AnimateRotation(cubeIndex, duration, inverse);
  }
  history.length = 0;                                 // everything is undone
}

// model matrix for one cube: translate to position [x, y, z], then rotate Y, X, Z (T * Ry * Rx * Rz)
function cubeModelMatrix(position, rot) {
  let m = mat4Translate(mat4Identity(), position);
  m = mat4RotateY(m, rot[1]);
  m = mat4RotateX(m, rot[0]);
  m = mat4RotateZ(m, rot[2]);
  return m;
}

document.getElementById("spinBtn").addEventListener("click", spin);
document.getElementById("frontBtn").addEventListener("click", front);

// on closing the instructions popup: 3 random rotations per cube, 250 ms each, one after another,
// then reset both cubes back to the front
async function scramble() {
  animating = true;
  for (let i = 0; i < 3; i++) {
    playSound("spin");
    await Promise.all([AnimateRotation(0, 250), AnimateRotation(1, 250)]);
  }
  await Promise.all([resetCube(0, true), resetCube(1, false)]);
  animating = false;
  if (guideStep === "none") {                 // start the guide, unless a pick already skipped it
    guideStep = "spin";
  }
  updatePulse();
}

// game mode, picked with a button in the instructions popup:
//   "normal"
//   "zen":        no losing. when every pair is matched, score, matches and streak are kept,
//                 the patterns are replaced with new random ones, tries refill to 10,
//                 and the cubes shuffle again, so play can go on forever
//   "diabolical": FRONT is disabled
let gameMode = "normal";

function startGame() {
  const choice = document.getElementById("instructions").returnValue;
  if (choice === "zen" || choice === "diabolical") {
    gameMode = choice;
  }
  if (gameMode === "diabolical") {
    document.getElementById("frontBtn").disabled = true;
  }
  scramble();
}

document.getElementById("instructions").addEventListener("close", startGame);

// QUIT and HOME: reload the page, back to the opening popup with everything new.
// QUIT plays its sound first and reloads when the sound ends, so the reload does not cut it off
document.getElementById("quitBtn").addEventListener("click", () => {
  const source = playSound("quit");
  if (source !== null) {
    source.onended = () => location.reload();
  } else {
    location.reload();
  }
});
document.getElementById("homeBtn").addEventListener("click", () => location.reload());

// pattern parameters from init.js (one set per pattern), sent to the fragment shader
function setPatternUniforms() {
  gl.uniform3fv(gl.getUniformLocation(program, "paletteParamsList"), paletteValues);
  gl.uniform1fv(gl.getUniformLocation(program, "paletteTList"), paletteT);
  gl.uniform1fv(gl.getUniformLocation(program, "patternSizeList"), patternSize);
  gl.uniform1fv(gl.getUniformLocation(program, "blurList"), blur);
  gl.uniform1fv(gl.getUniformLocation(program, "patternRotList"), patternRot);
  gl.uniform1fv(gl.getUniformLocation(program, "warpScaleList"), warpScale);
  gl.uniform1fv(gl.getUniformLocation(program, "warpTilingList"), warpTiling);
  gl.uniform3fv(gl.getUniformLocation(program, "flatColorList"), flatColor);
}

// ---------------------------------------------------------------------------------------------
// tiles: 2 columns x 6 rows on the right. row = pattern index (top = 0), column = cube (0 left, 1 right)
// tile id: "tile" + (pattern * 2 + cube)

const tileSize = 50;
const tileFade = 500;                  // ms, fade to/from black
const patternImages = [];              // one offscreen 50 x 50 image per pattern, made by drawTiles
const tileAlpha = new Array(12).fill(0);       // current brightness of each tile, 0 = black
const tileFadeToken = new Array(12).fill(0);   // a newer fade on a tile cancels the older one

function tileIndex(cube, pattern) {
  return pattern * 2 + cube;
}

// draws each pattern once into its offscreen image, then sets every tile to black.
// each pattern is drawn on the cube's front face, filling a tileSize x tileSize corner of the
// gl canvas, then copied out.
function drawTiles() {
  const tileProj = ortho(-1, 1, -1, 1, 0.1, 100);    // front face (-1..1) fills the viewport
  const allFaces = [0, 0, 0, 0, 0, 0];

  gl.viewport(0, 0, tileSize, tileSize);
  gl.enable(gl.DEPTH_TEST);
  gl.uniformMatrix4fv(uPM, false, tileProj);
  gl.uniformMatrix4fv(uMVM, false, mat4Translate(mat4Identity(), [0, 0, -6]));
  setPatternUniforms();

  for (let p = 0; p < 6; p++) {
    for (let f = 0; f < 6; f++) {
      allFaces[f] = p;
    }
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1iv(gl.getUniformLocation(program, "patternNum"), allFaces);
    drawShape(cubeBuffers, mat4Identity());

    // the viewport is the bottom-left corner of the gl canvas
    const img = document.createElement("canvas");
    img.width = tileSize;
    img.height = tileSize;
    img.getContext("2d").drawImage(canvas, 0, canvas.height - tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize);
    patternImages[p] = img;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (let t = 0; t < 12; t++) {
    paintTile(t, 0);
  }
}

// draws a tile: black, with its pattern on top at the given brightness (0..1)
function paintTile(t, alpha) {
  const ctx = document.getElementById("tile" + t).getContext("2d");
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, tileSize, tileSize);
  ctx.globalAlpha = alpha;
  ctx.drawImage(patternImages[Math.floor(t / 2)], 0, 0);
  ctx.globalAlpha = 1;
  tileAlpha[t] = alpha;
}

// fades a tile from its current brightness to "to" (0 = black, 1 = pattern) over tileFade ms
function fadeTile(t, to) {
  const from = tileAlpha[t];
  tileFadeToken[t] = tileFadeToken[t] + 1;
  const token = tileFadeToken[t];
  let t0 = null;

  return new Promise(resolve => {
    function step(now) {
      if (token !== tileFadeToken[t]) {     // a newer fade on this tile took over
        resolve();
        return;
      }
      if (t0 === null) t0 = now;
      const k = Math.min((now - t0) / tileFade, 1);
      paintTile(t, from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------------------------------------
// game state

let tries = 10;
let matches = 0;                                   // distinct pairs matched so far (kept after wrong answers)
let score = 0;                                     // 10 points per new match, times the streak multiplier
let streak = 0;                                    // new matches in a row; a wrong answer resets it to 0
const matched = [false, false, false, false, false, false];        // pattern index -> matched before
const showing = [[false, false, false, false, false, false],       // showing[cube][pattern]: tile lit
                 [false, false, false, false, false, false]];
let firstPick = null;          // { cube, pattern } of the first pick of a turn, null when waiting for one
let resolving = false;         // true while a wrong answer fades out; picks do nothing then
let gameState = "playing";     // "playing", "won" or "lost" (tracked, not displayed yet)

// cross buttons: id = side + "-" + face name. side "left" = cube 0, "right" = cube 1
const crossSides = ["left", "right"];
const crossFaces = { front: 0, back: 1, top: 2, base: 3, right: 4, left: 5 };   // name -> faceIndex

function setCrossDisabled(cube, disabled) {
  for (const name in crossFaces) {
    document.getElementById(crossSides[cube] + "-" + name).disabled = disabled;
  }
}

// guide pulse, after the opening scramble:
//   1. SPIN pulses until it's clicked and the spin finishes
//   2. FRONT pulses until it's clicked and the reset finishes
//   3. the cross to pick from next pulses, until the first correct match:
//      left first, the other cross after a first pick, left again after a wrong round
// a cross pick before steps 1-2 are done skips straight to step 3.
let guideStep = "none";        // "none" (nothing pulses), "spin", "front" or "cross"
let guiding = true;            // turned off by the first correct match

function updatePulse() {
  document.getElementById("spinBtn").classList.toggle("pulsing", guideStep === "spin");
  document.getElementById("frontBtn").classList.toggle("pulsing", guideStep === "front");

  let target = -1;             // cube whose cross pulses, -1 = none
  if (guideStep === "cross" && guiding && !resolving && gameState === "playing") {
    if (firstPick === null) {
      target = 0;
    } else {
      target = 1 - firstPick.cube;
    }
  }
  for (let c = 0; c < 2; c++) {
    document.getElementById(crossSides[c] + "Cross").classList.toggle("pulsing", c === target);
  }
}

function updateScoreboard() {
  document.getElementById("matches").textContent = matches;
  document.getElementById("tries").textContent = tries;
  document.getElementById("score").textContent = score;
}

function showTile(cube, pattern) {
  showing[cube][pattern] = true;
  return fadeTile(tileIndex(cube, pattern), 1);
}

function hideTile(cube, pattern) {
  showing[cube][pattern] = false;
  return fadeTile(tileIndex(cube, pattern), 0);
}

// text over the canvas, white. Returns the fade animation (its .finished resolves when done).
// "Match!": 1.5 s, pulses bigger 3 times over 1 s at full brightness, then fades out over 0.5 s.
// anything else ("Oops!", "Try Again!"): holds for the first 30% of duration, then fades out.
function showResult(text, duration) {
  const el = document.getElementById("resultText");
  el.textContent = text;
  if (text === "Match!") {
    el.animate([
      { transform: "scale(1)" },
      { transform: "scale(1.3)" },
      { transform: "scale(1)" }
    ], { duration: 1000 / 3, iterations: 3, easing: "ease-in-out" });
    return el.animate([
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: 0.667 },
      { opacity: 0, offset: 1 }
    ], { duration: 1500, easing: "ease-in" });
  }
  return el.animate([
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: 0.3 },
    { opacity: 0, offset: 1 }
  ], { duration: duration, easing: "ease-in" });
}

// "x2", "x3" ... at a random spot in the bottom half of the canvas, floats up 120 px and fades out
function showMultiplier(n) {
  const screen = document.getElementById("screen");
  const el = document.createElement("div");
  el.className = "multiplier";
  el.textContent = "x" + n;
  screen.appendChild(el);
  playSound("multiplier");

  const w = canvas.width;
  const h = canvas.height;
  const x = Math.random() * (w - el.offsetWidth);                       // anywhere across
  const y = h / 2 + Math.random() * (h / 2 - el.offsetHeight);          // bottom half
  el.style.left = x + "px";
  el.style.top = y + "px";

  el.animate([
    { transform: "translateY(0px)",    opacity: 1 },
    { transform: "translateY(-120px)", opacity: 0 }
  ], { duration: 1200, easing: "ease-out" }).finished.then(() => el.remove());
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// win: every pair matched and showing. lose: no tries left (never in zen mode).
// the end popup opens after 1.5 s, once Match! or Oops! has played.
function checkWinLose() {
  let allShowing = true;
  for (let p = 0; p < 6; p++) {
    if (!matched[p] || !showing[0][p] || !showing[1][p]) {
      allShowing = false;
    }
  }
  if (allShowing) {
    if (gameMode === "zen") {
      zenNewRound();
    } else {
      gameState = "won";
      showEnd("You Win!!!", 1500, "win");
    }
  } else if (tries <= 0 && gameMode !== "zen") {
    gameState = "lost";
    showEnd("Sorry, maybe next time!", 1500, "lose");
  }
}

// opens the end popup with a title and the final score, after delay ms.
// sound: "win" loops while the popup is up, "lose" plays once
async function showEnd(title, delay, sound) {
  await wait(delay);
  document.getElementById("endTitle").textContent = title;
  document.getElementById("endScore").textContent = "Score: " + score;
  document.getElementById("endDialog").showModal();
  if (sound === "win") {
    playSoundLoop("win");
  } else {
    playSound(sound);
  }
}

// the win loop stops if the popup is closed some other way than HOME (Esc closes it)
document.getElementById("endDialog").addEventListener("close", stopSoundLoop);

// zen mode, every pair matched: keep score, matches and streak; fade the tiles out,
// make new patterns, refill tries, and shuffle the cubes again
async function zenNewRound() {
  resolving = true;                      // no picks until the new round is ready
  setCrossDisabled(0, true);
  setCrossDisabled(1, true);

  await wait(1500);                      // let Match! play with every tile showing
  while (animating) {                    // let a spin or reset that is running finish first
    await wait(50);
  }
  animating = true;                      // SPIN and FRONT do nothing from here until the shuffle ends

  const fades = [];
  for (let c = 0; c < 2; c++) {
    for (let p = 0; p < 6; p++) {
      fades.push(hideTile(c, p));
    }
  }
  await Promise.all(fades);

  newPatterns();                         // init.js: new face mappings and pattern parameters
  drawTiles();                           // new pattern images for the tiles, tiles black
  for (let p = 0; p < 6; p++) {
    matched[p] = false;
  }
  tries = 10;
  updateScoreboard();

  await scramble();                      // 3 random turns, then back to the front

  resolving = false;
  setCrossDisabled(0, false);
  setCrossDisabled(1, false);
  updatePulse();
}

// one try used. tries stop at 0 (in zen mode running out does not lose)
function useTry() {
  if (tries > 0) {
    tries = tries - 1;
  }
}

// wrong answer: the second tile finishes fading in, then every other lit tile fades to black,
// and the two wrong tiles fade half a second after them
async function wrongAnswer(cubeA, patternA, cubeB, patternB) {
  resolving = true;
  setCrossDisabled(0, true);
  setCrossDisabled(1, true);

  await wait(tileFade);
  for (let c = 0; c < 2; c++) {
    for (let p = 0; p < 6; p++) {
      const isWrongA = (c === cubeA && p === patternA);
      const isWrongB = (c === cubeB && p === patternB);
      if (showing[c][p] && !isWrongA && !isWrongB) {
        hideTile(c, p);
      }
    }
  }

  await wait(500);
  await Promise.all([hideTile(cubeA, patternA), hideTile(cubeB, patternB)]);

  resolving = false;
  setCrossDisabled(0, false);
  setCrossDisabled(1, false);
  updatePulse();
}

// a click on a cross button: cube 0 or 1, faceIndex 0..5
function pick(cube, face) {
  if (gameState !== "playing" || resolving) {
    return;
  }
  guideStep = "cross";                   // a pick ends the SPIN / FRONT part of the guide
  const pattern = faceMaps[cube][face];

  if (firstPick === null) {
    firstPick = { cube: cube, pattern: pattern };
    setCrossDisabled(cube, true);        // this cube is done until the other one is picked
    showTile(cube, pattern);
    updatePulse();
    return;
  }

  // second pick, on the other cube
  const first = firstPick;
  firstPick = null;
  setCrossDisabled(first.cube, false);
  showTile(cube, pattern);

  if (pattern === first.pattern) {
    showResult("Match!", 1500);
    playSound("match");
    guiding = false;                     // first correct match ends the guide pulse
    if (!matched[pattern]) {             // new match: costs a try, scores 10 x streak
      matched[pattern] = true;
      matches = matches + 1;
      useTry();
      streak = streak + 1;
      score = score + 10 * streak;
      if (streak >= 2) {
        showMultiplier(streak);
      }
    }                                    // a pair matched before: free, no points, streak unchanged
    updateScoreboard();
    checkWinLose();
  } else {
    streak = 0;
    useTry();
    updateScoreboard();
    checkWinLose();
    playSound("oops");
    const oops = showResult("Oops!", 1000);
    if (gameState === "playing") {       // no "Try Again!" after the last try
      oops.finished.then(() => showResult("Try Again!", 1500));
    }
    wrongAnswer(first.cube, first.pattern, cube, pattern);
  }

  updatePulse();
}

for (let cube = 0; cube < 2; cube++) {
  for (const name in crossFaces) {
    const face = crossFaces[name];
    document.getElementById(crossSides[cube] + "-" + name).addEventListener("click", () => pick(cube, face));
  }
}

let startTime = Date.now();

function render() {
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (const rot of cubeRots) {
    rot[1] += yRotSpeed * 0.01;
    rot[0] += xRotSpeed * 0.01;
    rot[2] += zRotSpeed * 0.01;
  }

  // init model-view matrix as identity matrix
  let modelViewMatrix = mat4Identity();

  //delta time in ms
  let deltaTime = Date.now() - startTime;
  // camera translation
  modelViewMatrix = mat4Translate(modelViewMatrix, [camX, camY, camZ]);
  
  //set time in seconds
  gl.uniform1f(timeLoc, deltaTime/1000.0);
  gl.uniformMatrix4fv(uPM, false, proj);
  gl.uniformMatrix4fv(uMVM, false, modelViewMatrix);

  //making some variables for the shader color parameters
  setPatternUniforms();

  // background plane behind both cubes, scaled from the ortho size so it always fills the whole view
  let planeMatrix = mat4Translate(mat4Identity(), [0, 0, -14]);
  planeMatrix = mat4Scale(planeMatrix, [orthoSize * aspect, orthoSize, 1]);
  gl.uniform1i(gl.getUniformLocation(program, "uvPlane"), 1);
  drawShape(planeBuffers, planeMatrix);
  gl.uniform1i(gl.getUniformLocation(program, "uvPlane"), 0);

  // floating offsets: a small circle per cube, cos in x, sin in y
  const t = deltaTime / 1000;
  const floatX0 = floatRadius * Math.cos(floatSpeed * t + floatPhase[0]);
  const floatY0 = floatRadius * Math.sin(floatSpeed * t + floatPhase[0]);
  const floatX1 = floatRadius * Math.cos(floatSpeed * t + floatPhase[1]);
  const floatY1 = floatRadius * Math.sin(floatSpeed * t + floatPhase[1]);

  // two cubes, offset left and right in x, each with its own rotation and its own face mapping
  const cubeOffsetX = 2.5;
  gl.uniform1iv(gl.getUniformLocation(program, "patternNum"), faceMaps[0]);
  drawShape(cubeBuffers, cubeModelMatrix([-cubeOffsetX + floatX0, floatY0, 0], cubeRots[0]));
  gl.uniform1iv(gl.getUniformLocation(program, "patternNum"), faceMaps[1]);
  drawShape(cubeBuffers, cubeModelMatrix([ cubeOffsetX + floatX1, floatY1, 0], cubeRots[1]));
}

// Initialize when page loads
window.onload = function () {
  init();          // init.js: random face mappings and pattern parameters
  drawTiles();
  updateScoreboard();
  setInterval(render, 30);
}
