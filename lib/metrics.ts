export interface ImageMetrics {
  ssim: number
  protection: number
  originalSize: number
  processedSize: number
  width: number
  height: number
}

export function computeMetrics(
  original: Uint8Array,
  processed: Uint8Array,
  width: number,
  height: number,
  channels: number,
  originalFileSize: number,
  processedFileSize: number
): ImageMetrics {
  const totalPixels = width * height
  const sampleCount = Math.min(1000, totalPixels)
  const stride = Math.floor(totalPixels / sampleCount)

  let ssimSum = 0
  let diffSum = 0

  for (let i = 0; i < sampleCount; i++) {
    const pixelIdx = i * stride
    const byteIdx = pixelIdx * channels

    if (byteIdx + 2 >= original.length || byteIdx + 2 >= processed.length) break

    const or = original[byteIdx]
    const og = original[byteIdx + 1]
    const ob = original[byteIdx + 2]
    const pr = processed[byteIdx]
    const pg = processed[byteIdx + 1]
    const pb = processed[byteIdx + 2]

    const diff = (Math.abs(or - pr) + Math.abs(og - pg) + Math.abs(ob - pb)) / 3
    const similarity = 1 - diff / 255
    ssimSum += similarity
    diffSum += diff
  }

  const ssim = Math.min(100, Math.round((ssimSum / sampleCount) * 100))

  // Protection score based on 8×8 block variance differences
  const blockSize = 8
  let blockDiffSum = 0
  let blockCount = 0

  for (let by = 0; by + blockSize < height; by += blockSize) {
    for (let bx = 0; bx + blockSize < width; bx += blockSize) {
      let origVar = 0
      let procVar = 0
      let origMean = 0
      let procMean = 0

      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * channels
          if (idx + 2 >= original.length) continue
          origMean += (original[idx] + original[idx + 1] + original[idx + 2]) / 3
          procMean += (processed[idx] + processed[idx + 1] + processed[idx + 2]) / 3
        }
      }

      origMean /= blockSize * blockSize
      procMean /= blockSize * blockSize

      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * channels
          if (idx + 2 >= original.length) continue
          const ov = (original[idx] + original[idx + 1] + original[idx + 2]) / 3
          const pv = (processed[idx] + processed[idx + 1] + processed[idx + 2]) / 3
          origVar += (ov - origMean) ** 2
          procVar += (pv - procMean) ** 2
        }
      }

      blockDiffSum += Math.abs(origVar - procVar) / (blockSize * blockSize)
      blockCount++

      if (blockCount >= 200) break
    }
    if (blockCount >= 200) break
  }

  const avgBlockDiff = blockCount > 0 ? blockDiffSum / blockCount : 0
  const protection = Math.min(100, Math.round((avgBlockDiff / 50) * 100 + (diffSum / sampleCount) / 255 * 100))

  return {
    ssim,
    protection: Math.max(0, Math.min(100, protection)),
    originalSize: originalFileSize,
    processedSize: processedFileSize,
    width,
    height,
  }
}
