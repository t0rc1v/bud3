import { db } from "@/lib/db";
import { resource } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MAX_EXTRACTED_CHARS = 200_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ExtractionResult {
  text: string;
  charCount: number;
  extractedFrom: "pdf-parse" | "metadata_only";
  truncated: boolean;
}

interface ResourceMetadata {
  extractedText?: string;
  extractedAt?: string;
  extractedCharCount?: number;
  extractionMethod?: string;
  [key: string]: unknown;
}

/**
 * Extracts text content from a resource, with caching in resource.metadata.
 * For PDF (notes): uses pdf-parse to extract text.
 * For video/audio/image: returns metadata-only description.
 */
export async function extractResourceText(
  resourceId: string
): Promise<ExtractionResult> {
  const [res] = await db
    .select()
    .from(resource)
    .where(eq(resource.id, resourceId))
    .limit(1);

  if (!res) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  const metadata = (res.metadata as ResourceMetadata) || {};

  // Check cache
  if (metadata.extractedText && metadata.extractedAt) {
    const cacheAge = Date.now() - new Date(metadata.extractedAt).getTime();
    if (cacheAge < CACHE_TTL_MS) {
      return {
        text: metadata.extractedText,
        charCount: metadata.extractedCharCount || metadata.extractedText.length,
        extractedFrom: (metadata.extractionMethod as "pdf-parse" | "metadata_only") || "metadata_only",
        truncated: (metadata.extractedCharCount || 0) > MAX_EXTRACTED_CHARS,
      };
    }
  }

  // For non-PDF types, return metadata only
  if (res.type !== "notes") {
    const metadataText = [
      `Title: ${res.title}`,
      `Type: ${res.type}`,
      `Description: ${res.description}`,
      metadata.duration ? `Duration: ${metadata.duration}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await writeExtractedTextToMetadata(resourceId, metadata, metadataText, "metadata_only");

    return {
      text: metadataText,
      charCount: metadataText.length,
      extractedFrom: "metadata_only",
      truncated: false,
    };
  }

  // PDF extraction
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ url: res.url });
    const parsed = await parser.getText();

    let text = parsed.text || "";
    const truncated = text.length > MAX_EXTRACTED_CHARS;
    if (truncated) {
      text = text.slice(0, MAX_EXTRACTED_CHARS);
    }

    await writeExtractedTextToMetadata(resourceId, metadata, text, "pdf-parse");

    return {
      text,
      charCount: text.length,
      extractedFrom: "pdf-parse",
      truncated,
    };
  } catch (error) {
    console.error(`[extract-text] PDF extraction failed for ${resourceId}:`, error);
    // Fallback to description
    const fallback = res.description || "No content available.";
    return {
      text: fallback,
      charCount: fallback.length,
      extractedFrom: "metadata_only",
      truncated: false,
    };
  }
}

async function writeExtractedTextToMetadata(
  resourceId: string,
  existingMetadata: ResourceMetadata,
  text: string,
  method: string
): Promise<void> {
  try {
    await db
      .update(resource)
      .set({
        metadata: {
          ...existingMetadata,
          extractedText: text,
          extractedAt: new Date().toISOString(),
          extractedCharCount: text.length,
          extractionMethod: method,
        },
        updatedAt: new Date(),
      })
      .where(eq(resource.id, resourceId));
  } catch (error) {
    console.error(`[extract-text] Failed to write cache for ${resourceId}:`, error);
  }
}
