"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A <details> popup that behaves like a proper dialog: a close (X) button, Esc and a click outside
 * close it, opening one closes any other, and `id` lets a link like href="#add-item" open it.
 * Any element inside with data-popover-close also closes it.
 */
export function PopoverDetails({
  id,
  className,
  summary,
  summaryClassName,
  summaryTitle,
  panelClassName,
  showClose = true,
  children
}: {
  id?: string;
  className: string;
  summary: ReactNode;
  summaryClassName?: string;
  summaryTitle?: string;
  panelClassName: string;
  showClose?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    const onToggle = () => {
      if (!details.open) return;
      // Only one popup at a time.
      document.querySelectorAll<HTMLDetailsElement>("details[data-popover][open]").forEach((other) => {
        if (other !== details) other.open = false;
      });
      details.querySelector<HTMLElement>("[data-popover-panel] input:not([type=hidden]), [data-popover-panel] select, [data-popover-panel] textarea")?.focus({ preventScroll: true });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.open) {
        close();
        details.querySelector<HTMLElement>("summary")?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!details.open) return;
      const target = event.target as Node;
      const panel = details.querySelector("[data-popover-panel]");
      const summaryEl = details.querySelector("summary");
      if (panel?.contains(target) || summaryEl?.contains(target)) return;
      close();
    };
    const openFromHash = () => {
      if (id && window.location.hash === `#${id}`) {
        details.open = true;
        details.scrollIntoView({ block: "nearest" });
      }
    };

    // A link like href="#add-item" opens it even when the address already ends in that hash.
    const onLinkClick = (event: MouseEvent) => {
      if (!id) return;
      const link = (event.target as HTMLElement | null)?.closest?.(`a[href="#${id}"]`);
      if (!link) return;
      event.preventDefault();
      details.open = true;
      details.scrollIntoView({ block: "nearest" });
    };

    details.addEventListener("toggle", onToggle);
    document.addEventListener("click", onLinkClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    return () => {
      details.removeEventListener("toggle", onToggle);
      document.removeEventListener("click", onLinkClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [close, id]);

  return (
    <details ref={ref} id={id} className={className} data-popover="">
      <summary className={summaryClassName} title={summaryTitle}>{summary}</summary>
      <div
        className={panelClassName}
        data-popover-panel=""
        role="dialog"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-popover-close]")) close();
        }}
      >
        {showClose ? (
          <button type="button" className="popover-close" aria-label="Close" title="Close (Esc)" onClick={close}>
            <X size={18} />
          </button>
        ) : null}
        {children}
      </div>
    </details>
  );
}
