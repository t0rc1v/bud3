"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isAssistant?: boolean;
}

export function MarkdownRenderer({ content, className, isAssistant = true }: MarkdownRendererProps) {
  return (
    <div className={cn(
      "markdown-content prose prose-sm max-w-none",
      isAssistant ? "prose-slate" : "prose-invert",
      className
    )}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{
        // Override paragraph to ensure proper spacing
        p: ({ children, ...props }) => (
          <p {...props} className="mb-2 last:mb-0">
            {children}
          </p>
        ),
        // Override code blocks for better styling
        pre: ({ children, ...props }) => (
          <pre
            {...props}
            className="bg-muted/50 rounded-md p-3 overflow-x-auto text-xs my-2"
          >
            {children}
          </pre>
        ),
        code: ({ children, className, ...props }) => {
          const isInline = !className?.includes("language-");
          return isInline ? (
            <code
              {...props}
              className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono"
            >
              {children}
            </code>
          ) : (
            <code {...props} className={className}>
              {children}
            </code>
          );
        },
        // Style lists
        ul: ({ children, ...props }) => (
          <ul {...props} className="list-disc pl-4 mb-2 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol {...props} className="list-decimal pl-4 mb-2 space-y-1">
            {children}
          </ol>
        ),
        // Style headings
        h1: ({ children, ...props }) => (
          <h1 {...props} className="text-lg font-semibold mb-2 mt-4">
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 {...props} className="text-base font-semibold mb-2 mt-3">
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 {...props} className="text-sm font-semibold mb-1.5 mt-2.5">
            {children}
          </h3>
        ),
        // Style links
        a: ({ children, ...props }) => (
          <a
            {...props}
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Style blockquotes
        blockquote: ({ children, ...props }) => (
          <blockquote
            {...props}
            className="border-l-2 border-primary/50 pl-3 my-2 italic text-muted-foreground"
          >
            {children}
          </blockquote>
        ),
        // Style tables
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto my-2">
            <table {...props} className="min-w-full text-xs">
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }) => (
          <thead {...props} className="bg-muted/50">
            {children}
          </thead>
        ),
        th: ({ children, ...props }) => (
          <th {...props} className="px-2 py-1 text-left font-semibold border-b">
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td {...props} className="px-2 py-1 border-b border-muted">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
