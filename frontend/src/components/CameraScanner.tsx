import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Button, Notice } from "./Panel";

export function CameraScanButton({ onDetected, label = "Escanear código", disabled = false }: { onDetected: (code: string) => void; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><Button type="button" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>{label}</Button>
    {open && <CameraScanner onClose={() => setOpen(false)} onDetected={(code) => { setOpen(false); onDetected(code); }} />}
  </>;
}

export function CameraScanner({ onClose, onDetected }: { onClose: () => void; onDetected: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onClose, onDetected });
  callbacks.current = { onClose, onDetected };
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;
    let delivered = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const stop = () => {
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
    const hide = () => { if (document.hidden) callbacks.current.onClose(); };
    document.addEventListener("visibilitychange", hide);
    setError(""); setReady(false);
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Usa una conexión HTTPS para acceder a la cámara. También puedes escribir el código manualmente.");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (cancelled) { stop(); return; }
        controls = await new BrowserMultiFormatReader().decodeFromStream(stream, video.current!, (result, _error, scanner) => {
          if (!result || cancelled || delivered) return;
          const code = result.getText().trim();
          if (!/^[A-Za-z0-9._-]{2,40}$/.test(code)) {
            delivered = true; scanner.stop(); stop();
            setError("El código leído no es un SKU válido (2 a 40 letras, números, puntos, guiones o guiones bajos). Puedes introducirlo manualmente.");
            return;
          }
          delivered = true;
          scanner.stop(); stop();
          callbacks.current.onDetected(code.toUpperCase());
        });
        if (cancelled || delivered) stop();
        else setReady(true);
      } catch (caught) {
        stop();
        if (cancelled) return;
        const name = typeof caught === "object" && caught !== null && "name" in caught ? String(caught.name) : "";
        setError(name === "NotAllowedError" ? "No se permitió el acceso a la cámara. Habilita el permiso en tu navegador o escribe el código manualmente."
          : name === "NotFoundError" ? "No encontramos una cámara en este dispositivo. Puedes escribir el código manualmente."
          : name === "NotReadableError" ? "La cámara está ocupada. Cierra otras aplicaciones que la estén usando e intenta de nuevo."
          : caught instanceof Error && name === "Error" ? caught.message : "No pudimos iniciar la cámara. Intenta de nuevo o escribe el código manualmente.");
      }
    })();
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", hide); };
  }, [attempt, facing]);

  return <Modal titleId="camera-scanner-title" onClose={onClose}>
    <div className="space-y-4">
      <h2 id="camera-scanner-title" className="text-xl font-bold">Escanear código con cámara</h2>
      <p className="text-sm text-slate-600">Apunta al código de barras de la etiqueta. Al leerlo volverás automáticamente a la prenda.</p>
      <div className="relative overflow-hidden rounded-2xl bg-slate-950">
        <video ref={video} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Vista de la cámara" />
        <div className="pointer-events-none absolute inset-x-[10%] inset-y-[28%] rounded-xl border-2 border-white/80" aria-hidden="true" />
      </div>
      {error ? <Notice>{error}</Notice> : <p role="status" className="text-sm text-slate-600">{ready ? "Buscando código… Mantén la etiqueta enfocada y con buena luz." : "Iniciando cámara…"}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        {error ? <Button type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button> : <Button type="button" variant="secondary" onClick={() => setFacing((value) => value === "environment" ? "user" : "environment")}>Cambiar cámara</Button>}
        <Button type="button" variant="secondary" onClick={onClose}>Cerrar escáner</Button>
      </div>
      <p className="text-xs text-slate-500">La imagen se procesa en tu dispositivo. No se guarda ni se envía video.</p>
    </div>
  </Modal>;
}
