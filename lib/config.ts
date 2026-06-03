export interface TechniqueConfig {
  // Base techniques
  highFreqNoise:    { enabled: boolean; intensity: number }
  geometricWarp:    { enabled: boolean; intensity: number }
  dualResampling:   { enabled: boolean; factor: number }
  chromaticJitter:  { enabled: boolean; intensity: number }
  privacySignature: { enabled: boolean; seed: string; bits: number }
  reencoding:       { enabled: boolean; quality: number }
  // Advanced techniques
  fgsmStyle:        { enabled: boolean; epsilon: number }
  ycbcrShift:       { enabled: boolean; intensity: number }
  attentionAnchor:  { enabled: boolean; size: number; position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'random'; opacity: number }
  spectralFilter:   { enabled: boolean; intensity: number; band: 'low' | 'mid' | 'high' }
}

export interface VideoConfig {
  frameProcessing: 'all' | 'keyframes'
  outputBitrate: number
  preserveAudio: boolean
  codec: 'h264' | 'h265'
}

export interface Config {
  techniques: TechniqueConfig
  outputFormat: 'jpeg' | 'png' | 'webp'
  stripMetadata: boolean
  video: VideoConfig
}

export const defaultConfig: Config = {
  techniques: {
    highFreqNoise:    { enabled: true,  intensity: 30 },
    geometricWarp:    { enabled: true,  intensity: 20 },
    dualResampling:   { enabled: true,  factor: 0.97 },
    chromaticJitter:  { enabled: true,  intensity: 25 },
    privacySignature: { enabled: false, seed: '', bits: 1 },
    reencoding:       { enabled: true,  quality: 92 },
    fgsmStyle:        { enabled: false, epsilon: 40 },
    ycbcrShift:       { enabled: false, intensity: 40 },
    attentionAnchor:  { enabled: false, size: 50, position: 'random', opacity: 6 },
    spectralFilter:   { enabled: false, intensity: 50, band: 'mid' },
  },
  outputFormat: 'jpeg',
  stripMetadata: true,
  video: {
    frameProcessing: 'all',
    outputBitrate: 8,
    preserveAudio: true,
    codec: 'h264',
  },
}

const STORAGE_KEY = 'imageguard-config-v2'

export function loadConfig(): Config {
  if (typeof window === 'undefined') return defaultConfig
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultConfig
    const parsed = JSON.parse(stored)
    return {
      ...defaultConfig,
      ...parsed,
      techniques: { ...defaultConfig.techniques, ...parsed.techniques },
      video: { ...defaultConfig.video, ...parsed.video },
    }
  } catch {
    return defaultConfig
  }
}

export function saveConfig(config: Config): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
