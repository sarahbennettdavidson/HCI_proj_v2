const fragmentShaderSource = `#version 300 es
precision mediump float;
in vec3 vColor;
in vec3 vPos;//to get color placements from vertex shader
in vec2 vUV;

uniform int patternNum;
uniform vec3 paletteParams[4];
uniform float paletteT;
uniform float patternSize;
uniform float blur;
uniform float patternRot;
uniform float warpScale;   // warp amplitude, in UV units
uniform float warpTiling;  // sine waves per UV unit
uniform vec3 flatColor;    // rgb for the flat pattern

out vec4 fragColor;

//https://iquilezles.org/articles/palettes/
// cosine based palette, 4 vec3 params
vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.283185*(c*t+d) );
}
vec2 rotate2D(vec2 posit, float ang){
    posit -= 0.5;
    posit =  mat2(cos(ang),-sin(ang),
                sin(ang),cos(ang)) * posit;
    posit += 0.5;
    return posit;
}
 vec2 brickTile(vec2 p){
    // Here is where the offset is happening
    p.x += step(1., mod(p.y,2.0)) * 0.5;
    return fract(p);
}
void main() {
  vec2 uv = vUV;
  float ang = patternRot;   // 45 degrees
  uv -= 0.5;
  uv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uv;
  uv += 0.5;
  vec2 p = uv * patternSize;
  float tx = abs(fract((p.x - 0.5) * 0.5) * 2.0 - 1.0);
  float ty = abs(fract((p.y - 0.5) * 0.5) * 2.0 - 1.0);
  float ox = 1.0 - smoothstep(0.5 - blur, 0.5 + blur, tx);
  float oy = 1.0 - smoothstep(0.5 - blur, 0.5 + blur, ty);
  float checks = ox + oy - 2.0 * ox * oy;
  float stripes = 1.0 - smoothstep(0.5 - blur, 0.5 + blur, ty);
  float dots    = 1.0 - smoothstep(0.33-blur, 0.33+blur, length(brickTile(p) - 0.5));

  // warped stripes: https://andreashackel.de/blog/2017-10-03-stripes-shader-1/
  // stripes run along y here, so y is pushed by a sine wave over x
  vec2 w = uv;
  w.y += sin(w.x * warpTiling * 6.283185) * warpScale;
  vec2 pw = w * patternSize;
  float twy = abs(fract((pw.y - 0.5) * 0.5) * 2.0 - 1.0);
  float warpedStripes = 1.0 - smoothstep(0.5 - blur, 0.5 + blur, twy);

  float value;
  switch (patternNum) {
    case 0:  value = checks;        break;
    case 1:  value = stripes;       break;
    case 2:  value = dots;          break;
    case 3:  value = warpedStripes; break;
    case 4:  value = 0.0;           break; // uvGradient, color set below
    case 5:  value = 0.0;           break; // flat, color set below
    default: value = 1.0;           break;
}
vec3 fc = palette(value*paletteT, paletteParams[0],paletteParams[1],paletteParams[2],paletteParams[3]);// swap in stripes or dots and use palette
if (patternNum == 4) fc = vec3(vUV, 0.0); // uvGradient: red = u, green = v
if (patternNum == 5) fc = flatColor;       // flat
fragColor = vec4(fc, 1.0);
//fragColor = vec4(vUV, 0.0, 1.0);//uv test
}
`;
