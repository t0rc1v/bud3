import { exa } from "./exa-client";

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  status: "success" | "error";
  error?: string;
}

export interface BrowseOptions {
  maxCharacters?: number;
}

/**
 * Browse a URL using Exa AI to extract content.
 * This works for web pages, PDFs, and other document types.
 * Exa handles PDF extraction internally.
 */
export async function browseUrl(
  url: string,
  options: BrowseOptions = {}
): Promise<BrowseResult> {
  const {
    maxCharacters = 10000,
  } = options;

  try {
    // Use Exa's getContents to fetch the URL content
    // This handles PDFs, web pages, and other documents automatically
    const result = await exa.getContents([url], {
      text: {
        maxCharacters,
        verbosity: "standard",
      },
      maxAgeHours: -1, // Use cache when available
    });

    // Check if we got results
    if (!result.results || result.results.length === 0) {
      // Check for error status in the response
      const response = result as unknown as {
        statuses?: Array<{ id: string; status: string; error?: { tag: string } }>;
      };
      
      if (response.statuses && response.statuses.length > 0) {
        const status = response.statuses[0];
        if (status.status === "error" && status.error) {
          return {
            url,
            title: "",
            content: "",
            status: "error",
            error: `Failed to fetch content: ${status.error.tag}`,
          };
        }
      }

      return {
        url,
        title: "",
        content: "",
        status: "error",
        error: "No content found for this URL",
      };
    }

    const page = result.results[0];
    
    // Access text from the result - the type definition may vary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageAny = page as any;
    
    return {
      url,
      title: page.title || "Untitled",
      content: pageAny.text || "",
      status: "success",
    };
  } catch (error) {
    console.error(`Error browsing URL ${url}:`, error);
    return {
      url,
      title: "",
      content: "",
      status: "error",
      error: `Failed to browse URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Browse multiple URLs at once.
 */
export async function browseMultipleUrls(
  urls: string[],
  options: BrowseOptions = {}
): Promise<BrowseResult[]> {
  const results = await Promise.all(
    urls.map((url) => browseUrl(url, options))
  );
  return results;
}

/**
 * Format browse results for use in AI context.
 */
export function formatBrowseResultForAI(result: BrowseResult): string {
  if (result.status === "error") {
    return `[Failed to access ${result.url}: ${result.error}]`;
  }

  return `Title: ${result.title}
URL: ${result.url}

Content:
${result.content}`;
}
