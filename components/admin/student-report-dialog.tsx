"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentReportView, type ReportData } from "@/components/admin/student-report-view";
import { toast } from "sonner";

interface StudentReportDialogProps {
  studentEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentReportDialog({ studentEmail, open, onOpenChange }: StudentReportDialogProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && studentEmail) {
      setIsLoading(true);
      setReport(null);
      fetch(`/api/admin/ai/student/_/report?email=${encodeURIComponent(studentEmail)}`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((d) => setReport(d.report ?? d))
        .catch(() => toast.error("Failed to load learner report"))
        .finally(() => setIsLoading(false));
    }
  }, [open, studentEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Learner Report
          </DialogTitle>
        </DialogHeader>
        <StudentReportView report={report} isLoading={isLoading} />
      </DialogContent>
    </Dialog>
  );
}
