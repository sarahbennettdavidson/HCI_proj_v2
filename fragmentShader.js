//fragmentShader.js

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

  float value;
  switch (patternNum) {
    case 0:  value = checks;  break;
    case 1:  value = stripes; break;
    case 2:  value = dots;    break;
    default: value = 1.0;     break;
}  
vec3 fc = palette(value*paletteT, paletteParams[0],paletteParams[1],paletteParams[2],paletteParams[3]);// swap in stripes or dots and use palette
fragColor = vec4(fc, 1.0);   
//fragColor = vec4(vUV, 0.0, 1.0);//uv test
}
`;
