"use client"

import React, { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { QueueItem } from '@/hooks/useProcessing'

interface CompareDialogProps {
  item: QueueItem | null
  open: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function CompareDialog({ item, open, onClose }: CompareDialogProps) {
  const [splitPos, setSplitPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pos = ((e.clientX - rect.left) / rect.width) * 100
    setSplitPos(Math.max(2, Math.min(98, pos)))
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pos = ((e.touches[0].clientX - rect.left) / rect.width) * 100
    setSplitPos(Math.max(2, Math.min(98, pos)))
  }, [])

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Comparação antes / depois</DialogTitle>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-zinc-800 p-3">
            <p className="text-xs text-zinc-400">Tamanho original</p>
            <p className="text-sm font-semibold text-zinc-100">{formatBytes(item.originalSize)}</p>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3">
            <p className="text-xs text-zinc-400">Tamanho protegido</p>
            <p className="text-sm font-semibold text-emerald-400">{item.processedSize ? formatBytes(item.processedSize) : '—'}</p>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3">
            <p className="text-xs text-zinc-400">Qualidade visual (SSIM)</p>
            <p className="text-sm font-semibold text-zinc-100">{item.ssim ?? '—'}%</p>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3">
            <p className="text-xs text-zinc-400">Proteção estimada</p>
            <p className="text-sm font-semibold text-emerald-400">{item.protection ?? '—'}%</p>
          </div>
        </div>

        {/* Score bars */}
        {item.ssim !== undefined && (
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Qualidade visual preservada (SSIM)</span>
                <span>{item.ssim}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${item.ssim}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Proteção visual estimada</span>
                <span>{item.protection}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all"
                  style={{ width: `${item.protection}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Image comparison slider */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-lg select-none cursor-col-resize"
          style={{ aspectRatio: '16/9', maxHeight: '400px' }}
          onMouseMove={onMouseMove}
          onMouseDown={() => { isDragging.current = true }}
          onMouseUp={() => { isDragging.current = false }}
          onMouseLeave={() => { isDragging.current = false }}
          onTouchMove={onTouchMove}
        >
          {/* Original (bottom layer) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.previewUrl}
            alt="Original"
            className="absolute inset-0 w-full h-full object-contain bg-zinc-950"
            draggable={false}
          />

          {/* Processed (clipped top layer) */}
          {item.processedUrl && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${splitPos}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.processedUrl}
                alt="Protegida"
                className="absolute inset-0 w-full h-full object-contain bg-zinc-950"
                style={{ width: `${100 / (splitPos / 100)}%`, maxWidth: 'none' }}
                draggable={false}
              />
            </div>
          )}

          {/* Divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            style={{ left: `${splitPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900 border-2 border-emerald-400 flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-3 3 3 3m8-6l3 3-3 3" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-zinc-300">Original</div>
          <div className="absolute top-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-emerald-300">Protegida</div>
        </div>

        <p className="text-center text-xs text-zinc-500">Arraste o divisor para comparar as imagens</p>
      </DialogContent>
    </Dialog>
  )
}
