import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

export default function ChartFrame({ className, fallback, children, zebra = false }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const ready = size.width > 0 && size.height > 0;

  return (
    <div ref={containerRef} className={cn("relative h-full w-full min-w-0 overflow-hidden rounded-[10px]", className)}>
      {ready ? (
        <>
          {zebra ? (
            <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-[repeating-linear-gradient(180deg,rgba(26,43,107,0.035)_0px,rgba(26,43,107,0.035)_52px,transparent_52px,transparent_104px)]" />
          ) : null}
          <div className="relative h-full w-full min-w-0">{children(size)}</div>
        </>
      ) : (
        fallback || (
          <div className="flex h-full items-center justify-center rounded-[10px] border border-dashed border-[rgba(26,43,107,0.14)] bg-[var(--surface-3)] text-sm text-[var(--txt3)]">
            Preparando visual...
          </div>
        )
      )}
    </div>
  );
}
