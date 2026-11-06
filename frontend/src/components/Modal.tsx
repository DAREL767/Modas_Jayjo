import { useEffect, useRef, type PropsWithChildren } from "react";

export function Modal({ titleId, onClose, children }: PropsWithChildren<{ titleId: string; onClose: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (typeof dialog.close === "function") dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">{children}</dialog>;
}
