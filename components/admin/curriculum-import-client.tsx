"use client";

import { useState, useEffect } from "react";
import { BookCopy, Plus, Check, Eye, Loader2, HelpCircle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

interface CurriculumImport {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface ImportDetail {
  id: string;
  title: string;
  status: string;
  data: unknown;
  createdAt: string;
  levels?: number;
  subjects?: number;
  topics?: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  approved: "bg-green-500/15 text-green-700 dark:text-green-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function CurriculumImportClient() {
  const [imports, setImports] = useState<CurriculumImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newData, setNewData] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchImports = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/ai/curriculum/imports");
      if (res.ok) {
        const data = await res.json();
        setImports(data.imports ?? []);
      }
    } catch {
      toast.error("Failed to load imports");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImports();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newData.trim()) return;
    setIsSubmitting(true);
    try {
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(newData);
      } catch {
        parsedData = newData;
      }
      const res = await fetch("/api/ai/curriculum/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, data: parsedData }),
      });
      if (!res.ok) throw new Error();
      toast.success("Import submitted");
      setShowNewDialog(false);
      setNewTitle("");
      setNewData("");
      fetchImports();
    } catch {
      toast.error("Failed to create import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    setShowDetailDialog(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/ai/curriculum/import/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data.import ?? data);
    } catch {
      toast.error("Failed to load import details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/ai/curriculum/import/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Import approved");
      fetchImports();
      if (detail?.id === id) {
        setDetail({ ...detail, status: "approved" });
      }
    } catch {
      toast.error("Failed to approve import");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookCopy className="h-6 w-6" />
            Curriculum Import
          </h1>
          <p className="text-muted-foreground mt-1">Import and manage curriculum data</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Import
        </Button>
      </div>

      {/* Getting Started Guide */}
      <CurriculumImportGuide />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : imports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookCopy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No imports yet</p>
            <p className="text-sm text-muted-foreground">Create a new import to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map((imp) => (
            <Card key={imp.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{imp.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={STATUS_COLORS[imp.status] ?? ""}>
                      {imp.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(imp.id)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {imp.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(imp.id)}
                      disabled={approvingId === imp.id}
                    >
                      {approvingId === imp.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Curriculum Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                placeholder="e.g., KCSE 2025 Curriculum"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Curriculum Data (JSON or text)</label>
              <Textarea
                placeholder='{"levels": [...], "subjects": [...]}'
                value={newData}
                onChange={(e) => setNewData(e.target.value)}
                rows={8}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !newTitle.trim() || !newData.trim()}
              className="w-full"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Submit Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground text-center py-8">No details available</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{detail.title}</h3>
                <Badge className={STATUS_COLORS[detail.status] ?? ""}>{detail.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Created: {new Date(detail.createdAt).toLocaleString()}
              </p>
              {(detail.levels !== undefined || detail.subjects !== undefined || detail.topics !== undefined) && (
                <div className="flex gap-3 text-sm">
                  {detail.levels !== undefined && <span>{detail.levels} levels</span>}
                  {detail.subjects !== undefined && <span>{detail.subjects} subjects</span>}
                  {detail.topics !== undefined && <span>{detail.topics} topics</span>}
                </div>
              )}
              {detail.data != null && (
                <div>
                  <p className="text-xs font-medium mb-1">Data Preview:</p>
                  <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-48">
                    {typeof detail.data === "string" ? detail.data : JSON.stringify(detail.data, null, 2)}
                  </pre>
                </div>
              )}
              {detail.status === "pending" && (
                <Button
                  className="w-full"
                  onClick={() => handleApprove(detail.id)}
                  disabled={approvingId === detail.id}
                >
                  {approvingId === detail.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve Import
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Getting Started Guide (collapsible) ─────────────────────── */

function CurriculumImportGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                How to Import a Curriculum
              </CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0">
            {/* Overview */}
            <p className="text-sm text-muted-foreground">
              Curriculum Import lets you add your school&apos;s entire syllabus structure (levels, subjects, and topics)
              in one go instead of creating each item manually. Follow the steps below.
            </p>

            {/* Step-by-step */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <div>
                  <p className="text-sm font-medium">Prepare your data</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Organise your curriculum into <strong>levels</strong> (e.g., Form 1, Grade 4),
                    each containing <strong>subjects</strong> (e.g., Mathematics, English), and each
                    subject containing <strong>topics</strong> (e.g., Algebra, Comprehension).
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <div>
                  <p className="text-sm font-medium">Format it as JSON</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Paste the data in the text box using the JSON format shown in the example below.
                    If you&apos;re unsure about JSON, ask a colleague or use any free &quot;text to JSON&quot;
                    tool online.
                  </p>
                  <pre className="mt-2 text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-52 whitespace-pre-wrap">
{`{
  "levels": [
    {
      "name": "Form 1",
      "subjects": [
        {
          "name": "Mathematics",
          "topics": [
            { "name": "Algebra" },
            { "name": "Geometry" }
          ]
        },
        {
          "name": "English",
          "topics": [
            { "name": "Comprehension" },
            { "name": "Grammar" }
          ]
        }
      ]
    }
  ]
}`}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <div>
                  <p className="text-sm font-medium">Click &quot;New Import&quot;</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Give your import a descriptive title (e.g., &quot;KCSE 2025 Curriculum&quot;), paste
                    your data, and click <strong>Submit Import</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <div>
                  <p className="text-sm font-medium">Review &amp; Approve</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your import will appear with a <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 text-[10px] px-1.5 py-0 mx-0.5">pending</Badge> status.
                    Click <strong>View</strong> to inspect the data, then click <strong>Approve</strong> to
                    apply it. Approved imports will create the levels, subjects, and topics in the
                    system automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Tips</p>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>You can also paste plain text — the system will try to parse it, but JSON works best.</li>
                <li>Double-check spelling before approving; corrections require manual editing later.</li>
                <li>Large curricula (100+ topics) work fine — there is no size limit.</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
