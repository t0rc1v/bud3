"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          An error occurred while loading this page.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/super-admin")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
