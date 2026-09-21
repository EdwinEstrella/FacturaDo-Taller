"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, RefreshCw, X, Sparkles, CheckCircle2 } from "lucide-react";
import type { UpdateInfo, DownloadProgress } from "@/types/electron";

type UpdatePhase = "idle" | "available" | "downloading" | "ready" | "installing";

export function UpdateBanner() {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [version, setVersion] = useState<string>("");
  const [percent, setPercent] = useState<number>(0);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electron) return;

    // Consultar estado inicial
    window.electron.getUpdateState?.().then((state) => {
      if (!state) return;
      if (state.phase === "ready") {
        setPhase("ready");
        setVersion(state.downloadedVersion || state.remoteVersion || "");
      } else if (state.phase === "downloading") {
        setPhase("downloading");
        setPercent(state.percent || 0);
        setVersion(state.remoteVersion || "");
      } else if (state.phase === "available") {
        setPhase("available");
        setVersion(state.remoteVersion || "");
      }
    });

    const unsubAvailable = window.electron.onUpdateAvailable?.((info: UpdateInfo) => {
      setPhase("available");
      setVersion(info.version);
      setDismissed(false);
    });

    const unsubProgress = window.electron.onDownloadProgress?.((progress: DownloadProgress) => {
      setPhase("downloading");
      setPercent(progress.percent);
      setDismissed(false);
    });

    const unsubDownloaded = window.electron.onUpdateDownloaded?.((info: UpdateInfo) => {
      setPhase("ready");
      setVersion(info.version);
      setPercent(100);
      setDismissed(false);
    });

    return () => {
      unsubAvailable?.();
      unsubProgress?.();
      unsubDownloaded?.();
    };
  }, []);

  if (dismissed || phase === "idle") return null;

  const handleInstall = () => {
    setPhase("installing");
    if (window.electron?.installUpdate) {
      window.electron.installUpdate();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-xl p-4 flex flex-col gap-3 backdrop-blur-md bg-opacity-95">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {phase === "ready" ? (
                <Sparkles className="w-5 h-5 text-emerald-500" />
              ) : (
                <ArrowUpCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold leading-none">
                {phase === "ready"
                  ? "Actualización lista"
                  : phase === "downloading"
                  ? "Descargando versión..."
                  : "Nueva versión detectada"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {version ? `FacturaDo v${version}` : "Versión disponible"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
            title="Descartar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {phase === "downloading" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Descargando en segundo plano</span>
              <span>{percent}%</span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {phase === "ready" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              La actualización se descargó con éxito. Dale clic para instalarla y el sistema se reiniciará automáticamente.
            </p>
            <button
              type="button"
              onClick={handleInstall}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Actualizar y Reiniciar
            </button>
          </div>
        )}

        {phase === "installing" && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Instalando y reiniciando FacturaDo...</span>
          </div>
        )}
      </div>
    </div>
  );
}
