import { db } from "@/lib/db";
import { resource, topic, subject } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { extractResourceText } from "./extract-text";

const DEFAULT_BUDGET = 100_000;
const CONCURRENCY_LIMIT = 3;

interface BatchContextResult {
  context: string;
  includedFull: string[];
  includedSummaryOnly: string[];
  totalResources: number;
}

/**
 * Builds a concatenated text context from multiple resources, respecting a total character budget.
 * Resources that fit get full text; the rest get summary headers only.
 */
export async function buildBatchResourceContext(
  resourceIds: string[],
  budget: number = DEFAULT_BUDGET
): Promise<BatchContextResult> {
  if (resourceIds.length === 0) {
    return { context: "", includedFull: [], includedSummaryOnly: [], totalResources: 0 };
  }

  // Fetch resource metadata in one query
  const resources = await db
    .select({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      topicTitle: topic.title,
      subjectName: subject.name,
    })
    .from(resource)
    .leftJoin(topic, eq(resource.topicId, topic.id))
    .leftJoin(subject, eq(resource.subjectId, subject.id))
    .where(inArray(resource.id, resourceIds));

  // Extract text with concurrency limit
  const extractions = new Map<string, { text: string; charCount: number }>();

  for (let i = 0; i < resources.length; i += CONCURRENCY_LIMIT) {
    const batch = resources.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      batch.map(async (r) => {
        const result = await extractResourceText(r.id);
        return { id: r.id, text: result.text, charCount: result.charCount };
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        extractions.set(result.value.id, {
          text: result.value.text,
          charCount: result.value.charCount,
        });
      }
    }
  }

  // Build context respecting budget
  let usedChars = 0;
  const includedFull: string[] = [];
  const includedSummaryOnly: string[] = [];
  const parts: string[] = [];

  for (const r of resources) {
    const extraction = extractions.get(r.id);
    const header = `--- Resource: ${r.title} (${r.type}) | Topic: ${r.topicTitle || "N/A"} | Subject: ${r.subjectName || "N/A"} ---`;

    if (extraction && usedChars + header.length + extraction.charCount + 2 <= budget) {
      parts.push(`${header}\n${extraction.text}`);
      usedChars += header.length + extraction.charCount + 2;
      includedFull.push(r.id);
    } else {
      // Summary only
      const summary = `${header}\nDescription: ${r.description?.slice(0, 200) || "No description"}`;
      parts.push(summary);
      usedChars += summary.length + 1;
      includedSummaryOnly.push(r.id);
    }
  }

  return {
    context: parts.join("\n\n"),
    includedFull,
    includedSummaryOnly,
    totalResources: resources.length,
  };
}
