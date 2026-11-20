/**
 * Shaders do stage WebGL2 (Etapa 3: Hero morph -> cérebro).
 * Pontos: instanced quads com campo gaussiano (Hero) + espiral com stagger
 * + projeção 3D com depth fog (cérebro) + onda sináptica radial.
 * Linhas: 2ª passada levíssima (gl.LINES), visível com morph > 0.6.
 * O chunk BRAIN_COMMON é a única fonte do transform 3D — pontos e linhas
 * nunca descolam na rotação.
 */
import { GLYPH_ORDER } from './glyphAtlas'

/** Nº de glifos no atlas — sorteio `0..GLYPH_COUNT` no shader. */
const GLYPH_COUNT = `${GLYPH_ORDER.length}.0`

const BRAIN_COMMON = `
uniform vec2 uRes;
uniform float uTime;
uniform float uMorph;
uniform float uAngleY;
uniform float uTiltX;
uniform float uBrainScale;
uniform vec2 uCenter;
uniform float uFocal;
uniform vec3 uPulseOrigin;
uniform float uPulseTime;
uniform float uPulseBoost;

void brainProject(vec3 bp, out vec2 screen, out float depth01, out float persp) {
  float cy = cos(uAngleY);
  float sy = sin(uAngleY);
  vec3 p = vec3(cy * bp.x + sy * bp.z, bp.y, -sy * bp.x + cy * bp.z);
  float cx = cos(uTiltX);
  float sx = sin(uTiltX);
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  float ps = uFocal / (uFocal + p.z);
  screen = uCenter + p.xy * uBrainScale * ps;
  depth01 = clamp(p.z * 0.5 + 0.5, 0.0, 1.0);
  persp = ps;
}

float synWave(vec3 bp) {
  if (uPulseTime < 0.0) return 0.0;
  float rr = uPulseTime * 1.6;
  float dd = length(bp - uPulseOrigin);
  float gap = (dd - rr) * (dd - rr);
  return exp(-gap / 0.18) * exp(-uPulseTime * 1.1) * (0.6 + 0.6 * uPulseBoost);
}
`

const HASH_GLSL = `
float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`

export const VERT_SRC = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec2 aUV;
in vec2 aHomePos;
in vec3 aBrainPos;
in vec4 aMeta;
uniform vec3 uBlobs[10];
uniform vec2 uMouse;
uniform float uGlow;
uniform float uCell;
${BRAIN_COMMON}
${HASH_GLSL}
out vec2 vUv;
out float vAlpha;
out float vMix;
out float vRidge;
out float vWave;
out float vDepth;

void main() {
  float ridge = aMeta.x;
  float seed = aMeta.y;
  float glyph = aMeta.z;
  float t = clamp((uMorph - seed * 0.45) / 0.55, 0.0, 1.0);
  float e = t * t * (3.0 - 2.0 * t);
  // Ramo Hero: campo gaussiano + repel (repel desvanece com o morph).
  float yOff = mod(uTime * 9.0, uCell);
  vec2 base = vec2(aHomePos.x, mod(aHomePos.y + yOff + uCell, uRes.y + uCell) - uCell);
  float f = 0.0;
  for (int i = 0; i < 10; i++) {
    vec2 d = base - uBlobs[i].xy;
    float r = uBlobs[i].z;
    f += exp(-dot(d, d) / (2.0 * r * r));
  }
  // Limiar duro igual ao original ("if f < 0.15 continue"): campo cheio.
  float gate = step(0.15, f);
  vec2 dm = base - uMouse;
  float md = length(dm);
  float prox = (md < 170.0 && md > 0.01) ? (170.0 - md) / 170.0 : 0.0;
  vec2 dir = md > 0.01 ? dm / md : vec2(0.0);
  vec2 homeW = base + dir * prox * 52.0 * uGlow * (1.0 - uMorph);
  vec2 halfv = vec2(uRes.x * 0.5, uRes.y * 0.5);
  float ed = length((homeW - halfv) / halfv);
  float edge = clamp((1.0 - ed) / 0.15, 0.0, 1.0);
  // Ramo cérebro: mesma projeção das linhas (BRAIN_COMMON).
  vec2 bScreen;
  float depth;
  float persp;
  brainProject(aBrainPos, bScreen, depth, persp);
  vec2 radial = aHomePos - uCenter;
  vec2 tang = vec2(-radial.y, radial.x) / (length(radial) + 1e-3);
  vec2 pos = mix(homeW, bScreen, e) + tang * sin(e * 3.14159) * (uBrainScale * 0.12) * (0.4 + 0.6 * seed);
  // Random walk persistente como o GooPanel 2D (zero atualização de buffers):
  // o glifo vale o último sorteio — olha até 12 quanta p/ trás, então o
  // campo inteiro mistura de verdade (~0.7 trocas/s) em vez de piscar em
  // torno de um padrão base estático.
  float q = floor(uTime * 4.0 + seed * 11.0);
  float g = glyph;
  for (int k = 0; k < 12; k++) {
    float qq = q - float(k);
    if (h21(vec2(seed * 91.7, qq * 13.3)) < 0.18) {
      g = floor(h21(vec2(seed * 47.3, qq * 7.7)) * ${GLYPH_COUNT});
      break;
    }
  }
  vUv = (aUV + vec2(mod(g, 8.0), floor(g / 8.0))) / 8.0;
  float bright = 0.25 + 0.75 * h21(vec2(g * 7.13 + 0.5, seed * 3.7));
  float aHero = min(0.8, bright * edge * (0.55 + prox * uGlow * 0.9)) * gate;
  float fogA = mix(0.30, 1.0, depth);
  float aBrain = (0.30 + 0.70 * ridge) * fogA;
  float wave = synWave(aBrainPos);
  vAlpha = mix(aHero, aBrain, e) + wave * 0.55 * e;
  vMix = e;
  vRidge = ridge;
  vWave = wave * e;
  vDepth = depth;
  float sz = mix(uCell, uCell * 0.85 * persp, e);
  vec2 corner = aCorner * step(0.002, vAlpha);
  pos += corner * sz;
  vec2 clip = pos / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`

export const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
in float vAlpha;
in float vMix;
in float vRidge;
in float vWave;
in float vDepth;
uniform sampler2D uAtlas;
uniform float uDpr;
uniform float uTime;
out vec4 oColor;

void main() {
  float a = texture(uAtlas, vUv).a * vAlpha;
  float scan = mod(gl_FragCoord.y + mod(uTime * 9.0, 4.0) * uDpr, 4.0 * uDpr);
  if (scan < 1.0 * uDpr) a *= 0.45;
  if (a < 0.003) discard;
  vec3 hero = vec3(0.780, 0.800, 0.831);
  vec3 shade = mix(vec3(0.32, 0.33, 0.36), hero, pow(vRidge, 1.3));
  shade *= mix(0.55, 1.0, vDepth);
  vec3 col = mix(hero, shade, vMix);
  col = mix(col, vec3(0.95, 0.96, 0.98), clamp(vWave * 1.3, 0.0, 1.0));
  oColor = vec4(col, a);
}
`

export const LINE_VERT_SRC = `#version 300 es
precision highp float;
in vec2 aHome;
in vec3 aBrain;
in float aSeed;
in float aRidge;
uniform float uCell;
${BRAIN_COMMON}
out float vAlpha;

void main() {
  float t = clamp((uMorph - aSeed * 0.45) / 0.55, 0.0, 1.0);
  float e = t * t * (3.0 - 2.0 * t);
  float yOff = mod(uTime * 9.0, uCell);
  vec2 home = vec2(aHome.x, mod(aHome.y + yOff + uCell, uRes.y + uCell) - uCell);
  vec2 bScreen;
  float depth;
  float persp;
  brainProject(aBrain, bScreen, depth, persp);
  vec2 pos = mix(home, bScreen, e);
  float vis = smoothstep(0.60, 0.85, uMorph);
  float wave = synWave(aBrain);
  vAlpha = vis * (0.10 + 0.30 * aRidge) * mix(0.3, 1.0, depth) + wave * 0.5 * vis;
  vec2 clip = pos / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`

export const LINE_FRAG_SRC = `#version 300 es
precision highp float;
in float vAlpha;
out vec4 oColor;

void main() {
  if (vAlpha < 0.004) discard;
  oColor = vec4(0.55, 0.57, 0.61, vAlpha);
}
`
