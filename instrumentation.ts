// Next.js server startup hook. Starts the fiscal outbox worker only on the receptor server.
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return
    if (process.env.ECF_FISCAL_WORKER !== "true") return

    const { startFiscalWorker } = await import("./lib/fiscal/worker/runner")
    startFiscalWorker()
}
