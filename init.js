// init.js: random starting values. main.js calls init() once when the page loads.

// face-to-pattern mapping per cube: faceMaps[cube][faceIndex] = pattern index
//   cube:      0 = left, 1 = right
//   faceIndex: 0 front, 1 back, 2 top, 3 bottom, 4 right, 5 left
//   pattern:   0 Checks, 1 Stripes, 2 Dots, 3 WarpedStripes, 4 uvGradient, 5 Flat
let faceMaps;

// pattern parameters, one set per pattern (index = pattern index 0..5), sent to the fragment shader
let paletteValues;   // 6 patterns x 4 rgb (a, b, c, d of the cosine palette) = 72 floats
let paletteT;        // 6 floats
let patternSize;     // 6 floats
let blur;            // 6 floats
let patternRot;      // 6 floats
let warpScale;       // 6 floats
let warpTiling;      // 6 floats
let flatColor;       // 6 rgb, 0..1 = 18 floats

// random float from min up to max
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// returns 0..n-1 in random order (Fisher-Yates shuffle)
function shuffledIndices(n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    list.push(i);
  }
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function init() {
  faceMaps = [shuffledIndices(6), shuffledIndices(6)];

  paletteValues = new Float32Array(6 * 12);
  paletteT      = new Float32Array(6);
  patternSize   = new Float32Array(6);
  blur          = new Float32Array(6);
  patternRot    = new Float32Array(6);
  warpScale     = new Float32Array(6);
  warpTiling    = new Float32Array(6);
  flatColor     = new Float32Array(6 * 3);

  for (let p = 0; p < 6; p++) {
    const base = p * 12;                            // this pattern's 4 palette rgb values
    for (let ch = 0; ch < 3; ch++) {
      paletteValues[base + 0 + ch] = randRange(0.2, 0.8);   // a: base color
      paletteValues[base + 3 + ch] = randRange(0.2, 0.5);   // b: amplitude
      paletteValues[base + 6 + ch] = randRange(0.5, 1.5);   // c: frequency
      paletteValues[base + 9 + ch] = randRange(0.0, 1.0);   // d: phase
      flatColor[p * 3 + ch] = Math.random();
    }

    paletteT[p]    = randRange(0.3, 1.0);
    patternSize[p] = randRange(2, 10);
    blur[p]        = randRange(0.001, 0.05);
    patternRot[p]  = randRange(0, 2 * Math.PI);
    warpScale[p]   = randRange(0.0, 0.2);
    warpTiling[p]  = randRange(1, 4);
  }
}
