"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Expanded so consecutive order notifications sit one above the other instead of overlapping. */}
      <Toaster richColors position="top-center" expand visibleToasts={3} gap={8} />
    </QueryClientProvider>
  );
}
