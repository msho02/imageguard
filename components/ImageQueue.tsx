"use client"

import React from 'react'
import { Download, Trash2, Eye, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import type { QueueItem } from '@/hooks/useProcessing'
import { cn } from '@/lib/utils'

interface ImageQueueProps {
  items: QueueItem[]
  isProcessing: boolean
  progress: number
  eta: number | null
  onRemove: (id: string) => void
  onCompare: (item: QueueItem) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const statusConfig = {
  waiting: { label: 'Aguardando', variant: 'secondary' as const, icon: Clock },
  processing: { label: 'Processando', variant: 'processing' as const, icon: Loader2 },
  done: { label: 'Pronto', variant: 'default' as const, icon: CheckCircle2 },
  error: { label: 'Erro', variant: 'destructive' as const, icon: AlertCircle },
}

export function ImageQueue({
  items,
  isProcessing,
  progress,
  eta,
  onRemove,
  onCompare,
}: ImageQueueProps) {
  const doneCount = items.filter(i => i.status === 'done').length

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">
          Fila de imagens
          <span className="ml-2 text-xs text-zinc-500">
            ({items.length} {items.length === 1 ? 'imagem' : 'imagens'})
          </span>
        </h3>
        {doneCount > 0 && (
          <span className="text-xs text-emerald-400">{doneCount} prontas</span>
        )}
      </div>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Processando batch...</span>
            <span>
              {progress}%{eta !== null ? ` · ~${eta}s restantes` : ''}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">
          Nenhuma imagem na fila
        </div>
      ) : (
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-2 pr-2">
            {items.map(item => {
              const { label, variant, icon: Icon } = statusConfig[item.status]
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    item.status === 'done'
                      ? "border-emerald-900/50 bg-emerald-950/20"
                      : item.status === 'error'
                      ? "border-red-900/50 bg-red-950/20"
                      : item.status === 'processing'
                      ? "border-blue-900/50 bg-blue-950/20"
                      : "border-zinc-800 bg-zinc-900/50"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.status === 'done' && item.processedUrl ? item.processedUrl : item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                    {item.status === 'processing' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {item.file.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{formatBytes(item.originalSize)}</span>
                      {item.processedSize && (
                        <>
                          <span className="text-xs text-zinc-600">→</span>
                          <span className="text-xs text-emerald-400">{formatBytes(item.processedSize)}</span>
                        </>
                      )}
                    </div>
                    {item.status === 'done' && item.ssim !== undefined && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-zinc-500">SSIM: {item.ssim}%</span>
                        <span className="text-xs text-zinc-500">·</span>
                        <span className="text-xs text-zinc-500">Proteção: {item.protection}%</span>
                      </div>
                    )}
                    {item.status === 'error' && item.error && (
                      <p className="mt-0.5 truncate text-xs text-red-400">{item.error}</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <Badge variant={variant} className="shrink-0">
                    <Icon className={cn("mr-1 h-3 w-3", item.status === 'processing' && "animate-spin")} />
                    {label}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {item.status === 'done' && item.processedUrl && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                          onClick={() => onCompare(item)}
                          title="Comparar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <a href={item.processedUrl} download={item.processedName}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-600 hover:text-red-400"
                      onClick={() => onRemove(item.id)}
                      disabled={item.status === 'processing'}
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
