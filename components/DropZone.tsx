"use client"

import React, { useCallback, useRef, useState } from 'react'
import { Upload, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const valid = Array.from(files).filter(f => ACCEPTED.includes(f.type))
      if (valid.length > 0) onFiles(valid)
    },
    [onFiles]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }, [disabled])

  const onDragLeave = useCallback(() => setDragging(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (!disabled) handleFiles(e.dataTransfer.files)
    },
    [disabled, handleFiles]
  )

  const onClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  return (
    <div
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none",
        "min-h-[180px] p-6",
        dragging
          ? "border-emerald-400 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
          : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-900",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={cn(
          "rounded-full p-3 transition-colors",
          dragging ? "bg-emerald-900/50" : "bg-zinc-800"
        )}>
          {dragging ? (
            <ImageIcon className="h-8 w-8 text-emerald-400" />
          ) : (
            <Upload className="h-8 w-8 text-zinc-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {dragging ? 'Solte as imagens aqui' : 'Arraste imagens ou clique para selecionar'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            JPEG, PNG, WebP, GIF, BMP — múltiplos arquivos
          </p>
        </div>
      </div>
    </div>
  )
}
