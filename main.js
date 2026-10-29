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
const patternNames = ["Checks", "Stripes", "Dots", "WarpedStripes", "uvGradient", "Flat"];
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

// on closing the instructions popup: 3 random rotations per cube, 250 ms each, one after another
async function scramble() {
  animating = true;
  for (let i = 0; i < 3; i++) {
    await Promise.all([AnimateRotation(0, 250), AnimateRotation(1, 250)]);
  }
  animating = false;
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

// draws each pattern once into the tiles on the right, in pattern index order (top row = 0).
// both columns show the same patterns for now.
// each pattern is drawn on the cube's front face, filling a tileSize x tileSize corner of the
// gl canvas, then copied into the tile canvases.
function drawTiles() {
  const tileSize = 50;
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
    for (let col = 0; col < 2; col++) {
      const tile = document.getElementById("tile" + (p * 2 + col));
      tile.getContext("2d").drawImage(canvas, 0, canvas.height - tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize);
    }
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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
  setInterval(render, 30);
}
