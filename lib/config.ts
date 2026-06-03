export interface TechniqueConfig {
  highFreqNoise: { enabled: boolean; intensity: number }
  geometricWarp: { enabled: boolean; intensity: number }
  dualResampling: { enabled: boolean; factor: number }
  chromaticJitter: { enabled: boolean; intensity: number }
  privacySignature: { enabled: boolean; seed: string; bits: number }
  reencoding: { enabled: boolean; quality: number }
}

export interface Config {
  techniques: TechniqueConfig
  outputFormat: 'jpeg' | 'png' | 'webp'
  stripMetadata: boolean
}

export const defaultConfig: Config = {
  techniques: {
    highFreqNoise: { enabled: true, intensity: 30 },
    geometricWarp: { enabled: true, intensity: 20 },
    dualResampling: { enabled: true, factor: 0.97 },
    chromaticJitter: { enabled: true, intensity: 25 },
    privacySignature: { enabled: false, seed: '', bits: 1 },
    reencoding: { enabled: true, quality: 92 },
  },
  outputFormat: 'jpeg',
  stripMetadata: true,
}

const STORAGE_KEY = 'imageguard-config'

export function loadConfig(): Config {
  if (typeof window === 'undefined') return defaultConfig
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultConfig
    return { ...defaultConfig, ...JSON.parse(stored) }
  } catch {
    return defaultConfig
  }
}

export function saveConfig(config: Config): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
