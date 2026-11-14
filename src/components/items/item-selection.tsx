"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

export const BULK_ITEMS_FORM_ID = "bulk-items-form";
const selectionEvent = "items-selection-change";

function rowBoxes(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="itemIds"][form="${BULK_ITEMS_FORM_ID}"]`)
  );
}

function subscribe(callback: () => void) {
  document.addEventListener("change", callback);
  window.addEventListener(selectionEvent, callback);
  return () => {
    document.removeEventListener("change", callback);
    window.removeEventListener(selectionEvent, callback);
  };
}

// A string snapshot keeps useSyncExternalStore stable between renders.
function snapshot(): string {
  const boxes = rowBoxes();
  return `${boxes.filter((box) => box.checked).length}/${boxes.length}`;
}

function useSelection() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "0/0");
  const [checked, total] = value.split("/").map(Number);
  return { checked, total };
}

export function SelectAllItemsCheckbox() {
  const { checked, total } = useSelection();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = checked > 0 && checked < total;
  }, [checked, total]);

  return (
    <input
      ref={ref}
      aria-label="Select all products"
      type="checkbox"
      checked={total > 0 && checked === total}
      disabled={total === 0}
      onChange={(event) => {
        const next = event.target.checked;
        rowBoxes().forEach((box) => { box.checked = next; });
        window.dispatchEvent(new Event(selectionEvent));
      }}
    />
  );
}

export function DeleteSelectedButton() {
  const { checked } = useSelection();

  return (
    <button
      className="button subtle"
      type="submit"
      form={BULK_ITEMS_FORM_ID}
      disabled={checked === 0}
      onClick={(event) => {
        const message = `Delete ${checked} selected product${checked === 1 ? "" : "s"}? Products already used on invoices will be marked inactive instead.`;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <Trash2 size={16} /> Delete Selected{checked ? ` (${checked})` : ""}
    </button>
  );
}
