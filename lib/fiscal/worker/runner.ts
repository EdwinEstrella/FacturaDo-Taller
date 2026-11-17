// SERVER ONLY. Polls the fiscal outbox on an interval inside the Next.js server process.
// Enabled only where ECF_FISCAL_WORKER=true (the receptor server); the desktop app never sets it.

import { createOutboxWorkerDeps, processOutboxOnce } from "./outbox-worker"

const INTERVAL_MS = 15_000

let started = false

export function startFiscalWorker(): void {
    if (started) return
    started = true

    let running = false
    const deps = createOutboxWorkerDeps()
    deps.log("started", { intervalMs: INTERVAL_MS })

    const tick = async () => {
        if (running) return
        running = true
        try {
            // Drain due jobs batch by batch; the next tick picks up anything left.
            while ((await processOutboxOnce(deps)) > 0) { /* keep draining */ }
        } catch (error) {
            deps.log("tick_failed", { message: error instanceof Error ? error.message : String(error) })
        } finally {
            running = false
        }
    }

    setInterval(() => void tick(), INTERVAL_MS)
    void tick()
}
