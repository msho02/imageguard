import { seededRandom, hashSeed } from './prng'

function gaussianNoise(rand: () => number): number {
  const u1 = Math.max(1e-10, rand())
  const u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export function applyHighFreqNoise(
  data: Buffer, width: number, height: number, channels: number, intensity: number
): Buffer {
  const arr = new Uint8Array(data)
  const amplitude = (intensity / 100) * 12
  const seeds = [42, 137, 251]
  for (let c = 0; c < Math.min(channels, 3); c++) {
    const rand = seededRandom(seeds[c])
    for (let i = c; i < arr.length; i += channels) {
      const noise = gaussianNoise(rand) * amplitude
      arr[i] = Math.max(0, Math.min(255, Math.round(arr[i] + noise)))
    }
  }
  return Buffer.from(arr)
}

export function applyChromaticJitter(
  data: Buffer, channels: number, intensity: number
): Buffer {
  const arr = new Uint8Array(data)
  const amp = Math.round((intensity / 100) * 8)
  const offsets = [
    Math.round((Math.random() - 0.5) * 2 * amp),
    Math.round((Math.random() - 0.5) * 2 * amp),
    Math.round((Math.random() - 0.5) * 2 * amp),
  ]
  for (let i = 0; i < arr.length; i += channels) {
    for (let c = 0; c < Math.min(channels, 3); c++) {
      arr[i + c] = Math.max(0, Math.min(255, arr[i + c] + offsets[c]))
    }
  }
  return Buffer.from(arr)
}

export function applyPrivacySignature(
  data: Buffer, channels: number, seed: string, bits: number
): Buffer {
  const arr = new Uint8Array(data)
  const numericSeed = hashSeed(seed || 'imageguard-default')
  const rand = seededRandom(numericSeed)
  const mask = (1 << bits) - 1
  for (let i = 0; i < arr.length; i += channels) {
    for (let c = 0; c < Math.min(channels, 3); c++) {
      const sigBit = Math.round(rand()) & mask
      arr[i + c] = (arr[i + c] & ~mask) | sigBit
    }
  }
  return Buffer.from(arr)
}

// Técnica A: FGSM-style perturbation
export function applyFGSMStyle(
  data: Buffer, width: number, height: number, channels: number, epsilonPct: number
): Buffer {
  const epsilon = 0.01 + (epsilonPct / 100) * 0.07
  const output = Buffer.from(data)
  const blockSize = 8

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      for (let c = 0; c < Math.min(channels, 3); c++) {
        let gradSum = 0
        let count = 0
        for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
            const idx = ((by + dy) * width + (bx + dx)) * channels + c
            const right = bx + dx + 1 < width ? data[idx + channels] : data[idx]
            const down = by + dy + 1 < height ? data[idx + width * channels] : data[idx]
            gradSum += Math.abs(right - data[idx]) + Math.abs(down - data[idx])
            count++
          }
        }
        const localGrad = count > 0 ? gradSum / count : 0
        const perturbation = Math.sign(localGrad - 128) * epsilon * 255

        for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
            const idx = ((by + dy) * width + (bx + dx)) * channels + c
            const sign = Math.random() > 0.5 ? 1 : -1
            output[idx] = Math.max(0, Math.min(255, Math.round(data[idx] + perturbation * sign)))
          }
        }
      }
    }
  }
  return output
}

// Técnica B: YCbCr shift
function rgbToYCbCr(r: number, g: number, b: number) {
  return {
    Y:  0.299 * r + 0.587 * g + 0.114 * b,
    Cb: -0.169 * r - 0.331 * g + 0.500 * b + 128,
    Cr:  0.500 * r - 0.419 * g - 0.081 * b + 128,
  }
}

function yCbCrToRgb(Y: number, Cb: number, Cr: number) {
  return {
    r: Math.max(0, Math.min(255, Math.round(Y + 1.402 * (Cr - 128)))),
    g: Math.max(0, Math.min(255, Math.round(Y - 0.344 * (Cb - 128) - 0.714 * (Cr - 128)))),
    b: Math.max(0, Math.min(255, Math.round(Y + 1.772 * (Cb - 128)))),
  }
}

export function applyYCbCrShift(
  data: Buffer, channels: number, intensity: number
): Buffer {
  const output = Buffer.from(data)
  const maxShift = (intensity / 100) * 15
  const cbShift = maxShift * (Math.random() > 0.5 ? 1 : -1)
  const crShift = -cbShift * 0.7
  const compensateY = 0.15

  for (let i = 0; i < data.length; i += channels) {
    const { Y, Cb, Cr } = rgbToYCbCr(data[i], data[i + 1], data[i + 2])
    const newCb = Math.max(0, Math.min(255, Cb + cbShift))
    const newCr = Math.max(0, Math.min(255, Cr + crShift))
    const newY  = Y + compensateY * (Math.abs(cbShift) + Math.abs(crShift)) * 0.1
    const { r, g, b } = yCbCrToRgb(newY, newCb, newCr)
    output[i] = r; output[i + 1] = g; output[i + 2] = b
  }
  return output
}

// Técnica C: Adversarial patch — returns the patch buffer as raw RGB
export function generateAdversarialPatch(size: number, seedStr: string, frequency: number): Buffer {
  const seed = hashSeed(seedStr || 'imageguard-patch')
  const rng = seededRandom(seed)
  const patch = Buffer.alloc(size * size * 3)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const idx = (i * size + j) * 3
      const wave = Math.sin(i * frequency) * Math.cos(j * frequency)
      const noise = rng() * 2 - 1
      const val = Math.round(((wave + noise) / 2 + 0.5) * 255)
      patch[idx]     = val
      patch[idx + 1] = Math.round(rng() * 255)
      patch[idx + 2] = Math.round(rng() * 255)
    }
  }
  return patch
}

// Técnica D: FFT spectral filter — manual 1D Cooley-Tukey FFT applied per row/col
function fft1d(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length
  if (n <= 1) return

  // Bit-reversal permutation
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]]
    }
  }

  // Cooley-Tukey FFT
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inverse ? 1 : -1)
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k]
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = uRe + vRe; im[i + k] = uIm + vIm
        re[i + k + len / 2] = uRe - vRe; im[i + k + len / 2] = uIm - vIm
        const newRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = newRe
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n; im[i] /= n
    }
  }
}

// Next power of 2 >= n
function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

export function applySpectralFilter(
  data: Buffer, width: number, height: number, channels: number,
  intensity: number, band: 'low' | 'mid' | 'high'
): Buffer {
  const output = Buffer.from(data)
  const attenuation = (intensity / 100) * 0.4

  const bandRanges: Record<string, [number, number]> = {
    low:  [0.0, 0.15],
    mid:  [0.15, 0.35],
    high: [0.35, 0.5],
  }
  const [bandStart, bandEnd] = bandRanges[band]

  const pw = nextPow2(width)
  const ph = nextPow2(height)

  for (let c = 0; c < Math.min(channels, 3); c++) {
    // Build 2D arrays (padded to pow2)
    const re = new Float64Array(ph * pw)
    const im = new Float64Array(ph * pw)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        re[y * pw + x] = data[(y * width + x) * channels + c] / 255.0
      }
    }

    // Row FFTs
    for (let y = 0; y < ph; y++) {
      const rowRe = re.subarray(y * pw, y * pw + pw)
      const rowIm = im.subarray(y * pw, y * pw + pw)
      fft1d(rowRe, rowIm, false)
    }

    // Column FFTs
    const colRe = new Float64Array(ph)
    const colIm = new Float64Array(ph)
    for (let x = 0; x < pw; x++) {
      for (let y = 0; y < ph; y++) { colRe[y] = re[y * pw + x]; colIm[y] = im[y * pw + x] }
      fft1d(colRe, colIm, false)
      for (let y = 0; y < ph; y++) { re[y * pw + x] = colRe[y]; im[y * pw + x] = colIm[y] }
    }

    // Attenuate target band
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const freqY = y / ph
        const freqX = x / pw
        const freq = Math.sqrt(freqX * freqX + freqY * freqY)
        if (freq >= bandStart && freq <= bandEnd) {
          const a = 1.0 - attenuation
          re[y * pw + x] *= a
          im[y * pw + x] *= a
        }
      }
    }

    // Inverse column FFTs
    for (let x = 0; x < pw; x++) {
      for (let y = 0; y < ph; y++) { colRe[y] = re[y * pw + x]; colIm[y] = im[y * pw + x] }
      fft1d(colRe, colIm, true)
      for (let y = 0; y < ph; y++) { re[y * pw + x] = colRe[y]; im[y * pw + x] = colIm[y] }
    }

    // Inverse row FFTs
    for (let y = 0; y < ph; y++) {
      const rowRe = re.subarray(y * pw, y * pw + pw)
      const rowIm = im.subarray(y * pw, y * pw + pw)
      fft1d(rowRe, rowIm, true)
    }

    // Write back
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        output[(y * width + x) * channels + c] = Math.max(0, Math.min(255, Math.round(re[y * pw + x] * 255)))
      }
    }
  }

  return output
}
