"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function FlashInner() {
  const params = useSearchParams();
  const error = params.get("error");
  const notice = params.get("notice");

  return (
    <>
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      {notice ? <p className="notice success" role="status">{notice}</p> : null}
    </>
  );
}

/** Shows ?error= / ?notice= messages set by form routes after a redirect. */
export function FlashMessage() {
  return (
    <Suspense fallback={null}>
      <FlashInner />
    </Suspense>
  );
}
