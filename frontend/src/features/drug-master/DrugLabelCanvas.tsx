"use client";

import { QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DrugLabelDataKey, DrugLabelElement, DrugLabelTemplate } from "@/lib/drug-label-api";
import { cn } from "@/lib/utils";

type PointerMode = "move" | "resize";

export function DrugLabelCanvas({ template, data, selectedId, interactive = false, onSelect, onElementChange }: {
  template: DrugLabelTemplate;
  data: Partial<Record<DrugLabelDataKey, string>>;
  selectedId?: string | null;
  interactive?: boolean;
  onSelect?: (id: string) => void;
  onElementChange?: (element: DrugLabelElement) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<{
    mode: PointerMode;
    id: string;
    startX: number;
    startY: number;
    original: DrugLabelElement;
  } | null>(null);

  useEffect(() => {
    if (!gesture || !interactive || !onElementChange) return;
    const move = (event: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (event.clientX - gesture.startX) * template.WIDTH_MM / rect.width;
      const dy = (event.clientY - gesture.startY) * template.HEIGHT_MM / rect.height;
      const original = gesture.original;
      if (gesture.mode === "move") {
        onElementChange({
          ...original,
          xMm: round(clamp(original.xMm + dx, 0, template.WIDTH_MM - original.widthMm)),
          yMm: round(clamp(original.yMm + dy, 0, template.HEIGHT_MM - original.heightMm)),
        });
      } else {
        onElementChange({
          ...original,
          widthMm: round(clamp(original.widthMm + dx, 2, template.WIDTH_MM - original.xMm)),
          heightMm: round(clamp(original.heightMm + dy, 2, template.HEIGHT_MM - original.yMm)),
        });
      }
    };
    const end = () => setGesture(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, [gesture, interactive, onElementChange, template.HEIGHT_MM, template.WIDTH_MM]);

  return (
    <div
      className="relative mx-auto select-none overflow-hidden bg-white shadow-[0_18px_55px_rgba(15,31,61,0.18)]"
      ref={canvasRef}
      style={{ aspectRatio: `${template.WIDTH_MM}/${template.HEIGHT_MM}`, containerType: "inline-size", fontFamily: "Sarabun, sans-serif", width: "min(100%, 940px)" }}
    >
      {[...template.DEFINITION.elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => {
        const selected = selectedId === element.id;
        const value = element.type === "text"
          ? element.text?.trim() || "—"
          : element.dataKey ? (data[element.dataKey]?.trim() || "—") : "";
        const text = `${element.prefix ?? ""}${value}${element.suffix ?? ""}`;
        const style = {
          left: `${element.xMm / template.WIDTH_MM * 100}%`,
          top: `${element.yMm / template.HEIGHT_MM * 100}%`,
          width: `${element.widthMm / template.WIDTH_MM * 100}%`,
          height: `${element.heightMm / template.HEIGHT_MM * 100}%`,
          zIndex: element.zIndex,
          color: element.color ?? "#111827",
          backgroundColor: element.backgroundColor ?? "transparent",
          borderColor: element.borderColor ?? "transparent",
          borderWidth: `${Math.max(0, element.borderWidth ?? 0) / template.WIDTH_MM * 100}cqw`,
          borderStyle: element.lineStyle ?? "solid",
          borderRadius: `${(element.borderRadiusMm ?? 0) / template.WIDTH_MM * 100}cqw`,
        };
        return (
          <div
            className={cn("absolute box-border overflow-hidden", interactive && "cursor-move", selected && "outline outline-2 outline-offset-1 outline-blue-500")}
            key={element.id}
            onPointerDown={(event) => {
              if (!interactive) return;
              event.preventDefault();
              onSelect?.(element.id);
              setGesture({ mode: "move", id: element.id, startX: event.clientX, startY: event.clientY, original: element });
            }}
            style={style}
          >
            {element.type === "logo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="โลโก้โรงพยาบาล" className="h-full w-full" draggable={false} src={template.LOGO_DATA_URL.startsWith("data:") ? template.LOGO_DATA_URL : (element.imageSrc ?? template.LOGO_DATA_URL) || "/assets/juraporn-hospital-emblem.png"} style={{ objectFit: element.fit ?? "contain" }} />
            ) : element.type === "qr" ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-white text-slate-950"><QrCode className="h-[78%] w-[78%]" strokeWidth={1.5} /><span className="text-[7px] font-semibold">QR</span></div>
            ) : element.type === "line" ? (
              <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-current" />
            ) : element.type === "box" ? null : (
              <div
                className="flex h-full w-full whitespace-pre-wrap leading-[1.16]"
                style={{
                  alignItems: element.textAlign === "center" ? "center" : "flex-start",
                  fontFamily: "Sarabun, sans-serif",
                  fontSize: `${Math.max(6, element.fontSizePt ?? 10) * 0.352778 / template.WIDTH_MM * 100}cqw`,
                  fontWeight: element.fontWeight ?? 400,
                  justifyContent: element.textAlign === "right" ? "flex-end" : element.textAlign === "center" ? "center" : "flex-start",
                  textAlign: element.textAlign ?? "left",
                }}
              >{text}</div>
            )}
            {interactive && selected ? (
              <button
                aria-label="ปรับขนาด element"
                className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-white bg-blue-600 shadow"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setGesture({ mode: "resize", id: element.id, startX: event.clientX, startY: event.clientY, original: element });
                }}
                type="button"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
