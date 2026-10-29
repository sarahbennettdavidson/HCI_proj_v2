//vertexShader.js

const vertexShaderSource = `#version 300 es
in vec3 aPosition;
in vec2 aUV;      


uniform float uTime; //time in sec
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelTransformationMatrix;

out vec3 vPos;
out vec2 vUV;
flat out int faceIndex;


void main() {
  gl_Position = uProjectionMatrix * uModelViewMatrix * uModelTransformationMatrix * vec4(aPosition,1.0);
  vPos = aPosition;//pass the pos to the frag shader to do color placements
  vUV=aUV;
  faceIndex = gl_VertexID / 4; // 4 verts per face: 0 front, 1 back, 2 top, 3 bottom, 4 right, 5 left
}
`;
