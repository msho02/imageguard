"use client"

import React from 'react'
import { Waves, Maximize2, RefreshCw, Palette, Fingerprint, FileImage, Info, Zap, Sliders, Crosshair, Activity } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { Config } from '@/lib/config'

interface TechniquePanelProps {
  config: Config
  onChange: (config: Config) => void
  disabled?: boolean
}

const baseTechniques = [
  { key: 'highFreqNoise' as const, label: 'Ruído de alta frequência', icon: Waves, description: 'Perturbação gaussiana por canal de cor. Altera vetores de embedding de CNNs.', param: { type: 'intensity', label: 'Intensidade', min: 0, max: 100 } },
  { key: 'geometricWarp' as const, label: 'Micro-distorção geométrica', icon: Maximize2, description: 'Rotação sub-pixel (0.1°–1.5°) com crop central. Altera descritores espaciais.', param: { type: 'intensity', label: 'Intensidade', min: 0, max: 100 } },
  { key: 'dualResampling' as const, label: 'Recodificação interpolada', icon: RefreshCw, description: 'Redimensiona com Lanczos3 e restaura com nearest-neighbor.', param: { type: 'factor', label: 'Fator', min: 93, max: 99 } },
  { key: 'chromaticJitter' as const, label: 'Modulação cromática', icon: Palette, description: 'Offsets HSL independentes por canal. Altera histogramas de fingerprinting.', param: { type: 'intensity', label: 'Intensidade', min: 0, max: 100 } },
  { key: 'privacySignature' as const, label: 'Assinatura de privacidade', icon: Fingerprint, description: 'Marca d\'água nos bits menos significativos. Identificável com seed correta.', param: { type: 'signature' } },
  { key: 'reencoding' as const, label: 'Re-encode com perfil explícito', icon: FileImage, description: 'JPEG com chroma 4:4:4 e qualidade controlada. Remove fingerprints do encoder.', param: { type: 'quality', label: 'Qualidade', min: 85, max: 99 } },
] as const

const advancedTechniques = [
  { key: 'fgsmStyle' as const, label: 'Perturbação adaptativa', icon: Zap, description: 'Injeta ruído calculado nos pontos de maior variação local (FGSM-style).', param: { type: 'epsilon', label: 'Epsilon', min: 0, max: 100 } },
  { key: 'ycbcrShift' as const, label: 'Modulação de crominância', icon: Sliders, description: 'Desloca canais Cb/Cr no espaço YCbCr preservando luminosidade percebida.', param: { type: 'intensity', label: 'Intensidade', min: 0, max: 100 } },
  { key: 'attentionAnchor' as const, label: 'Âncora de atenção', icon: Crosshair, description: 'Insere padrão de alta variância que concentra análise automatizada em região controlada.', param: { type: 'anchor' } },
  { key: 'spectralFilter' as const, label: 'Filtragem espectral', icon: Activity, description: 'Atenua bandas de frequência espacial seletivas no domínio de Fourier.', param: { type: 'spectral' } },
] as const

type AnyTechKey = typeof baseTechniques[number]['key'] | typeof advancedTechniques[number]['key']

function TechniqueRow({
  techKey, label, icon: Icon, description, param, config, onChange, disabled,
}: {
  techKey: AnyTechKey
  label: string
  icon: React.ElementType
  description: string
  param: { type: string; label?: string; min?: number; max?: number }
  config: Config
  onChange: (c: Config) => void
  disabled?: boolean
}) {
  const t = config.techniques
  const technique = t[techKey] as Record<string, unknown>
  const enabled = technique.enabled as boolean

  function set(patch: Partial<typeof technique>) {
    onChange({ ...config, techniques: { ...t, [techKey]: { ...technique, ...patch } } })
  }

  return (
    <div className={`rounded-lg p-3 transition-colors ${enabled ? 'bg-zinc-800/80' : 'bg-zinc-900/30'}`}>
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={v => set({ enabled: v })} disabled={disabled} />
        <div className={`rounded-md p-1.5 ${enabled ? 'bg-emerald-900/50' : 'bg-zinc-800'}`}>
          <Icon className={`h-4 w-4 ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
        </div>
        <span className={`flex-1 text-sm font-medium ${enabled ? 'text-zinc-100' : 'text-zinc-500'}`}>{label}</span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-zinc-600 hover:text-zinc-400 transition-colors"><Info className="h-3.5 w-3.5" /></button>
            </TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {enabled && (
        <div className="mt-3 pl-12 space-y-2">
          {(param.type === 'intensity' || param.type === 'epsilon') && (
            <SliderRow label={param.label!} min={param.min!} max={param.max!} value={technique.intensity as number ?? technique.epsilon as number ?? 50} onChange={v => set(param.type === 'epsilon' ? { epsilon: v } : { intensity: v })} disabled={disabled} />
          )}
          {param.type === 'factor' && (
            <SliderRow label="Fator" min={93} max={99} value={Math.round((t.dualResampling.factor ?? 0.97) * 100)} onChange={v => set({ factor: v / 100 })} display={`${((t.dualResampling.factor ?? 0.97) * 100).toFixed(0)}%`} disabled={disabled} />
          )}
          {param.type === 'quality' && (
            <SliderRow label="Qualidade" min={85} max={99} value={t.reencoding.quality} onChange={v => set({ quality: v })} disabled={disabled} />
          )}
          {param.type === 'signature' && (
            <>
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-zinc-400">Seed</span>
                <Input placeholder="Sua seed secreta..." value={t.privacySignature.seed} onChange={e => set({ seed: e.target.value })} disabled={disabled} className="flex-1 h-7 text-xs" />
              </div>
              <SliderRow label="Bits LSB" min={1} max={3} value={t.privacySignature.bits} onChange={v => set({ bits: v })} disabled={disabled} />
            </>
          )}
          {param.type === 'anchor' && (
            <>
              <SliderRow label="Tamanho" min={0} max={100} value={t.attentionAnchor.size} onChange={v => set({ size: v })} disabled={disabled} />
              <SliderRow label="Opacidade" min={3} max={12} value={t.attentionAnchor.opacity} onChange={v => set({ opacity: v })} display={`${t.attentionAnchor.opacity}%`} disabled={disabled} />
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-zinc-400">Posição</span>
                <select
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={t.attentionAnchor.position}
                  onChange={e => set({ position: e.target.value })}
                  disabled={disabled}
                >
                  <option value="random">Aleatória</option>
                  <option value="top-left">Superior esquerdo</option>
                  <option value="top-right">Superior direito</option>
                  <option value="bottom-left">Inferior esquerdo</option>
                  <option value="bottom-right">Inferior direito</option>
                </select>
              </div>
            </>
          )}
          {param.type === 'spectral' && (
            <>
              <SliderRow label="Intensidade" min={0} max={100} value={t.spectralFilter.intensity} onChange={v => set({ intensity: v })} disabled={disabled} />
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-zinc-400">Banda</span>
                <div className="flex gap-2">
                  {(['low', 'mid', 'high'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => !disabled && set({ band: b })}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${t.spectralFilter.band === b ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                      disabled={disabled}
                    >
                      {b === 'low' ? 'Baixa' : b === 'mid' ? 'Média' : 'Alta'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SliderRow({ label, min, max, value, onChange, display, disabled }: {
  label: string; min: number; max: number; value: number
  onChange: (v: number) => void; display?: string; disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-zinc-400">{label}</span>
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v)} disabled={disabled} className="flex-1" />
      <span className="w-10 text-right text-xs font-mono text-emerald-400">{display ?? value}</span>
    </div>
  )
}

export function TechniquePanel({ config, onChange, disabled }: TechniquePanelProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1">
        {/* Global options */}
        <div className="flex flex-wrap gap-4 pb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={config.stripMetadata} onCheckedChange={v => onChange({ ...config, stripMetadata: v })} disabled={disabled} />
            <span className="text-sm text-zinc-300">Remover metadados (EXIF)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Formato:</span>
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={config.outputFormat}
              onChange={e => onChange({ ...config, outputFormat: e.target.value as Config['outputFormat'] })}
              disabled={disabled}
            >
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
        </div>

        <Separator className="mb-3" />

        {/* Base techniques */}
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pb-1">Proteção Base</p>
        <div className="space-y-1">
          {baseTechniques.map(tech => (
            <TechniqueRow key={tech.key} techKey={tech.key} label={tech.label} icon={tech.icon} description={tech.description} param={tech.param} config={config} onChange={onChange} disabled={disabled} />
          ))}
        </div>

        <div className="pt-3 pb-1">
          <Separator className="mb-3" />
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pb-1">Proteção Avançada</p>
        </div>

        <div className="space-y-1">
          {advancedTechniques.map(tech => (
            <TechniqueRow key={tech.key} techKey={tech.key} label={tech.label} icon={tech.icon} description={tech.description} param={tech.param} config={config} onChange={onChange} disabled={disabled} />
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
