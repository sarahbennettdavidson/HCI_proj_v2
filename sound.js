// sound.js: which sound plays when. Uses ZzFX (ZzFXMicro.js, loaded before this file).
// https://github.com/KilledByAPixel/ZzFX
//
// each list is zzfx parameters (for example from the ZzFX sound designer). an empty list plays nothing.
//
// parameter order (empty = default):
//   0 volume, 1 randomness, 2 frequency, 3 attack, 4 sustain, 5 release,
//   6 shape (0 sin, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square), 7 shapeCurve,
//   8 slide, 9 deltaSlide, 10 pitchJump, 11 pitchJumpTime, 12 repeatTime, 13 noise,
//   14 modulation, 15 bitCrush, 16 delay, 17 sustainVolume, 18 decay, 19 tremolo, 20 filter

const sounds = {
  // any enabled button that is not a cross button: SPIN, FRONT, QUIT, popup buttons
  click:      [1.6,,89,,,.01,,,-2,21,,,,,129,,,.78,.06], // Random 22

  // a cross button (Top, Left, Front, Right, Back, Base)
  crossClick: [1.1,,267,,.01,.07,2,.7,3,9,154,.06,.01,,,,.01,.8,.05,,-632], // Random 39

  // cubes start a spin: SPIN, and each turn of the opening scramble
  spin:       [1.7,,564,.28,.12,.005,1,1.3,,,141,.41,.1,.1,.7,,.13,.8,.07,.17], // Random 19

  // each rotation step back to the front: FRONT, and after the scramble
  reset:      [,,390,.08,.06,.006,1,2,,,123,.41,,.1,,.9,,.9,.44,.26], // Random 14

  // Match!
  match:      [,,877,.01,.08,.36,,1.3,,,300,.06,,,,,,.94,.05], // Random 110

  // Oops! (match missed)
  oops:       [,,390,.08,.06,.006,1,2,,,123,.41,,.1,,.9,,.9,.44,.26], // Random 14

  // x2, x3 ... appears
  multiplier: [1, 0, 1047, 0, .1, .1],

  // loops while the win popup is up
  win:        [5,,62,.38,.11,,1,1.8,,2,120,,.1,,,.2,,.63,.15,,-683], // Random 121

  // once, when the lose popup appears
  lose:       [,,611,.01,.08,.009,,1.9,,,,,,,134,.8,,.95,.22,,178], // Random 142
};

function playSound(name) {
  if (sounds[name].length > 0) {
    zzfx(...sounds[name]);
  }
}

// a sound that repeats until stopSoundLoop() is called
let loopSource = null;

function playSoundLoop(name) {
  if (sounds[name].length > 0) {
    loopSource = zzfx(...sounds[name]);   // zzfx returns the playing source
    loopSource.loop = true;
  }
}

function stopSoundLoop() {
  if (loopSource !== null) {
    loopSource.stop();
    loopSource = null;
  }
}

// browsers keep audio paused until the page has been clicked; resume it on any press
document.addEventListener("pointerdown", () => {
  if (zzfxX.state === "suspended") {
    zzfxX.resume();
  }
});

// any press of an enabled button: cross buttons have their own sound
document.addEventListener("pointerdown", e => {
  const button = e.target.closest("button");
  if (button && !button.disabled) {
    if (button.closest(".cross")) {
      playSound("crossClick");
    } else {
      playSound("click");
    }
  }
});
