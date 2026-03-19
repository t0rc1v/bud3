"use client";

import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface UploadResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface CsvRow {
  level: string;
  subject: string;
  topic: string;
  resourceTitle: string;
  resourceDescription: string;
  resourceType: string;
  resourceUrl: string;
}

const CSV_HEADERS = [
  "level",
  "subject",
  "topic",
  "resourceTitle",
  "resourceDescription",
  "resourceType",
  "resourceUrl",
] as const;

const TEMPLATE_CSV = `level,subject,topic,resourceTitle,resourceDescription,resourceType,resourceUrl
Form 1,Mathematics,Algebra,Introduction to Algebra,Learn the basics of algebraic expressions,video,https://example.com/algebra-intro.mp4
Form 1,Mathematics,Algebra,Algebra Practice Problems,Practice problems for beginners,document,https://example.com/algebra-practice.pdf`;

/**
 * Parse a single CSV line, handling quoted fields that may contain commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): { rows: CsvRow[]; parseErrors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { rows: [], parseErrors: ["CSV must have a header row and at least one data row."] };
  }

  const headerFields = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Validate headers
  const missingHeaders = CSV_HEADERS.filter(
    (h) => !headerFields.includes(h.toLowerCase())
  );
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      parseErrors: [`Missing required columns: ${missingHeaders.join(", ")}`],
    };
  }

  // Map header positions
  const headerIndexMap: Record<string, number> = {};
  for (const h of CSV_HEADERS) {
    headerIndexMap[h] = headerFields.indexOf(h.toLowerCase());
  }

  const rows: CsvRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);

    if (fields.length < CSV_HEADERS.length) {
      parseErrors.push(`Row ${i + 1}: expected ${CSV_HEADERS.length} columns, got ${fields.length}`);
      continue;
    }

    const row: CsvRow = {
      level: fields[headerIndexMap["level"]],
      subject: fields[headerIndexMap["subject"]],
      topic: fields[headerIndexMap["topic"]],
      resourceTitle: fields[headerIndexMap["resourceTitle"]],
      resourceDescription: fields[headerIndexMap["resourceDescription"]],
      resourceType: fields[headerIndexMap["resourceType"]],
      resourceUrl: fields[headerIndexMap["resourceUrl"]],
    };

    // Basic validation
    if (!row.level || !row.subject || !row.topic || !row.resourceTitle) {
      parseErrors.push(
        `Row ${i + 1}: level, subject, topic, and resourceTitle are required`
      );
      continue;
    }

    rows.push(row);
  }

  return { rows, parseErrors };
}

export function BulkUploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setParseErrors([]);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    try {
      setIsUploading(true);
      setResult(null);
      setParseErrors([]);

      const text = await file.text();
      const { rows, parseErrors: errors } = parseCsv(text);

      if (errors.length > 0) {
        setParseErrors(errors);
        if (rows.length === 0) {
          toast.error("No valid rows found in CSV");
          return;
        }
      }

      if (rows.length === 0) {
        toast.error("No data rows found in CSV");
        return;
      }

      const res = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Upload failed");
      }

      const data: UploadResult = await res.json();
      setResult(data);

      if (data.errors.length === 0) {
        toast.success(`Successfully created ${data.created} resources`);
      } else {
        toast.warning(
          `Created ${data.created}, skipped ${data.skipped}, ${data.errors.length} error(s)`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk-upload-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setParseErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          Bulk Upload
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload resources in bulk using a CSV file
        </p>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your CSV file must include a header row with the following columns:
          </p>
          <div className="flex flex-wrap gap-2">
            {CSV_HEADERS.map((header) => (
              <Badge key={header} variant="secondary" className="font-mono text-xs">
                {header}
              </Badge>
            ))}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong>level</strong> &mdash; The education level (e.g., &quot;Form 1&quot;)
            </p>
            <p>
              <strong>subject</strong> &mdash; Subject name (e.g., &quot;Mathematics&quot;)
            </p>
            <p>
              <strong>topic</strong> &mdash; Topic name (e.g., &quot;Algebra&quot;)
            </p>
            <p>
              <strong>resourceTitle</strong> &mdash; Title of the resource
            </p>
            <p>
              <strong>resourceDescription</strong> &mdash; Brief description
            </p>
            <p>
              <strong>resourceType</strong> &mdash; Type (e.g., video, document, audio)
            </p>
            <p>
              <strong>resourceUrl</strong> &mdash; URL to the resource file
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="max-w-sm"
            />
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: <span className="font-medium">{file.name}</span> (
              {(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              CSV Parse Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {parseErrors.map((error, i) => (
                <li key={i} className="text-yellow-600 dark:text-yellow-400">
                  {error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-sm">
                  {result.created}
                </Badge>
                <span className="text-sm text-muted-foreground">created</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {result.skipped}
                </Badge>
                <span className="text-sm text-muted-foreground">skipped</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-sm">
                    {result.errors.length}
                  </Badge>
                  <span className="text-sm text-muted-foreground">errors</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Errors
                </h3>
                <div className="max-h-60 overflow-y-auto rounded border p-3 space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">
                      <span className="font-medium">Row {err.row}:</span>{" "}
                      {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleReset}>
              Upload Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
