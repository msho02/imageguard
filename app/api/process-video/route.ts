import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import type { Config } from '@/lib/config'
import {
  applyHighFreqNoise, applyChromaticJitter, applyPrivacySignature,
  applyFGSMStyle, applyYCbCrShift, generateAdversarialPatch, applySpectralFilter,
} from '@/lib/imageProcessing'

// Progress store (in-memory, per job)
export const progressMap = new Map<string, { frame: number; total: number; done: boolean; error?: string }>()

async function processFrame(framePath: string, config: Config): Promise<void> {
  const t = config.techniques || {}
  const inputBuffer = await fs.readFile(framePath)
  let pipeline = sharp(inputBuffer)

  if (config.stripMetadata !== false) pipeline = pipeline.withMetadata({})

  const meta = await sharp(inputBuffer).metadata()
  const width = meta.width || 800
  const height = meta.height || 600

  const needsRaw = t.highFreqNoise?.enabled || t.chromaticJitter?.enabled ||
    t.privacySignature?.enabled || t.fgsmStyle?.enabled ||
    t.ycbcrShift?.enabled || t.spectralFilter?.enabled

  let rawBuf: Buffer | null = null

  if (needsRaw) {
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
    rawBuf = data

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

    pipeline = sharp(rawBuf, { raw: { width: info.width, height: info.height, channels: info.channels as 1 | 2 | 3 | 4 } })
  }

  if (t.dualResampling?.enabled) {
    const factor = Math.max(0.93, Math.min(0.99, t.dualResampling.factor ?? 0.97))
    pipeline = pipeline
      .resize(Math.round(width * factor), Math.round(height * factor), { kernel: sharp.kernel.lanczos3 })
      .resize(width, height, { kernel: sharp.kernel.nearest })
  }

  if (t.geometricWarp?.enabled) {
    const angle = ((t.geometricWarp.intensity ?? 20) / 100) * 1.5
    const sign = Math.random() > 0.5 ? 1 : -1
    pipeline = pipeline
      .rotate(sign * (0.1 + angle), { background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .resize(width, height, { fit: 'cover', position: 'centre' })
  }

  if (t.attentionAnchor?.enabled) {
    const patchSizePx = Math.round(32 + (t.attentionAnchor.size ?? 50) / 100 * 96)
    const patchRaw = generateAdversarialPatch(patchSizePx, 'imageguard-anchor', 0.3)
    const patchBuf = await sharp(patchRaw, { raw: { width: patchSizePx, height: patchSizePx, channels: 3 } }).png().toBuffer()
    const positions = ['topleft', 'topright', 'bottomleft', 'bottomright'] as const
    const pos = t.attentionAnchor.position === 'random'
      ? positions[Math.floor(Math.random() * 4)]
      : (t.attentionAnchor.position?.replace('-', '') as typeof positions[number])
    pipeline = pipeline.composite([{ input: patchBuf, gravity: pos, blend: 'over' }])
  }

  pipeline = pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
  const out = await pipeline.toBuffer()
  await fs.writeFile(framePath, out)
}

export async function POST(req: NextRequest) {
  const jobId = randomUUID()
  progressMap.set(jobId, { frame: 0, total: 0, done: false })

  let tmpDir: string | null = null

  try {
    const formData = await req.formData()
    const file = formData.get('video') as File | null
    const configStr = formData.get('config') as string | null

    if (!file) return NextResponse.json({ error: 'No video provided' }, { status: 400 })

    const config: Config = configStr ? JSON.parse(configStr) : {}
    const videoConfig = config.video || {}

    const arrayBuffer = await file.arrayBuffer()
    const inputBuf = Buffer.from(arrayBuffer)

    tmpDir = path.join(os.tmpdir(), `imageguard-${jobId}`)
    await fs.mkdir(tmpDir, { recursive: true })

    const inputPath = path.join(tmpDir, 'input' + path.extname(file.name || '.mp4'))
    const framesDir = path.join(tmpDir, 'frames')
    const processedDir = path.join(tmpDir, 'processed')
    const outputSilent = path.join(tmpDir, 'output_silent.mp4')
    const outputFinal = path.join(tmpDir, 'output_final.mp4')

    await fs.writeFile(inputPath, inputBuf)
    await fs.mkdir(framesDir, { recursive: true })
    await fs.mkdir(processedDir, { recursive: true })

    // Dynamic import of fluent-ffmpeg (server-only)
    const ffmpegModule = await import('fluent-ffmpeg')
    const ffmpeg = ffmpegModule.default
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg')
    ffmpeg.setFfmpegPath(ffmpegInstaller.path)

    // Get video FPS
    const fpsInfo = await new Promise<number>((resolve) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        const stream = data?.streams?.find(s => s.codec_type === 'video')
        const fpsStr = stream?.r_frame_rate || '25/1'
        const [num, den] = fpsStr.split('/').map(Number)
        resolve(num / (den || 1))
      })
    })
    const fps = Math.round(fpsInfo) || 25

    // Extract frames
    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(inputPath).outputOptions(['-q:v 2'])
      if (videoConfig.frameProcessing === 'keyframes') {
        cmd = cmd.outputOptions(['-vf', 'select=eq(pict_type\\,I)', '-vsync', 'vfr'])
      }
      cmd.output(path.join(framesDir, 'frame_%06d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    const frameFiles = (await fs.readdir(framesDir))
      .filter(f => f.endsWith('.jpg'))
      .sort()

    const total = frameFiles.length
    progressMap.set(jobId, { frame: 0, total, done: false })

    // Process each frame
    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = path.join(framesDir, frameFiles[i])
      await processFrame(framePath, config)
      await fs.copyFile(framePath, path.join(processedDir, frameFiles[i]))
      progressMap.set(jobId, { frame: i + 1, total, done: false })
    }

    // Reassemble video
    const codec = videoConfig.codec === 'h265' ? 'libx265' : 'libx264'
    const bitrate = `${Math.max(4, Math.min(20, videoConfig.outputBitrate ?? 8))}M`

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(processedDir, 'frame_%06d.jpg'))
        .inputOptions([`-framerate ${fps}`])
        .outputOptions([`-c:v ${codec}`, `-b:v ${bitrate}`, '-pix_fmt yuv420p'])
        .output(outputSilent)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    // Add audio back if requested
    const hasFinalOutput = existsSync(outputSilent)
    if (videoConfig.preserveAudio !== false && hasFinalOutput) {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(outputSilent)
          .input(inputPath)
          .outputOptions(['-c copy', '-map 0:v:0', '-map 1:a?', '-shortest'])
          .output(outputFinal)
          .on('end', resolve)
          .on('error', () => {
            // If no audio stream, just copy the silent output
            fs.copyFile(outputSilent, outputFinal).then(resolve).catch(reject)
          })
          .run()
      })
    } else {
      await fs.copyFile(outputSilent, outputFinal)
    }

    const outputBuf = await fs.readFile(outputFinal)
    progressMap.set(jobId, { frame: total, total, done: true })

    const originalName = file.name.replace(/\.[^.]+$/, '')

    return new NextResponse(new Uint8Array(outputBuf), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${originalName}-protected.mp4"`,
        'X-Job-Id': jobId,
        'X-Total-Frames': String(total),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Video processing failed'
    progressMap.set(jobId, { frame: 0, total: 0, done: true, error: msg })
    console.error('Video processing error:', err)
    return NextResponse.json({ error: msg, jobId }, { status: 500 })
  } finally {
    if (tmpDir) {
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
