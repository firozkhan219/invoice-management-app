"use client";

import { useState } from "react";

type SeriesOption = { id: string; name: string; preview: string };

/**
 * Number series + editable invoice number. The number follows the chosen series
 * until the user types their own; a typed number is used exactly as entered.
 */
export function IssueNumberFields({ series, currentNumber }: { series: SeriesOption[]; currentNumber: string | null }) {
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const [number, setNumber] = useState(currentNumber ?? series[0]?.preview ?? "");
  const [edited, setEdited] = useState(Boolean(currentNumber));
  const suggested = series.find((option) => option.id === seriesId)?.preview ?? "";

  return (
    <>
      {currentNumber ? null : (
        <div className="field">
          <label htmlFor="seriesId">Number series</label>
          <select
            id="seriesId"
            name="seriesId"
            value={seriesId}
            onChange={(event) => {
              setSeriesId(event.target.value);
              if (!edited) setNumber(series.find((option) => option.id === event.target.value)?.preview ?? "");
            }}
            required
          >
            {series.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="invoiceNumber">Invoice number</label>
        <input
          id="invoiceNumber"
          name="invoiceNumber"
          value={number}
          maxLength={60}
          pattern="[A-Za-z0-9/._\-]+"
          title="Letters, numbers, / - _ or ."
          required
          onChange={(event) => {
            setNumber(event.target.value);
            setEdited(true);
          }}
        />
        <small className="muted">
          {currentNumber
            ? "This invoice keeps its number unless you change it."
            : number === suggested
              ? "Next number in the series. You can change it."
              : `Custom number. Next in series is ${suggested}.`}
        </small>
        {!currentNumber && number !== suggested ? (
          <button className="inline-action" type="button" onClick={() => { setNumber(suggested); setEdited(false); }}>
            Use {suggested}
          </button>
        ) : null}
      </div>
    </>
  );
}
