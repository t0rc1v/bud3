"use client";

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Ban,
  MessageSquare,
} from "lucide-react";

// Types based on AI SDK
type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

type ToolUIPart<TToolName extends string = string> = {
  type: `tool-${TToolName}`;
  toolCallId: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type DynamicToolUIPart = {
  type: "dynamic-tool";
  toolCallId: string;
  toolName: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ToolPart = ToolUIPart | DynamicToolUIPart;

// Status badge configuration
const statusConfig: Record<
  ToolState,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  "input-streaming": {
    label: "Pending",
    variant: "outline",
    icon: <Clock className="h-3 w-3" />,
  },
  "input-available": {
    label: "Running",
    variant: "default",
    icon: <Play className="h-3 w-3" />,
  },
  "approval-requested": {
    label: "Awaiting Approval",
    variant: "secondary",
    icon: <MessageSquare className="h-3 w-3" />,
  },
  "approval-responded": {
    label: "Responded",
    variant: "secondary",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  "output-available": {
    label: "Completed",
    variant: "outline",
    icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
  },
  "output-error": {
    label: "Error",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
  "output-denied": {
    label: "Denied",
    variant: "destructive",
    icon: <Ban className="h-3 w-3" />,
  },
};

// Utility function to get status badge
function getStatusBadge(state: ToolState) {
  const config = statusConfig[state];
  return (
    <Badge variant={config.variant} className="gap-1 text-[10px] h-5">
      {state === "input-available" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        config.icon
      )}
      {config.label}
    </Badge>
  );
}

// Format tool name for display
function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// Tool component
interface ToolProps extends React.ComponentProps<typeof Collapsible> {
  defaultOpen?: boolean;
}

function Tool({ defaultOpen, children, ...props }: ToolProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} {...props}>
      {children}
    </Collapsible>
  );
}

// Tool Header component
interface ToolHeaderProps extends Omit<React.ComponentProps<typeof CollapsibleTrigger>, 'type'> {
  toolType: ToolPart["type"];
  state: ToolState;
  title?: string;
  toolName?: string;
}

function ToolHeader({
  toolType,
  state,
  title,
  toolName,
  className,
  children,
  ...props
}: ToolHeaderProps) {
  const displayName = title || formatToolName(
    toolType === "dynamic-tool" ? toolName || "Tool" : toolType.replace("tool-", "")
  );

  return (
    <CollapsibleTrigger
      className={cn(
        "flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
          <ChevronRight className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-[10px] text-muted-foreground">
            {toolType === "dynamic-tool" ? toolName : toolType.replace("tool-", "")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(state)}
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
      </div>
    </CollapsibleTrigger>
  );
}

// Tool Content component
interface ToolContentProps extends React.ComponentProps<typeof CollapsibleContent> {}

function ToolContent({ className, children, ...props }: ToolContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      {...props}
    >
      <div className="p-3 pt-0 space-y-2">{children}</div>
    </CollapsibleContent>
  );
}

// Tool Input component
interface ToolInputProps extends React.HTMLAttributes<HTMLDivElement> {
  input?: unknown;
}

function ToolInput({ input, className, ...props }: ToolInputProps) {
  if (!input) return null;

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Input
      </span>
      <div className="bg-background/80 rounded-md p-2 text-xs font-mono overflow-x-auto">
        <pre className="whitespace-pre-wrap break-all">
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Tool Output component
interface ToolOutputProps extends React.HTMLAttributes<HTMLDivElement> {
  output?: React.ReactNode;
  errorText?: string;
}

function ToolOutput({ output, errorText, className, ...props }: ToolOutputProps) {
  if (!output && !errorText) return null;

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {errorText ? "Error" : "Output"}
      </span>
      {errorText ? (
        <div className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
          {errorText}
        </div>
      ) : (
        <div className="bg-background/80 rounded-md p-2 text-sm">
          {typeof output === "string" ? (
            <div className="whitespace-pre-wrap">{output}</div>
          ) : (
            output
          )}
        </div>
      )}
    </div>
  );
}

// Helper component to render search results (specific to this codebase)
interface SearchResultsOutputProps {
  results: Array<{ title?: string; url?: string; description?: string }>;
  maxDisplay?: number;
}

function SearchResultsOutput({ results, maxDisplay = 3 }: SearchResultsOutputProps) {
  if (!results || results.length === 0) return null;

  const displayResults = results.slice(0, maxDisplay);
  const remaining = results.length - maxDisplay;

  return (
    <div className="space-y-1">
      {displayResults.map((result, idx) => (
        <div key={idx} className="flex flex-col gap-0.5">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary hover:underline truncate"
          >
            {result.title || "Untitled"}
          </a>
          {result.description && (
            <span className="text-[10px] text-muted-foreground line-clamp-1">
              {result.description}
            </span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-[10px] text-muted-foreground italic">
          +{remaining} more results
        </div>
      )}
    </div>
  );
}

// Type exports
export type { ToolState, ToolUIPart, DynamicToolUIPart, ToolPart };

// Component exports
export {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  SearchResultsOutput,
  getStatusBadge,
  formatToolName,
};
