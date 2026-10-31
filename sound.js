// sound.js: which sound plays when. Uses ZzFX (ZzFXMicro.js, loaded before this file).
// https://github.com/KilledByAPixel/ZzFX
//
// for now every sound is a plain sine tone, 0.2 s, each at its own frequency.
// replace a list with your own zzfx parameters (for example from the ZzFX sound designer).
// an empty list plays nothing.
//
// parameter order (empty = default):
//   0 volume, 1 randomness, 2 frequency, 3 attack, 4 sustain, 5 release,
//   6 shape (0 sin, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square), 7 shapeCurve,
//   8 slide, 9 deltaSlide, 10 pitchJump, 11 pitchJumpTime, 12 repeatTime, 13 noise,
//   14 modulation, 15 bitCrush, 16 delay, 17 sustainVolume, 18 decay, 19 tremolo, 20 filter

//                 volume, randomness, frequency, attack, sustain, release
const sounds = {
  click:      [1, 0, 880,  0, .1, .1],   // any enabled button pressed
  spin:       [.6,,950,.09,.01,.17,5,1.512854044655257,,,-321,.16,,,,,.07,.92,.02,,519], // Random 13
                                         // cubes start a spin: SPIN, and each turn of the opening scramble
  reset:      [1, 0, 262,  0, .1, .1],   // each rotation step back to the front: FRONT, and after the scramble
  match:      [1, 0, 659,  0, .1, .1],   // Match!
  oops:       [1, 0, 196,  0, .1, .1],   // Oops! (wrong answer)
  multiplier: [1, 0, 1047, 0, .1, .1],   // x2, x3 ... appears
};

function playSound(name) {
  if (sounds[name].length > 0) {
    zzfx(...sounds[name]);
  }
}

// browsers keep audio paused until the page has been clicked; resume it on any press
document.addEventListener("pointerdown", () => {
  if (zzfxX.state === "suspended") {
    zzfxX.resume();
  }
});

// any press of an enabled button
document.addEventListener("pointerdown", e => {
  const button = e.target.closest("button");
  if (button && !button.disabled) {
    playSound("click");
  }
});
