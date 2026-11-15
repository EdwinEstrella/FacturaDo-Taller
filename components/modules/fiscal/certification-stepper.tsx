"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, PartyPopper } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { saveCertificationProgress } from "@/actions/ecf-actions"
import {
    CERTIFICATION_STEPS,
    CERTIFICATION_TOTAL_STEPS,
    DGII_CERTIFICATION_PORTAL_URL,
    advanceProgress,
    selectStep,
    type CertificationProgress,
} from "@/lib/fiscal/shared/certification-steps"
import { ReceptorUrlFields } from "./receptor-url-fields"
import { TestSetRunner } from "./test-set-runner"
import { XmlSigner } from "./xml-signer"

export function CertificationStepper({ initialProgress, companyRnc }: {
    initialProgress: CertificationProgress
    companyRnc: string
}) {
    const [progress, setProgress] = useState(initialProgress)
    const [pending, startTransition] = useTransition()

    const step = CERTIFICATION_STEPS.find((s) => s.id === progress.currentStep) ?? CERTIFICATION_STEPS[0]
    const isLast = step.id === CERTIFICATION_TOTAL_STEPS
    const completedAll = progress.completedSteps.includes(CERTIFICATION_TOTAL_STEPS - 1)

    const persist = (next: CertificationProgress) => {
        const previous = progress
        setProgress(next)
        startTransition(async () => {
            const result = await saveCertificationProgress(next)
            if (!result.success) {
                setProgress(previous)
                toast.error(result.error)
            }
        })
    }

    const openPortal = () => window.open(DGII_CERTIFICATION_PORTAL_URL, "_blank", "noopener,noreferrer")

    return (
        <div className="space-y-6">
            <ol className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Pasos de la certificación">
                {CERTIFICATION_STEPS.map((item) => {
                    const done = progress.completedSteps.includes(item.id)
                    const current = item.id === progress.currentStep
                    return (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => persist(selectStep(progress, item.id))}
                                title={item.label}
                                aria-label={`Paso ${item.id}: ${item.label}`}
                                aria-current={current ? "step" : undefined}
                                className={cn(
                                    "flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                                    current && "border-blue-600 bg-blue-600 text-white shadow",
                                    !current && done && "border-emerald-500 bg-emerald-50 text-emerald-700",
                                    !current && !done && "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                )}
                            >
                                {done && !current ? <Check className="size-4" /> : item.id}
                            </button>
                        </li>
                    )
                })}
            </ol>

            <div className="space-y-4 rounded-xl border bg-white p-5">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                        Paso {step.id} de {CERTIFICATION_TOTAL_STEPS}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">{step.label}</h3>
                </div>

                {isLast ? (
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        <PartyPopper className="mt-0.5 size-5 shrink-0" />
                        <p>
                            {completedAll
                                ? step.summary
                                : "Cuando confirmes el Paso 14, la certificación quedará completada."}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm leading-relaxed text-slate-600">{step.summary}</p>
                )}

                {step.bullets && (
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                        {step.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                )}

                {step.pendingTool && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <p>
                            <strong className="font-semibold">Herramienta automática pendiente:</strong> {step.pendingTool}.
                            Por ahora completa este paso directamente en el portal de la DGII y confírmalo aquí.
                        </p>
                    </div>
                )}

                {step.actions.includes("urls") && <ReceptorUrlFields companyRnc={companyRnc} />}

                {step.actions.includes("sign") && <XmlSigner />}

                {step.actions.includes("testSet") && <TestSetRunner runType="test_set" />}

                {step.actions.includes("approvals") && <TestSetRunner runType="commercial_approval" />}

                {step.actions.includes("simulation") && <TestSetRunner runType="simulation" />}

                {step.actions.includes("portal") && (
                    <Button type="button" variant="outline" onClick={openPortal} className="w-full sm:w-auto">
                        <ExternalLink className="mr-2 size-4" /> Ir al Portal DGII
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    disabled={step.id === 1 || pending}
                    onClick={() => persist(selectStep(progress, step.id - 1))}
                >
                    <ChevronLeft className="mr-1 size-4" /> Anterior
                </Button>
                {!isLast && (
                    <Button type="button" disabled={pending} onClick={() => persist(advanceProgress(progress, step.id))}>
                        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                        {progress.completedSteps.includes(step.id) ? "Siguiente" : "Ya completé este paso"}
                        <ChevronRight className="ml-1 size-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}
