"use client"

import React, { useCallback, useRef, useState } from 'react'
import { Upload, ImageIcon, Film } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  mode?: 'image' | 'video' | 'both'
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export function DropZone({ onFiles, disabled, mode = 'both' }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accepted = mode === 'image' ? IMAGE_TYPES : mode === 'video' ? VIDEO_TYPES : [...IMAGE_TYPES, ...VIDEO_TYPES]

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => accepted.includes(f.type))
    if (valid.length > 0) onFiles(valid)
  }, [onFiles, accepted])

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!disabled) setDragging(true) }, [disabled])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (!disabled) handleFiles(e.dataTransfer.files)
  }, [disabled, handleFiles])

  const isVideo = mode === 'video'
  const AcceptStr = accepted.join(',')

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none min-h-[160px] p-6",
        dragging
          ? "border-emerald-400 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
          : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-900",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input ref={inputRef} type="file" multiple accept={AcceptStr} className="hidden" onChange={e => handleFiles(e.target.files)} />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={cn("rounded-full p-3 transition-colors", dragging ? "bg-emerald-900/50" : "bg-zinc-800")}>
          {dragging
            ? (isVideo ? <Film className="h-8 w-8 text-emerald-400" /> : <ImageIcon className="h-8 w-8 text-emerald-400" />)
            : <Upload className="h-8 w-8 text-zinc-400" />}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {dragging
              ? `Solte os arquivos aqui`
              : isVideo
                ? 'Arraste vídeos ou clique para selecionar'
                : 'Arraste imagens ou clique para selecionar'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {isVideo ? 'MP4, WebM, MOV' : mode === 'both' ? 'JPEG, PNG, WebP, GIF — e MP4, WebM, MOV' : 'JPEG, PNG, WebP, GIF, BMP'}
          </p>
        </div>
      </div>
    </div>
  )
}
