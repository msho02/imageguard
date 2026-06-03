"use client"

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import type { Config } from '@/lib/config'

interface VideoConfigPanelProps {
  config: Config
  onChange: (c: Config) => void
  disabled?: boolean
}

export function VideoConfigPanel({ config, onChange, disabled }: VideoConfigPanelProps) {
  const v = config.video

  function set(patch: Partial<typeof v>) {
    onChange({ ...config, video: { ...v, ...patch } })
  }

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Configurações de Vídeo</p>

      {/* Frame processing */}
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-sm text-zinc-400">Frames</span>
        <select
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          value={v.frameProcessing}
          onChange={e => set({ frameProcessing: e.target.value as 'all' | 'keyframes' })}
          disabled={disabled}
        >
          <option value="all">Todos os frames</option>
          <option value="keyframes">Apenas keyframes</option>
        </select>
      </div>

      {/* Bitrate */}
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-sm text-zinc-400">Bitrate</span>
        <Slider min={4} max={20} step={1} value={[v.outputBitrate]} onValueChange={([val]) => set({ outputBitrate: val })} disabled={disabled} className="flex-1" />
        <span className="w-16 text-right text-xs font-mono text-emerald-400">{v.outputBitrate} Mbps</span>
      </div>

      {/* Codec */}
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-sm text-zinc-400">Codec</span>
        <div className="flex gap-2">
          {(['h264', 'h265'] as const).map(c => (
            <button
              key={c}
              onClick={() => !disabled && set({ codec: c })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${v.codec === c ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
              disabled={disabled}
            >
              {c === 'h264' ? 'H.264' : 'H.265'}
            </button>
          ))}
        </div>
      </div>

      {/* Preserve audio */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch checked={v.preserveAudio} onCheckedChange={val => set({ preserveAudio: val })} disabled={disabled} />
        <span className="text-sm text-zinc-300">Preservar áudio original</span>
      </label>
    </div>
  )
}
