"use client"

import { useState, useCallback, useRef } from 'react'
import type { Config } from '@/lib/config'

export type ImageStatus = 'waiting' | 'processing' | 'done' | 'error'
export type MediaType = 'image' | 'video'

export interface QueueItem {
  id: string
  file: File
  mediaType: MediaType
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
  // Video specific
  totalFrames?: number
  videoProgress?: number
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export function useProcessing() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState<number | null>(null)
  const timingsRef = useRef<number[]>([])
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  const addFiles = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map(file => {
      const mediaType: MediaType = VIDEO_TYPES.includes(file.type) ? 'video' : 'image'
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        mediaType,
        previewUrl: mediaType === 'image' ? URL.createObjectURL(file) : '',
        status: 'waiting',
        originalSize: file.size,
      }
    })
    setQueue(prev => [...prev, ...newItems])
  }, [])

  const removeItem = useCallback((id: string) => {
    abortControllers.current.get(id)?.abort()
    abortControllers.current.delete(id)
    setQueue(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (item?.processedUrl) URL.revokeObjectURL(item.processedUrl)
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    abortControllers.current.forEach(ac => ac.abort())
    abortControllers.current.clear()
    setQueue(prev => {
      prev.forEach(i => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl)
        if (i.processedUrl) URL.revokeObjectURL(i.processedUrl)
      })
      return []
    })
  }, [])

  const processImageItem = async (item: QueueItem, config: Config): Promise<void> => {
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

    setQueue(prev => prev.map(i => i.id === item.id ? {
      ...i, status: 'done', processedUrl, processedBlob: blob, processedName,
      ssim: parseInt(res.headers.get('X-SSIM') || '0'),
      protection: parseInt(res.headers.get('X-Protection') || '0'),
      processedSize: parseInt(res.headers.get('X-Processed-Size') || '0'),
      width: parseInt(res.headers.get('X-Width') || '0'),
      height: parseInt(res.headers.get('X-Height') || '0'),
    } : i))
  }

  const processVideoItem = async (item: QueueItem, config: Config): Promise<void> => {
    const formData = new FormData()
    formData.append('video', item.file)
    formData.append('config', JSON.stringify(config))

    const ac = new AbortController()
    abortControllers.current.set(item.id, ac)

    const res = await fetch('/api/process-video', {
      method: 'POST',
      body: formData,
      signal: ac.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Video processing failed' }))
      throw new Error(err.error || 'Video processing failed')
    }

    const blob = await res.blob()
    const processedUrl = URL.createObjectURL(blob)
    const processedName = item.file.name.replace(/\.[^.]+$/, '') + '-protected.mp4'
    const totalFrames = parseInt(res.headers.get('X-Total-Frames') || '0')

    setQueue(prev => prev.map(i => i.id === item.id ? {
      ...i, status: 'done', processedUrl, processedBlob: blob, processedName,
      totalFrames, processedSize: blob.size,
    } : i))

    abortControllers.current.delete(item.id)
  }

  const processAll = useCallback(async (config: Config) => {
    setIsProcessing(true)
    timingsRef.current = []

    const waiting = queue.filter(i => i.status === 'waiting' || i.status === 'error')
    if (waiting.length === 0) { setIsProcessing(false); return }

    const CONCURRENCY = 3
    let completed = 0

    const processItem = async (item: QueueItem) => {
      const start = Date.now()
      setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))

      try {
        if (item.mediaType === 'video') {
          await processVideoItem(item, config)
        } else {
          await processImageItem(item, config)
        }

        completed++
        const elapsed = Date.now() - start
        timingsRef.current.push(elapsed)
        const avgTime = timingsRef.current.reduce((a, b) => a + b, 0) / timingsRef.current.length
        const remaining = waiting.length - completed
        setEta(remaining > 0 ? Math.round(remaining * avgTime / 1000) : null)
        setProgress(Math.round(completed / waiting.length * 100))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        completed++
        setProgress(Math.round(completed / waiting.length * 100))
        setQueue(prev => prev.map(i => i.id === item.id ? {
          ...i, status: 'error', error: err instanceof Error ? err.message : 'Unknown error',
        } : i))
      }
    }

    for (let i = 0; i < waiting.length; i += CONCURRENCY) {
      await Promise.all(waiting.slice(i, i + CONCURRENCY).map(processItem))
    }

    setIsProcessing(false)
    setEta(null)
  }, [queue])

  return { queue, isProcessing, progress, eta, addFiles, removeItem, clearAll, processAll }
}
