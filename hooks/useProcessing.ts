"use client"

import { useState, useCallback, useRef } from 'react'
import type { Config } from '@/lib/config'

export type ImageStatus = 'waiting' | 'processing' | 'done' | 'error'

export interface QueueItem {
  id: string
  file: File
  previewUrl: string
  status: ImageStatus
  processedUrl?: string
  processedBlob?: Blob
  processedName?: string
  error?: string
  ssim?: number
  protection?: number
  originalSize: number
  processedSize?: number
  width?: number
  height?: number
}

export function useProcessing() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState<number | null>(null)
  const timingsRef = useRef<number[]>([])

  const addFiles = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'waiting',
      originalSize: file.size,
    }))
    setQueue(prev => [...prev, ...newItems])
  }, [])

  const removeItem = useCallback((id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (item?.processedUrl) URL.revokeObjectURL(item.processedUrl)
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    setQueue(prev => {
      prev.forEach(i => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl)
        if (i.processedUrl) URL.revokeObjectURL(i.processedUrl)
      })
      return []
    })
  }, [])

  const processAll = useCallback(async (config: Config) => {
    setIsProcessing(true)
    timingsRef.current = []

    const waiting = queue.filter(i => i.status === 'waiting' || i.status === 'error')
    if (waiting.length === 0) {
      setIsProcessing(false)
      return
    }

    const CONCURRENCY = 3
    let completed = 0

    const processItem = async (item: QueueItem) => {
      const start = Date.now()

      setQueue(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i)
      )

      try {
        const formData = new FormData()
        formData.append('image', item.file)
        formData.append('config', JSON.stringify(config))

        const res = await fetch('/api/process', { method: 'POST', body: formData })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Processing failed' }))
          throw new Error(err.error || 'Processing failed')
        }

        const blob = await res.blob()
        const processedUrl = URL.createObjectURL(blob)
        const ext = config.outputFormat || 'jpeg'
        const processedName = item.file.name.replace(/\.[^.]+$/, '') + `-protected.${ext}`

        const ssim = parseInt(res.headers.get('X-SSIM') || '0')
        const protection = parseInt(res.headers.get('X-Protection') || '0')
        const processedSize = parseInt(res.headers.get('X-Processed-Size') || '0')
        const width = parseInt(res.headers.get('X-Width') || '0')
        const height = parseInt(res.headers.get('X-Height') || '0')

        completed++
        const elapsed = Date.now() - start
        timingsRef.current.push(elapsed)
        const avgTime = timingsRef.current.reduce((a, b) => a + b, 0) / timingsRef.current.length
        const remaining = waiting.length - completed
        setEta(remaining > 0 ? Math.round((remaining * avgTime) / 1000) : null)
        setProgress(Math.round((completed / waiting.length) * 100))

        setQueue(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'done', processedUrl, processedBlob: blob, processedName, ssim, protection, processedSize, width, height }
              : i
          )
        )
      } catch (err) {
        completed++
        setProgress(Math.round((completed / waiting.length) * 100))
        setQueue(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
              : i
          )
        )
      }
    }

    // Process in batches of CONCURRENCY
    for (let i = 0; i < waiting.length; i += CONCURRENCY) {
      const batch = waiting.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(processItem))
    }

    setIsProcessing(false)
    setEta(null)
  }, [queue])

  return { queue, isProcessing, progress, eta, addFiles, removeItem, clearAll, processAll }
}
