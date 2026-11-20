/**
 * Shaders do stage WebGL2 (Etapa 2: Hero, morph=0).
 * Instanced quads (evita limite de gl.POINTS em iOS/Windows) com campo
 * gaussiano dos uBlobs[10], repel viscoso do mouse e scanlines na GPU —
 * fidelidade ao GooPanel Canvas 2D. Etapa 3 adiciona o morph p/ o cérebro.
 */

export const VERT_SRC = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec2 aUV;
in vec2 aHome;
in float aSeed;
in float aGlyph;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uBlobs[10];
uniform vec2 uMouse;
uniform float uGlow;
uniform float uCell;
out vec2 vUv;
out float vAlpha;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yz + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float yOff = mod(uTime * 9.0, uCell);
  vec2 base = vec2(aHome.x, mod(aHome.y + yOff + uCell, uRes.y + uCell) - uCell);
  float f = 0.0;
  for (int i = 0; i < 10; i++) {
    vec2 d = base - uBlobs[i].xy;
    float r = uBlobs[i].z;
    f += exp(-dot(d, d) / (2.0 * r * r));
  }
  float gate = smoothstep(0.12, 0.20, f);
  vec2 dm = base - uMouse;
  float md = length(dm);
  float near = (md < 170.0 && md > 0.01) ? (170.0 - md) / 170.0 : 0.0;
  vec2 dir = md > 0.01 ? dm / md : vec2(0.0);
  vec2 world = base + dir * near * 52.0 * uGlow;
  vec2 half_ = vec2(uRes.x * 0.5, uRes.y * 0.5);
  float ed = length((world - half_) / half_);
  float edge = clamp((1.0 - ed) / 0.15, 0.0, 1.0);
  // Troca esporádica de glifos no shader: zero atualização de buffers.
  float q = floor(uTime * 8.0 + aSeed * 7.0);
  float g = aGlyph;
  if (h21(vec2(aSeed * 91.7, q * 13.3)) < 0.12) {
    g = floor(h21(vec2(aSeed * 47.3, q * 7.7)) * 31.0);
  }
  vUv = (aUV + vec2(mod(g, 8.0), floor(g / 8.0))) / 8.0;
  float bright = 0.25 + 0.5 * h21(vec2(g * 7.13 + 0.5, aSeed * 3.7));
  vAlpha = min(0.8, bright * edge * (0.55 + near * uGlow * 0.9)) * gate;
  vec2 corner = aCorner * step(0.002, vAlpha);
  vec2 pos = world + corner * uCell;
  vec2 clip = pos / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`

export const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
in float vAlpha;
uniform sampler2D uAtlas;
uniform float uDpr;
uniform float uTime;
out vec4 oColor;

void main() {
  float a = texture(uAtlas, vUv).a * vAlpha;
  float scan = mod(gl_FragCoord.y + mod(uTime * 9.0, 4.0) * uDpr, 4.0 * uDpr);
  if (scan < 1.0 * uDpr) a *= 0.45;
  if (a < 0.003) discard;
  oColor = vec4(0.745, 0.949, 0.392, a);
}
`
