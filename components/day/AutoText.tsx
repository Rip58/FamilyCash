"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

interface AutoTextProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/** Campo de texto con guardado automático (debounce 600 ms, y al salir). */
export function AutoText({ label, value, onSave, multiline, placeholder, maxLength = 500, className }: AutoTextProps) {
  const id = useId();
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(value);
  const latest = useRef({ text: value, onSave });

  useEffect(() => {
    latest.current = { text, onSave };
  });

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { text: t, onSave: save } = latest.current;
    if (t !== saved.current) {
      saved.current = t;
      save(t);
    }
  };

  // Guarda lo pendiente al desmontar.
  useEffect(() => {
    return () => flush();
  }, []);

  const onChange = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const cls =
    "w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={text}
          rows={3}
          placeholder={placeholder}
          maxLength={maxLength}
          onBlur={() => flush()}
          onChange={(e) => onChange(e.target.value)}
          className={cn(cls, "py-2.5", className)}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={text}
          placeholder={placeholder}
          maxLength={maxLength}
          onBlur={() => flush()}
          onChange={(e) => onChange(e.target.value)}
          className={cn(cls, "min-h-11", className)}
        />
      )}
    </div>
  );
}
