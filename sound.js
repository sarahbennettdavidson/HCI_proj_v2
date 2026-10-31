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
  // any enabled button that is not a cross button or QUIT: SPIN, FRONT, popup buttons
  click:      [1.6,,89,,,.01,,,-2,21,,,,,129,,,.78,.06], // Random 22

  // QUIT (main.js plays it and reloads the page when it ends)
  quit:       [.6,,10,,.48,.02,3,1.9,,,47,.06,.12,.3,,.1,,.68,.06,.01,-905], // Random 265

  // a cross button (Top, Left, Front, Right, Back, Base)
  crossClick: [1.2,,480,,.04,.11,,2.3,,169,,,,.4,,,.03,.79,,,-841], // Pickup 139

  // cubes start a spin: SPIN, and each turn of the opening scramble
  spin:       [1.9,,137,,.11,.02,1,2.3,,,-43,.09,.04,,,,.03,.87,.02,.18], // Random 145

  // each rotation step back to the front: FRONT, and after the scramble
  reset:      [2,,9,.04,.03,.03,,2.5,-5,34,124,.04,.01,,,,.23,.59,.12], // Random 235

  // Match!
  match:      [1.6,,347,.1,.28,.39,,.9,-8,9,207,.2,.1,,,.1,.12,.55,.24], // Powerup 21

  // Oops! (match missed)
  oops:       [,,351,.07,.19,.02,,.6,,,,,,,88,,,.5,.35], // Random 122

  // x2, x3 ... appears
  multiplier: [1, 0, 1047, 0, .1, .1],

  // loops while the win popup is up
  win:        [5,,62,.38,.11,,1,1.8,,2,120,,.1,,,.2,,.63,.15,,-683], // Random 121

  // once, when the lose popup appears
  lose:       [,,611,.01,.08,.009,,1.9,,,,,,,134,.8,,.95,.22,,178], // Random 142
};

// plays a sound. returns the playing source (its onended fires when it finishes), or null if the list is empty
function playSound(name) {
  if (sounds[name].length > 0) {
    return zzfx(...sounds[name]);
  }
  return null;
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

// any press of an enabled button: cross buttons have their own sound, QUIT plays its own from main.js
document.addEventListener("pointerdown", e => {
  const button = e.target.closest("button");
  if (button && !button.disabled) {
    if (button.closest(".cross")) {
      playSound("crossClick");
    } else if (button.id !== "quitBtn") {
      playSound("click");
    }
  }
});
