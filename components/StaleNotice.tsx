"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";

/** The HTTP status of a failed query; ApiClientError carries it. */
export function errorStatus(error: unknown) {
  return (error as { status?: number } | null | undefined)?.status;
}

/**
 * Access tokens last 15 minutes with no refresh, so a page left open ends in a 401. Sends the
 * user to log in and come back here. Returns whether a redirect is under way.
 */
export function useLoginOnUnauthorized(error: unknown) {
  const router = useRouter();
  const unauthorized = errorStatus(error) === 401;

  useEffect(() => {
    if (!unauthorized) return;
    const { pathname, search } = window.location;
    router.replace(`/login?next=${encodeURIComponent(`${pathname}${search}`)}`);
  }, [unauthorized, router]);

  return unauthorized;
}

/** Shown above data that is still on screen after a background refresh failed. */
export function StaleNotice() {
  return (
    <p role="status" className="flex items-center gap-2 rounded-2xl bg-pink-soft px-4 py-2.5 text-[13px]">
      <CloudOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      ข้อมูลอาจไม่เป็นปัจจุบัน ระบบกำลังลองเชื่อมต่อใหม่
    </p>
  );
}
