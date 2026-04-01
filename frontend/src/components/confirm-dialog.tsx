"use client";

import { useEffect } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: "danger" | "neutral";
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  variant = "danger",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-red-600 shadow-lg shadow-red-950/30 hover:bg-red-500 focus-visible:ring-red-400/50"
      : "bg-indigo-600 shadow-lg shadow-indigo-950/30 hover:bg-indigo-500 focus-visible:ring-indigo-400/50";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="confirm-dialog-backdrop absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        aria-hidden
        tabIndex={-1}
        disabled={loading}
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div
        className="confirm-dialog-panel relative z-10 w-full max-w-md rounded-2xl border border-white/12 bg-slate-950/95 p-6 shadow-2xl shadow-black/60 ring-1 ring-white/5"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold tracking-tight text-white"
        >
          {title}
        </h2>
        {description ? (
          <p
            id="confirm-dialog-desc"
            className="mt-2 text-sm leading-relaxed text-slate-400"
          >
            {description}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${confirmClasses}`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
