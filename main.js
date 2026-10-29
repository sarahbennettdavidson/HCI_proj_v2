//main.js
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
let patternID = [0, 1, 2, 3, 4, 5]; // pattern per face: front, back, top, bottom, right, left (dummy)
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

let cubeRotX = 0, cubeRotY = 0, cubeRotZ = 0;
let camX = 0, camY = 0, camZ = -6;

//put palette values here

const paletteValues = new Float32Array([0.5, 0.5, 0.5,   0.5, 0.5, 0.5,   1, 1, 1,   0, 0.33, 0.67]);
const paletteT = 0.5;
const patternSize = 4;
const blur = 0.001;
const patternRot = 0;
const warpScale = 0.1;   // dummy value
const warpTiling = 1;    // dummy value
const flatColor = [0.8, 0.3, 0.2];   // dummy value, rgb 0..1
const xRotSpeed = 0;
const yRotSpeed = 0;
const zRotSpeed = 0;


const aspect = canvas.width / canvas.height;
let proj = ortho(-2.5 * aspect, 2.5 * aspect, -2.5, 2.5, 0.1, 100);


function spin() {
  console.log("SPIN");
}

function front() {
  console.log("FRONT");
}

document.getElementById("spinBtn").addEventListener("click", spin);
document.getElementById("frontBtn").addEventListener("click", front);

let startTime = Date.now();

function render() {
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  cubeRotY += yRotSpeed * 0.01;
  cubeRotX += xRotSpeed * 0.01;
  cubeRotZ += zRotSpeed * 0.01;


  // rotation matrices
  let cx = Math.cos(cubeRotY), sx = Math.sin(cubeRotY);
  let cy = Math.cos(cubeRotX), sy = Math.sin(cubeRotX);
  let cz = Math.cos(cubeRotZ), sz = Math.sin(cubeRotZ);

  let rotX = [1, 0, 0, 0, 0, cy, sy, 0, 0, -sy, cy, 0, 0, 0, 0, 1];
  let rotY = [cx, 0, -sx, 0, 0, 1, 0, 0, sx, 0, cx, 0, 0, 0, 0, 1];
  let rotZ = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  let cubeRotation = multiplyMat4(multiplyMat4(rotY, rotX), rotZ);

  // init model-view matrix as identity matrix
  let modelViewMatrix = mat4Identity();
  // init model transformation matrix as identity matrix
  let modelTransformationMatrix = mat4Identity();

  //delta time in ms
  let deltaTime = Date.now() - startTime;
  // object rotation
  modelTransformationMatrix = multiplyMat4(modelTransformationMatrix, cubeRotation);
  // camera translation
  modelViewMatrix = mat4Translate(modelViewMatrix, [camX, camY, camZ]);
  
  //set time in seconds
  gl.uniform1f(timeLoc, deltaTime/1000.0);
  gl.uniformMatrix4fv(uPM, false, proj);
  gl.uniformMatrix4fv(uMVM, false, modelViewMatrix);

  //making some variables for the shader color parameters
  gl.uniform1iv(gl.getUniformLocation(program, "patternNum"), patternID);
  gl.uniform3fv(gl.getUniformLocation(program, "paletteParams"), paletteValues);
  gl.uniform1f(gl.getUniformLocation(program, "paletteT"), paletteT);
  gl.uniform1f(gl.getUniformLocation(program, "patternSize"), patternSize);
  gl.uniform1f(gl.getUniformLocation(program, "blur"), blur);
  gl.uniform1f(gl.getUniformLocation(program, "patternRot"), patternRot);
  gl.uniform1f(gl.getUniformLocation(program, "warpScale"), warpScale);
  gl.uniform1f(gl.getUniformLocation(program, "warpTiling"), warpTiling);
  gl.uniform3fv(gl.getUniformLocation(program, "flatColor"), flatColor);


  drawShape(cubeBuffers, modelTransformationMatrix);
}

// Initialize when page loads
window.onload = function () {
  setInterval(render, 30);
}
