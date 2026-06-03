"use client"

import React from 'react'
import {
  Waves,
  Maximize2,
  RefreshCw,
  Palette,
  Fingerprint,
  FileImage,
  Info,
} from 'lucide-react'
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

const techniques = [
  {
    key: 'highFreqNoise' as const,
    label: 'Ruído de alta frequência',
    icon: Waves,
    description: 'Perturbação gaussiana por canal de cor. Altera vetores de embedding de CNNs sem alterar percepção visual.',
    hasIntensity: true,
    intensityLabel: 'Intensidade',
    intensityMin: 0,
    intensityMax: 100,
    intensityStep: 1,
  },
  {
    key: 'geometricWarp' as const,
    label: 'Micro-distorção geométrica',
    icon: Maximize2,
    description: 'Rotação sub-pixel (0.1°–1.5°) com crop central. Altera descritores espaciais de imagem.',
    hasIntensity: true,
    intensityLabel: 'Intensidade',
    intensityMin: 0,
    intensityMax: 100,
    intensityStep: 1,
  },
  {
    key: 'dualResampling' as const,
    label: 'Recodificação por interpolação dupla',
    icon: RefreshCw,
    description: 'Redimensiona com Lanczos3 e restaura com nearest-neighbor. Redistribui coeficientes sem degradação visível.',
    hasIntensity: false,
    hasFactor: true,
    factorLabel: 'Fator',
    factorMin: 93,
    factorMax: 99,
    factorStep: 1,
  },
  {
    key: 'chromaticJitter' as const,
    label: 'Modulação cromática',
    icon: Palette,
    description: 'Offsets HSL independentes por canal. Preserva percepção de cor, altera histogramas de fingerprinting.',
    hasIntensity: true,
    intensityLabel: 'Intensidade',
    intensityMin: 0,
    intensityMax: 100,
    intensityStep: 1,
  },
  {
    key: 'privacySignature' as const,
    label: 'Assinatura de privacidade',
    icon: Fingerprint,
    description: 'Marca d\'água espectral nos bits menos significativos. Identificável pelo dono com a seed correta.',
    hasIntensity: false,
    hasBits: true,
    hasSeed: true,
  },
  {
    key: 'reencoding' as const,
    label: 'Re-encode com perfil explícito',
    icon: FileImage,
    description: 'Recodificação JPEG com chroma 4:4:4 e qualidade controlada. Remove fingerprints do encoder original.',
    hasIntensity: false,
    hasQuality: true,
    qualityMin: 85,
    qualityMax: 99,
    qualityStep: 1,
  },
] as const

export function TechniquePanel({ config, onChange, disabled }: TechniquePanelProps) {
  const t = config.techniques

  function setEnabled(key: keyof typeof t, enabled: boolean) {
    onChange({
      ...config,
      techniques: { ...t, [key]: { ...t[key], enabled } },
    })
  }

  function setIntensity(key: keyof typeof t, intensity: number) {
    onChange({
      ...config,
      techniques: { ...t, [key]: { ...t[key], intensity } },
    })
  }

  function setFactor(factor: number) {
    onChange({
      ...config,
      techniques: { ...t, dualResampling: { ...t.dualResampling, factor: factor / 100 } },
    })
  }

  function setQuality(quality: number) {
    onChange({
      ...config,
      techniques: { ...t, reencoding: { ...t.reencoding, quality } },
    })
  }

  function setBits(bits: number) {
    onChange({
      ...config,
      techniques: { ...t, privacySignature: { ...t.privacySignature, bits } },
    })
  }

  function setSeed(seed: string) {
    onChange({
      ...config,
      techniques: { ...t, privacySignature: { ...t.privacySignature, seed } },
    })
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1">
        {/* Global options */}
        <div className="flex flex-wrap gap-4 pb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={config.stripMetadata}
              onCheckedChange={v => onChange({ ...config, stripMetadata: v })}
              disabled={disabled}
            />
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

        {/* Techniques */}
        {techniques.map((tech, idx) => {
          const technique = t[tech.key] as Record<string, unknown>
          const enabled = technique.enabled as boolean

          return (
            <div key={tech.key}>
              <div className={`rounded-lg p-3 transition-colors ${enabled ? 'bg-zinc-800/80' : 'bg-zinc-900/30'}`}>
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={enabled}
                    onCheckedChange={v => setEnabled(tech.key, v)}
                    disabled={disabled}
                  />
                  <div className={`rounded-md p-1.5 ${enabled ? 'bg-emerald-900/50' : 'bg-zinc-800'}`}>
                    <tech.icon className={`h-4 w-4 ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  </div>
                  <span className={`flex-1 text-sm font-medium ${enabled ? 'text-zinc-100' : 'text-zinc-500'}`}>
                    {tech.label}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {tech.description}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Controls */}
                {enabled && (
                  <div className="mt-3 pl-12 space-y-3">
                    {'hasIntensity' in tech && tech.hasIntensity && (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-zinc-400">
                          {(tech as {intensityLabel: string}).intensityLabel}
                        </span>
                        <Slider
                          min={(tech as {intensityMin: number}).intensityMin}
                          max={(tech as {intensityMax: number}).intensityMax}
                          step={(tech as {intensityStep: number}).intensityStep}
                          value={[technique.intensity as number]}
                          onValueChange={([v]) => setIntensity(tech.key, v)}
                          disabled={disabled}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-xs font-mono text-emerald-400">
                          {technique.intensity as number}
                        </span>
                      </div>
                    )}

                    {'hasFactor' in tech && tech.hasFactor && (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-zinc-400">Fator</span>
                        <Slider
                          min={93}
                          max={99}
                          step={1}
                          value={[Math.round((t.dualResampling.factor || 0.97) * 100)]}
                          onValueChange={([v]) => setFactor(v)}
                          disabled={disabled}
                          className="flex-1"
                        />
                        <span className="w-12 text-right text-xs font-mono text-emerald-400">
                          {((t.dualResampling.factor || 0.97) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}

                    {'hasQuality' in tech && tech.hasQuality && (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-zinc-400">Qualidade</span>
                        <Slider
                          min={85}
                          max={99}
                          step={1}
                          value={[t.reencoding.quality]}
                          onValueChange={([v]) => setQuality(v)}
                          disabled={disabled}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-xs font-mono text-emerald-400">
                          {t.reencoding.quality}
                        </span>
                      </div>
                    )}

                    {'hasSeed' in tech && tech.hasSeed && (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-zinc-400">Seed</span>
                        <Input
                          placeholder="Sua seed secreta..."
                          value={t.privacySignature.seed}
                          onChange={e => setSeed(e.target.value)}
                          disabled={disabled}
                          className="flex-1 h-7 text-xs"
                        />
                      </div>
                    )}

                    {'hasBits' in tech && tech.hasBits && (
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs text-zinc-400">Bits LSB</span>
                        <Slider
                          min={1}
                          max={3}
                          step={1}
                          value={[t.privacySignature.bits]}
                          onValueChange={([v]) => setBits(v)}
                          disabled={disabled}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-xs font-mono text-emerald-400">
                          {t.privacySignature.bits}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {idx < techniques.length - 1 && <div className="h-1" />}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
