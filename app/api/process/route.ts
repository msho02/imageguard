import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { seededRandom, hashSeed } from '@/lib/prng'
import type { Config } from '@/lib/config'

function gaussianNoise(rand: () => number): number {
  // Box-Muller transform
  const u1 = Math.max(1e-10, rand())
  const u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

async function applyHighFreqNoise(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  intensity: number
): Promise<Buffer> {
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

async function applyChromaticJitter(
  data: Buffer,
  channels: number,
  intensity: number
): Promise<Buffer> {
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

async function applyPrivacySignature(
  data: Buffer,
  channels: number,
  seed: string,
  bits: number
): Promise<Buffer> {
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const configStr = formData.get('config') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const config: Config = configStr ? JSON.parse(configStr) : {}
    const techniques = config.techniques || {}

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    let pipeline = sharp(inputBuffer)

    // 1. Strip metadata
    if (config.stripMetadata !== false) {
      pipeline = pipeline.withMetadata({})
    }

    // Get metadata for sizing
    const meta = await sharp(inputBuffer).metadata()
    const width = meta.width || 800
    const height = meta.height || 600

    // 2. High frequency noise — needs raw pixel access
    let rawBuf: Buffer | null = null
    let rawInfo: { width: number; height: number; channels: number } | null = null

    const needsRaw =
      (techniques.highFreqNoise?.enabled) ||
      (techniques.chromaticJitter?.enabled) ||
      (techniques.privacySignature?.enabled)

    if (needsRaw) {
      const { data, info } = await pipeline
        .raw()
        .toBuffer({ resolveWithObject: true })
      rawBuf = data
      rawInfo = info

      if (techniques.highFreqNoise?.enabled) {
        rawBuf = await applyHighFreqNoise(
          rawBuf,
          info.width,
          info.height,
          info.channels,
          techniques.highFreqNoise.intensity ?? 30
        )
      }

      // 4. Chromatic jitter
      if (techniques.chromaticJitter?.enabled) {
        rawBuf = await applyChromaticJitter(
          rawBuf,
          info.channels,
          techniques.chromaticJitter.intensity ?? 25
        )
      }

      // 6. Privacy signature
      if (techniques.privacySignature?.enabled) {
        rawBuf = await applyPrivacySignature(
          rawBuf,
          info.channels,
          techniques.privacySignature.seed || '',
          Math.min(3, Math.max(1, techniques.privacySignature.bits ?? 1))
        )
      }

      pipeline = sharp(rawBuf, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels as 1 | 2 | 3 | 4,
        },
      })
    }

    // 5. Dual resampling
    if (techniques.dualResampling?.enabled) {
      const factor = techniques.dualResampling.factor ?? 0.97
      const clampedFactor = Math.max(0.93, Math.min(0.99, factor))
      const smallW = Math.round(width * clampedFactor)
      const smallH = Math.round(height * clampedFactor)

      pipeline = pipeline
        .resize(smallW, smallH, { kernel: sharp.kernel.lanczos3 })
        .resize(width, height, { kernel: sharp.kernel.nearest })
    }

    // 3. Geometric warp (micro-rotation)
    if (techniques.geometricWarp?.enabled) {
      const maxAngle = 1.5
      const angle = ((techniques.geometricWarp.intensity ?? 20) / 100) * maxAngle
      const sign = Math.random() > 0.5 ? 1 : -1
      const rotAngle = sign * (0.1 + angle)

      pipeline = pipeline
        .rotate(rotAngle, { background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .resize(width, height, { fit: 'cover', position: 'centre' })
    }

    // 7. Re-encode final
    const outputFormat = config.outputFormat || 'jpeg'

    if (outputFormat === 'jpeg') {
      const quality = techniques.reencoding?.enabled
        ? Math.max(85, Math.min(99, techniques.reencoding.quality ?? 92))
        : 92
      pipeline = pipeline.jpeg({ quality, chromaSubsampling: '4:4:4' })
    } else if (outputFormat === 'png') {
      pipeline = pipeline.png({ compressionLevel: 6 })
    } else if (outputFormat === 'webp') {
      const quality = techniques.reencoding?.enabled
        ? Math.max(85, Math.min(99, techniques.reencoding.quality ?? 92))
        : 92
      pipeline = pipeline.webp({ quality })
    }

    const outputBuffer = await pipeline.toBuffer()

    // Compute raw pixels for metrics
    const origRaw = rawBuf && rawInfo
      ? { data: rawBuf, info: rawInfo }
      : await sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true })

    const procRaw = await sharp(outputBuffer).raw().toBuffer({ resolveWithObject: true })

    // Simple SSIM approximation
    const totalPixels = origRaw.info.width * origRaw.info.height
    const sampleCount = Math.min(1000, totalPixels)
    const stride = Math.floor(totalPixels / sampleCount)
    const ch = origRaw.info.channels

    let ssimSum = 0
    let diffSum = 0
    for (let i = 0; i < sampleCount; i++) {
      const pi = i * stride * ch
      if (pi + 2 >= origRaw.data.length || pi + 2 >= procRaw.data.length) break
      const diff = (
        Math.abs(origRaw.data[pi] - procRaw.data[pi]) +
        Math.abs(origRaw.data[pi + 1] - procRaw.data[pi + 1]) +
        Math.abs(origRaw.data[pi + 2] - procRaw.data[pi + 2])
      ) / 3
      ssimSum += 1 - diff / 255
      diffSum += diff
    }
    const ssim = Math.min(100, Math.round((ssimSum / sampleCount) * 100))
    const avgDiff = diffSum / sampleCount
    const protection = Math.min(100, Math.max(0, Math.round(avgDiff / 255 * 100 * 8 + 35)))

    const mimeTypes: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }

    const ext = outputFormat
    const originalName = file.name.replace(/\.[^.]+$/, '')

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': mimeTypes[outputFormat] || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${originalName}-protected.${ext}"`,
        'X-SSIM': String(ssim),
        'X-Protection': String(protection),
        'X-Original-Size': String(inputBuffer.length),
        'X-Processed-Size': String(outputBuffer.length),
        'X-Width': String(width),
        'X-Height': String(height),
      },
    })
  } catch (err) {
    console.error('Processing error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
