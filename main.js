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


const aspect = canvas.width / canvas.height;
let proj = ortho(-2.5 * aspect, 2.5 * aspect, -2.5, 2.5, 0.1, 100);


let animating = false;   // true while any rotation runs; SPIN and FRONT do nothing then

function spin() {
  if (animating) {
    return;
  }
  animating = true;
  Promise.all([AnimateRotation(0, 500), AnimateRotation(1, 500)]).then(() => {
    animating = false;
  });
}

function front() {
  if (animating) {
    return;
  }
  animating = true;
  Promise.all([resetCube(0), resetCube(1)]).then(() => {
    animating = false;
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
async function resetCube(cubeIndex) {
  const history = rotations[cubeIndex];
  const duration = 150;
  for (let i = history.length - 1; i >= 0; i--) {
    const inverse = [-history[i][0], -history[i][1], -history[i][2]];
    await AnimateRotation(cubeIndex, duration, inverse);
  }
  history.length = 0;                                 // everything is undone
}

// model matrix for one cube: translate by offsetX, then rotate Y, X, Z (T * Ry * Rx * Rz)
function cubeModelMatrix(offsetX, rot) {
  let m = mat4Translate(mat4Identity(), [offsetX, 0, 0]);
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
    await Promise.all([AnimateRotation(0, 250), AnimateRotation(1, 250)]);
  }
  await Promise.all([resetCube(0), resetCube(1)]);
  animating = false;
  scrambled = true;
  updatePulse();
}

document.getElementById("instructions").addEventListener("close", scramble);

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

// guide pulse: until the first correct match, the cross to pick from next pulses.
// left after the scramble, the other cross after a first pick, left again after a wrong round.
let scrambled = false;         // the opening scramble has finished
let guiding = true;            // turned off by the first correct match

function updatePulse() {
  let target = -1;             // cube whose cross pulses, -1 = none
  if (guiding && scrambled && !resolving && gameState === "playing") {
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
}

function showTile(cube, pattern) {
  showing[cube][pattern] = true;
  return fadeTile(tileIndex(cube, pattern), 1);
}

function hideTile(cube, pattern) {
  showing[cube][pattern] = false;
  return fadeTile(tileIndex(cube, pattern), 0);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkWinLose() {
  let allShowing = true;
  for (let p = 0; p < 6; p++) {
    if (!matched[p] || !showing[0][p] || !showing[1][p]) {
      allShowing = false;
    }
  }
  if (allShowing) {
    gameState = "won";
  } else if (tries <= 0) {
    gameState = "lost";
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
    guiding = false;                     // first correct match ends the guide pulse
    if (!matched[pattern]) {             // new match: costs a try
      matched[pattern] = true;
      matches = matches + 1;
      tries = tries - 1;
    }                                    // a pair matched before: free
  } else {
    tries = tries - 1;
    wrongAnswer(first.cube, first.pattern, cube, pattern);
  }

  updateScoreboard();
  checkWinLose();
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

  // background plane behind both cubes, scaled to fill the whole view (x -5..5, y -2.5..2.5)
  let planeMatrix = mat4Translate(mat4Identity(), [0, 0, -14]);
  planeMatrix = mat4Scale(planeMatrix, [2.5 * aspect, 2.5, 1]);
  gl.uniform1i(gl.getUniformLocation(program, "uvPlane"), 1);
  drawShape(planeBuffers, planeMatrix);
  gl.uniform1i(gl.getUniformLocation(program, "uvPlane"), 0);

  // two cubes, offset left and right in x, each with its own rotation and its own face mapping
  const cubeOffsetX = 2.5;
  gl.uniform1iv(gl.getUniformLocation(program, "patternNum"), faceMaps[0]);
  drawShape(cubeBuffers, cubeModelMatrix(-cubeOffsetX, cubeRots[0]));
  gl.uniform1iv(gl.getUniformLocation(program, "patternNum"), faceMaps[1]);
  drawShape(cubeBuffers, cubeModelMatrix( cubeOffsetX, cubeRots[1]));
}

// Initialize when page loads
window.onload = function () {
  init();          // init.js: random face mappings and pattern parameters
  drawTiles();
  updateScoreboard();
  setInterval(render, 30);
}
