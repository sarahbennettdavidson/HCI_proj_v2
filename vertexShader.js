//vertexShader.js

const vertexShaderSource = `#version 300 es
in vec3 aPosition;
in vec3 aColor;
in vec2 aUV;      


uniform float uTime; //time in sec
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelTransformationMatrix;

out vec3 vColor;
out vec3 vPos;
out vec2 vUV;


void main() {
  gl_Position = uProjectionMatrix * uModelViewMatrix * uModelTransformationMatrix * vec4(aPosition,1.0);
  vColor = aColor;
  vPos = aPosition;//pass the pos to the frag shader to do color placements
  vUV=aUV;
}
`;
