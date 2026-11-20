/**
 * Nuvem de pontos anatômica do cérebro (procedural, determinística).
 * Retorna só Float32Arrays — se o gerador for trocado por nuvem extraída
 * de .obj CC0, o shader não muda uma linha.
 * Eixos: x lateral, y vertical, z longitudinal (frente +z). Raio ~1.
 */

export type BrainCloud = {
  count: number
  /** n*3, espaço ~[-1, 1] */
  positions: Float32Array
  /** n, 0..1 (cristas claras / sulcos escuros) */
  ridge: Float32Array
  /** n, 1 frontal · 2 parietal · 3 temporal · 4 occipital · 5 cerebelo · 6 eixo */
  lobe: Float32Array
  /** n, 0..1 stagger do morph */
  seeds: Float32Array
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randn(rand: () => number): number {
  const u = Math.max(rand(), 1e-9)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const sstep = (a: number, b: number, x: number): number => clamp01((x - a) / (b - a))

const GRAD = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1,
  1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
])

type Noise3 = (x: number, y: number, z: number) => number

/** Contribuição de um canto do simplex (Gustavson). */
function corner(
  perm12: Uint8Array,
  ii: number,
  jj: number,
  kk: number,
  x: number,
  y: number,
  z: number,
): number {
  const g = perm12[ii + perm12[jj + perm12[kk]]] * 3
  let t = 0.6 - x * x - y * y - z * z
  if (t < 0) return 0
  t *= t
  return t * t * (GRAD[g] * x + GRAD[g + 1] * y + GRAD[g + 2] * z)
}

/** Simplex 3D compacto com permutação semeada (superfície orgânica). */
function makeNoise3D(rand: () => number): Noise3 {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  const perm = new Uint8Array(512)
  const perm12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    perm12[i] = perm[i] % 12
  }
  const F = 1 / 3
  const G = 1 / 6
  return (x, y, z) => {
    const s = (x + y + z) * F
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const k = Math.floor(z + s)
    const t = (i + j + k) * G
    const x0 = x - (i - t)
    const y0 = y - (j - t)
    const z0 = z - (k - t)
    let i1 = 0
    let j1 = 0
    let k1 = 0
    let i2 = 0
    let j2 = 0
    let k2 = 0
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1
      }
    } else if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0
    }
    const ii = i & 255
    const jj = j & 255
    const kk = k & 255
    const n =
      corner(perm12, ii, jj, kk, x0, y0, z0) +
      corner(perm12, ii + i1, jj + j1, kk + k1, x0 - i1 + G, y0 - j1 + G, z0 - k1 + G) +
      corner(perm12, ii + i2, jj + j2, kk + k2, x0 - i2 + 2 * G, y0 - j2 + 2 * G, z0 - k2 + 2 * G) +
      corner(perm12, ii + 1, jj + 1, kk + 1, x0 - 1 + 3 * G, y0 - 1 + 3 * G, z0 - 1 + 3 * G)
    return 32 * n
  }
}

/** Direção aleatória uniforme na esfera (gaussiana normalizada). */
function sphereDir(rand: () => number, out: Float32Array, o: number): void {
  const x = randn(rand)
  const y = randn(rand)
  const z = randn(rand)
  const l = Math.hypot(x, y, z) || 1
  out[o] = x / l
  out[o + 1] = y / l
  out[o + 2] = z / l
}

function lobeOf(x: number, y: number, zl: number): number {
  if (zl > 0.3) return 1
  if (zl < -0.35) return 4
  if (y < -0.12 && zl > -0.45) return 3
  return 2
}

/** Um ponto de hemisfério (side −1 esq / +1 dir) com dobras corticais. */
function hemiPoint(
  noise: Noise3,
  rand: () => number,
  side: number,
  out: Float32Array,
  o: number,
): { ridge: number; lobe: number } {
  const dir = new Float32Array(3)
  sphereDir(rand, dir, 0)
  const cx = side * 0.36
  const cy = 0.06
  const cz = -0.04
  let x = cx + dir[0] * 0.46
  let y = cy + dir[1] * 0.6
  let z = cz + dir[2] * 0.76
  const zl = dir[2]
  // Frontal mais estreito, occipital mais cheio.
  const taper = 1 - 0.3 * sstep(0.05, 0.8, zl)
  x = cx + (x - cx) * taper
  if (zl < -0.4) x = cx + (x - cx) * 1.07
  // Fissura longitudinal: muros planos, gap central ~0.11.
  if (y > -0.02) {
    const wall = 0.055 + 0.02 * rand()
    if (Math.abs(x) < wall) x = (x >= 0 ? 1 : -1) * wall || side * wall
  }
  // Recorte inferior do temporal + assoalho posterior (fossa do cerebelo).
  y += 0.09 * sstep(0.05, 0.6, zl) * sstep(0.3, 0.55, -y)
  if (zl < -0.2) y = Math.max(y, -0.46)
  y = Math.max(y, -0.6)
  // Giros e sulcos: ridge desloca o raio e vira o atributo de brilho.
  const n = noise(x * 3.1, y * 3.1, z * 3.1)
  const ridge = 1 - Math.abs(n)
  const lump = noise(x * 1.3 + 5.2, y * 1.3, z * 1.3)
  const fine = noise(x * 6.7 + 9.1, y * 6.7, z * 6.7)
  const disp = (ridge - 0.55) * 0.13 + lump * 0.06 + fine * 0.025
  const nx = x - cx
  const ny = y - cy
  const nz = z - cz
  const nl = Math.hypot(nx, ny, nz) || 1
  x += (nx / nl) * disp
  y += (ny / nl) * disp
  z += (nz / nl) * disp
  out[o] = x
  out[o + 1] = y
  out[o + 2] = z
  return { ridge: Math.pow(clamp01(ridge), 1.3), lobe: lobeOf(x, y, zl) }
}

/** Cerebelo: menor, denso, posterior-inferior, pregas finas. */
function cerebellumPoint(noise: Noise3, rand: () => number, out: Float32Array, o: number): number {
  const dir = new Float32Array(3)
  sphereDir(rand, dir, 0)
  let x = dir[0] * 0.36
  let y = -0.6 + dir[1] * 0.19
  let z = -0.5 + dir[2] * 0.3
  if (y > -0.55 && Math.abs(x) < 0.02) x = (x >= 0 ? 1 : -1) * 0.02
  const n = noise(x * 5.2 + 3.7, y * 5.2, z * 5.2)
  const ridge = 1 - Math.abs(n)
  const disp = (ridge - 0.55) * 0.05
  const nl = Math.hypot(x, y + 0.6, z + 0.5) || 1
  out[o] = x + (x / nl) * disp
  out[o + 1] = y + ((y + 0.6) / nl) * disp
  out[o + 2] = z + ((z + 0.5) / nl) * disp
  return Math.pow(clamp01(ridge), 1.1)
}

export function buildBrainGeometry(total: number, seed = 7): BrainCloud {
  const rand = mulberry32(seed)
  const noise = makeNoise3D(rand)
  const hemiEach = Math.round(total * 0.4)
  const cereb = Math.round(total * 0.14)
  const stem = Math.max(8, Math.round(total * 0.02))
  const call = Math.max(0, total - hemiEach * 2 - cereb - stem)
  const count = hemiEach * 2 + cereb + stem + call
  const positions = new Float32Array(count * 3)
  const ridge = new Float32Array(count)
  const lobe = new Float32Array(count)
  const seeds = new Float32Array(count)
  let i = 0
  const put = (x: number, y: number, z: number, r: number, l: number) => {
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    ridge[i] = r
    lobe[i] = l
    seeds[i] = rand()
    i++
  }
  const tmp = new Float32Array(3)
  for (let k = 0; k < hemiEach; k++) {
    const L = hemiPoint(noise, rand, -1, tmp, 0)
    put(tmp[0], tmp[1], tmp[2], L.ridge, L.lobe)
    const R = hemiPoint(noise, rand, 1, tmp, 0)
    put(tmp[0], tmp[1], tmp[2], R.ridge, R.lobe)
  }
  for (let k = 0; k < cereb; k++) {
    cerebellumPoint(noise, rand, tmp, 0)
    put(tmp[0], tmp[1], tmp[2], Math.pow(clamp01(1 - Math.abs(noise(tmp[0] * 5.2 + 3.7, tmp[1] * 5.2, tmp[2] * 5.2))), 1.1), 5)
  }
  for (let k = 0; k < stem; k++) {
    const t = rand()
    const ang = rand() * Math.PI * 2
    const r = 0.085 * (1 - 0.25 * t)
    put(Math.cos(ang) * r, -0.6 - t * 0.26, -0.28 - t * 0.16 + (rand() - 0.5) * 0.06, 0.25, 6)
  }
  for (let k = 0; k < call; k++) {
    put((rand() - 0.5) * 0.16, -0.02 + rand() * 0.3, -0.32 + rand() * 0.64, 0.35, 6)
  }
  return { count, positions, ridge, lobe, seeds }
}

function dist2(a: Float32Array, i: number, b: Float32Array, j: number): number {
  const dx = a[i * 3] - b[j * 3]
  const dy = a[i * 3 + 1] - b[j * 3 + 1]
  const dz = a[i * 3 + 2] - b[j * 3 + 2]
  return dx * dx + dy * dy + dz * dz
}

/** ~E pares sinápticos: vizinhos corticais + corpo caloso + cerebelo local. */
export function buildSynapses(
  positions: Float32Array,
  lobe: Float32Array,
  edges: number,
  seed = 21,
): Uint32Array {
  const rand = mulberry32(seed)
  const n = lobe.length
  const cortical: number[] = []
  const left: number[] = []
  const right: number[] = []
  const cereb: number[] = []
  for (let i = 0; i < n; i++) {
    const l = lobe[i]
    const x = positions[i * 3]
    if (l >= 1 && l <= 4) {
      cortical.push(i)
      if (x < -0.15) left.push(i)
      else if (x > 0.15) right.push(i)
    } else if (l === 5) cereb.push(i)
  }
  const pairs = new Uint32Array(edges * 2)
  const pick = (arr: number[]): number => arr[(rand() * arr.length) | 0] ?? 0
  for (let e = 0; e < edges; e++) {
    const r = rand()
    let a = 0
    let b = 0
    if (r < 0.68 && cortical.length > 1) {
      a = pick(cortical)
      let best = -1
      let bd = Infinity
      for (let t = 0; t < 48; t++) {
        const j = pick(cortical)
        if (j === a) continue
        const d = dist2(positions, a, positions, j)
        if (d < 0.12 && d < bd) {
          bd = d
          best = j
        }
      }
      b = best >= 0 ? best : pick(cortical)
    } else if (r < 0.85 && left.length > 0 && right.length > 0) {
      a = pick(left)
      let best = right[0]
      let bd = Infinity
      for (let t = 0; t < 40; t++) {
        const j = pick(right)
        const d = dist2(positions, a, positions, j)
        if (d < bd) {
          bd = d
          best = j
        }
      }
      b = best
    } else if (cereb.length > 1) {
      a = pick(cereb)
      let best = -1
      let bd = Infinity
      for (let t = 0; t < 32; t++) {
        const j = pick(cereb)
        if (j === a) continue
        const d = dist2(positions, a, positions, j)
        if (d < bd) {
          bd = d
          best = j
        }
      }
      b = best >= 0 ? best : pick(cereb)
    } else {
      a = (rand() * n) | 0
      b = (rand() * n) | 0
    }
    if (a === b) b = (b + 1) % n
    pairs[e * 2] = a
    pairs[e * 2 + 1] = b
  }
  return pairs
}
