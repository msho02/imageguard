"use client"

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { Shield, Download, Play, Trash2, Moon, Sun } from 'lucide-react'
import JSZip from 'jszip'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DropZone } from '@/components/DropZone'
import { ImageQueue } from '@/components/ImageQueue'
import { TechniquePanel } from '@/components/TechniquePanel'
import { CompareDialog } from '@/components/CompareDialog'

import { useProcessing, type QueueItem } from '@/hooks/useProcessing'
import { defaultConfig, loadConfig, saveConfig, type Config } from '@/lib/config'

export default function Home() {
  const [config, setConfig] = useState<Config>(defaultConfig)
  const [compareItem, setCompareItem] = useState<QueueItem | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const didLoadRef = useRef(false)

  const { queue, isProcessing, progress, eta, addFiles, removeItem, clearAll, processAll } = useProcessing()

  // Load config from localStorage on mount
  useEffect(() => {
    if (didLoadRef.current) return
    didLoadRef.current = true
    setConfig(loadConfig())
  }, [])

  // Save config when it changes
  useEffect(() => {
    if (!didLoadRef.current) return
    saveConfig(config)
  }, [config])

  // Ctrl+Enter to process
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isProcessing && queue.length > 0) {
        e.preventDefault()
        handleProcessAll()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleProcessAll = useCallback(async () => {
    const waiting = queue.filter(i => i.status === 'waiting' || i.status === 'error')
    if (waiting.length === 0) {
      toast.info('Nenhuma imagem para processar')
      return
    }
    const toastId = toast.loading(`Processando ${waiting.length} imagem${waiting.length > 1 ? 's' : ''}...`)
    await processAll(config)
    toast.dismiss(toastId)
    toast.success('Processamento concluído!')
  }, [queue, config, processAll])

  const handleDownloadZip = useCallback(async () => {
    const done = queue.filter(i => i.status === 'done' && i.processedBlob)
    if (done.length === 0) {
      toast.info('Nenhuma imagem processada para download')
      return
    }
    const zip = new JSZip()
    const folder = zip.folder('imageguard-protected')!
    for (const item of done) {
      if (item.processedBlob && item.processedName) {
        folder.file(item.processedName, item.processedBlob)
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'imageguard-protected.zip'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${done.length} imagem${done.length > 1 ? 's' : ''} exportada${done.length > 1 ? 's' : ''} em ZIP`)
  }, [queue])

  const handleCompare = useCallback((item: QueueItem) => {
    setCompareItem(item)
    setCompareOpen(true)
  }, [])

  const doneCount = queue.filter(i => i.status === 'done').length
  const waitingCount = queue.filter(i => i.status === 'waiting' || i.status === 'error').length

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-100">
              Image<span className="text-emerald-400">Guard</span>
            </span>
            <span className="hidden sm:inline-block text-xs text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">
              v1.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-zinc-500">
              Proteção de privacidade por perturbação adversarial
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsDark(d => !d)}
              title="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

          {/* Left: Drop zone + Queue */}
          <div className="flex flex-col gap-6">
            {/* Drop zone */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-300">Adicionar imagens</CardTitle>
              </CardHeader>
              <CardContent>
                <DropZone onFiles={addFiles} disabled={isProcessing} />
              </CardContent>
            </Card>

            {/* Queue */}
            <Card className="flex-1">
              <CardContent className="pt-4">
                <ImageQueue
                  items={queue}
                  isProcessing={isProcessing}
                  progress={progress}
                  eta={eta}
                  onRemove={removeItem}
                  onCompare={handleCompare}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Configuration panel */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Técnicas de proteção
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(100vh-280px)]">
                <TechniquePanel
                  config={config}
                  onChange={setConfig}
                  disabled={isProcessing}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="mt-6">
          <Separator className="mb-4" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                onClick={handleProcessAll}
                disabled={isProcessing || waitingCount === 0}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {isProcessing
                  ? `Processando... ${progress}%`
                  : `Proteger tudo${waitingCount > 0 ? ` (${waitingCount})` : ''}`}
              </Button>

              <Button
                variant="outline"
                onClick={handleDownloadZip}
                disabled={doneCount === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download ZIP{doneCount > 0 ? ` (${doneCount})` : ''}
              </Button>

              {queue.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="gap-2 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                Ctrl+Enter
              </kbd>
              <span>para processar</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Baseado em Fawkes & Glaze (UChicago)</span>
            </div>
          </div>
        </div>
      </main>

      {/* Compare dialog */}
      <CompareDialog
        item={compareItem}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  )
}
