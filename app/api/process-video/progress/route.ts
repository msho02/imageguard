import { NextRequest } from 'next/server'
import { progressMap } from '../route'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      if (!jobId) {
        send({ error: 'No jobId provided' })
        controller.close()
        return
      }

      const interval = setInterval(() => {
        const progress = progressMap.get(jobId)
        if (!progress) {
          send({ error: 'Job not found' })
          clearInterval(interval)
          controller.close()
          return
        }

        send(progress)

        if (progress.done) {
          clearInterval(interval)
          setTimeout(() => {
            progressMap.delete(jobId)
            controller.close()
          }, 2000)
        }
      }, 500)

      // Cleanup if client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
