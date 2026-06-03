import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { Config } from '@/lib/config'
import {
  applyHighFreqNoise,
  applyChromaticJitter,
  applyPrivacySignature,
  applyFGSMStyle,
  applyYCbCrShift,
  generateAdversarialPatch,
  applySpectralFilter,
} from '@/lib/imageProcessing'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const configStr = formData.get('config') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const config: Config = configStr ? JSON.parse(configStr) : {}
    const t = config.techniques || {}

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    let pipeline = sharp(inputBuffer)

    if (config.stripMetadata !== false) {
      pipeline = pipeline.withMetadata({})
    }

    const meta = await sharp(inputBuffer).metadata()
    const width = meta.width || 800
    const height = meta.height || 600

    // Determine if we need raw pixel access
    const needsRaw =
      t.highFreqNoise?.enabled ||
      t.chromaticJitter?.enabled ||
      t.privacySignature?.enabled ||
      t.fgsmStyle?.enabled ||
      t.ycbcrShift?.enabled ||
      t.spectralFilter?.enabled

    let rawBuf: Buffer | null = null
    let rawInfo: { width: number; height: number; channels: number } | null = null

    if (needsRaw) {
      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
      rawBuf = data
      rawInfo = info

      if (t.highFreqNoise?.enabled)
        rawBuf = applyHighFreqNoise(rawBuf, info.width, info.height, info.channels, t.highFreqNoise.intensity ?? 30)

      if (t.chromaticJitter?.enabled)
        rawBuf = applyChromaticJitter(rawBuf, info.channels, t.chromaticJitter.intensity ?? 25)

      if (t.fgsmStyle?.enabled)
        rawBuf = applyFGSMStyle(rawBuf, info.width, info.height, info.channels, t.fgsmStyle.epsilon ?? 40)

      if (t.ycbcrShift?.enabled)
        rawBuf = applyYCbCrShift(rawBuf, info.channels, t.ycbcrShift.intensity ?? 40)

      if (t.spectralFilter?.enabled)
        rawBuf = applySpectralFilter(rawBuf, info.width, info.height, info.channels, t.spectralFilter.intensity ?? 50, t.spectralFilter.band ?? 'mid')

      if (t.privacySignature?.enabled)
        rawBuf = applyPrivacySignature(rawBuf, info.channels, t.privacySignature.seed || '', Math.min(3, Math.max(1, t.privacySignature.bits ?? 1)))

      pipeline = sharp(rawBuf, {
        raw: { width: info.width, height: info.height, channels: info.channels as 1 | 2 | 3 | 4 },
      })
    }

    // Dual resampling
    if (t.dualResampling?.enabled) {
      const factor = Math.max(0.93, Math.min(0.99, t.dualResampling.factor ?? 0.97))
      pipeline = pipeline
        .resize(Math.round(width * factor), Math.round(height * factor), { kernel: sharp.kernel.lanczos3 })
        .resize(width, height, { kernel: sharp.kernel.nearest })
    }

    // Geometric warp
    if (t.geometricWarp?.enabled) {
      const angle = ((t.geometricWarp.intensity ?? 20) / 100) * 1.5
      const sign = Math.random() > 0.5 ? 1 : -1
      pipeline = pipeline
        .rotate(sign * (0.1 + angle), { background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .resize(width, height, { fit: 'cover', position: 'centre' })
    }

    // Attention anchor patch (composite)
    if (t.attentionAnchor?.enabled) {
      const patchSizePx = Math.round(32 + (t.attentionAnchor.size ?? 50) / 100 * 96)
      const patchRaw = generateAdversarialPatch(patchSizePx, 'imageguard-anchor', 0.3)
      const patchBuf = await sharp(patchRaw, { raw: { width: patchSizePx, height: patchSizePx, channels: 3 } })
        .png()
        .toBuffer()

      const pos = t.attentionAnchor.position ?? 'random'
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
      const resolvedPos = pos === 'random' ? positions[Math.floor(Math.random() * 4)] : pos
      const gravity = resolvedPos.replace('-', '') as 'topleft' | 'topright' | 'bottomleft' | 'bottomright'

      const opacity = Math.max(3, Math.min(12, t.attentionAnchor.opacity ?? 6)) / 100

      pipeline = pipeline.composite([{
        input: patchBuf,
        gravity,
        blend: 'over',
        // @ts-ignore — sharp accepts opacity in composite
        opacity,
      }])
    }

    // Final re-encode
    const outputFormat = config.outputFormat || 'jpeg'
    if (outputFormat === 'jpeg') {
      const quality = t.reencoding?.enabled ? Math.max(85, Math.min(99, t.reencoding.quality ?? 92)) : 92
      pipeline = pipeline.jpeg({ quality, chromaSubsampling: '4:4:4' })
    } else if (outputFormat === 'png') {
      pipeline = pipeline.png({ compressionLevel: 6 })
    } else {
      const quality = t.reencoding?.enabled ? Math.max(85, Math.min(99, t.reencoding.quality ?? 92)) : 92
      pipeline = pipeline.webp({ quality })
    }

    const outputBuffer = await pipeline.toBuffer()

    // Metrics
    const origRaw = rawBuf && rawInfo
      ? { data: rawBuf, info: rawInfo }
      : await sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true })
    const procRaw = await sharp(outputBuffer).raw().toBuffer({ resolveWithObject: true })

    const totalPixels = origRaw.info.width * origRaw.info.height
    const sampleCount = Math.min(1000, totalPixels)
    const stride = Math.floor(totalPixels / sampleCount)
    const ch = origRaw.info.channels
    let ssimSum = 0, diffSum = 0

    for (let i = 0; i < sampleCount; i++) {
      const pi = i * stride * ch
      if (pi + 2 >= origRaw.data.length || pi + 2 >= procRaw.data.length) break
      const diff = (Math.abs(origRaw.data[pi] - procRaw.data[pi]) + Math.abs(origRaw.data[pi + 1] - procRaw.data[pi + 1]) + Math.abs(origRaw.data[pi + 2] - procRaw.data[pi + 2])) / 3
      ssimSum += 1 - diff / 255
      diffSum += diff
    }

    const ssim = Math.min(100, Math.round((ssimSum / sampleCount) * 100))
    const protection = Math.min(100, Math.max(0, Math.round(diffSum / sampleCount / 255 * 100 * 8 + 35)))
    const originalName = file.name.replace(/\.[^.]+$/, '')

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'png' ? 'image/png' : 'image/webp',
        'Content-Disposition': `attachment; filename="${originalName}-protected.${outputFormat}"`,
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
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Processing failed' }, { status: 500 })
  }
}
