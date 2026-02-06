import { exa } from "./exa-client";

// Exa search result type - matches the SDK return type structure
interface ExaSearchResult {
  title: string | null;
  url: string;
  highlights?: string[];
  text?: string;
  image?: string;
  publishedDate?: string;
  author?: string | null;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
  score?: number;
}

export interface YouTubeSearchResult {
  title: string;
  url: string;
  snippet: string;
  thumbnail?: string;
  publishedDate?: string;
}

export interface ResearchMaterial {
  title: string;
  url: string;
  type: "video" | "article" | "pdf" | "other";
  snippet: string;
  source: string;
}

/**
 * Search the web using Exa AI
 */
export async function searchWeb(
  query: string,
  options: {
    numResults?: number;
    type?: "neural" | "auto" | "fast" | "deep";
    category?: "company" | "research paper" | "news" | "tweet" | "personal site" | "financial report" | "people";
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<WebSearchResult[]> {
  const {
    numResults = 10,
    type = "auto",
    category,
    includeDomains,
    excludeDomains,
  } = options;

  try {
    const searchOptions = {
      type,
      numResults,
      contents: {
        text: {
          maxCharacters: 1000,
          verbosity: "standard" as const,
        },
        highlights: {
          maxCharacters: 500,
          query: "Key information",
        },
      },
      ...(category && { category }),
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await exa.search(query, searchOptions as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (results.results as any[]).map((result: ExaSearchResult) => ({
      title: result.title || "Untitled",
      url: result.url,
      snippet:
        result.highlights?.[0] ||
        (result as unknown as { text?: string }).text ||
        "",
      publishedDate: result.publishedDate,
      author: result.author || undefined,
    }));
  } catch (error) {
    console.error("Web search error:", error);
    throw new Error(
      `Failed to search web: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Search YouTube using Exa AI with domain filtering
 */
export async function searchYouTube(
  query: string,
  options: {
    numResults?: number;
    type?: "neural" | "auto" | "fast" | "deep";
  } = {}
): Promise<YouTubeSearchResult[]> {
  const { numResults = 10, type = "auto" } = options;

  try {
    const searchOptions = {
      type,
      numResults,
      includeDomains: ["youtube.com", "youtu.be"] as string[],
      contents: {
        text: {
          maxCharacters: 1000,
          verbosity: "standard" as const,
        },
        highlights: {
          maxCharacters: 500,
          query: "Video description and key points",
        },
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await exa.search(`${query} site:youtube.com`, searchOptions as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (results.results as any[]).map((result: ExaSearchResult) => ({
      title: result.title || "Untitled",
      url: result.url,
      snippet:
        result.highlights?.[0] ||
        (result as unknown as { text?: string }).text ||
        "",
      thumbnail: result.image || undefined,
      publishedDate: result.publishedDate,
    }));
  } catch (error) {
    console.error("YouTube search error:", error);
    throw new Error(
      `Failed to search YouTube: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Research tool for finding educational materials
 * Searches across web and YouTube for comprehensive results
 */
export async function researchMaterials(
  query: string,
  options: {
    numResults?: number;
    materialTypes?: ("video" | "article" | "pdf")[];
  } = {}
): Promise<ResearchMaterial[]> {
  const {
    numResults = 15,
    materialTypes = ["video", "article", "pdf"],
  } = options;

  const materials: ResearchMaterial[] = [];

  try {
    // Search for videos on YouTube
    if (materialTypes.includes("video")) {
      const videoResults = await searchYouTube(query, {
        numResults: Math.min(numResults, 5),
        type: "auto",
      });

      materials.push(
        ...videoResults.map((result) => ({
          title: result.title,
          url: result.url,
          type: "video" as const,
          snippet: result.snippet,
          source: "YouTube",
        }))
      );
    }

    // Search for articles and educational content
    if (materialTypes.includes("article")) {
      const articleResults = await searchWeb(query, {
        numResults: Math.min(numResults, 5),
        type: "auto",
        excludeDomains: ["youtube.com", "youtu.be"],
      });

      materials.push(
        ...articleResults.map((result) => ({
          title: result.title,
          url: result.url,
          type: "article" as const,
          snippet: result.snippet,
          source: new URL(result.url).hostname.replace(/^www\./, ""),
        }))
      );
    }

    // Search for research papers and PDFs
    if (materialTypes.includes("pdf")) {
      const pdfResults = await searchWeb(query, {
        numResults: Math.min(numResults, 5),
        type: "auto",
        category: "research paper",
      });

      materials.push(
        ...pdfResults.map((result) => ({
          title: result.title,
          url: result.url,
          type: (result.url.endsWith(".pdf") ? "pdf" : "article") as
            | "pdf"
            | "article",
          snippet: result.snippet,
          source: result.author || new URL(result.url).hostname.replace(/^www\./, ""),
        }))
      );
    }

    // Sort by relevance (Exa already does this, but we can shuffle or prioritize)
    return materials.slice(0, numResults);
  } catch (error) {
    console.error("Research error:", error);
    throw new Error(
      `Failed to research materials: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Format search results for AI context
 */
export function formatSearchResultsForAI(
  results: WebSearchResult[] | YouTubeSearchResult[] | ResearchMaterial[],
  type: "web" | "youtube" | "research"
): string {
  if (results.length === 0) {
    return `No ${type} search results found.`;
  }

  let formatted = `${type === "web" ? "Web" : type === "youtube" ? "YouTube" : "Research"} Results:\n\n`;

  results.forEach((result, index) => {
    formatted += `${index + 1}. ${result.title}\n`;
    formatted += `   URL: ${result.url}\n`;
    formatted += `   ${result.snippet}\n`;

    if ("publishedDate" in result && result.publishedDate) {
      formatted += `   Published: ${result.publishedDate}\n`;
    }

    if ("author" in result && result.author) {
      formatted += `   Author: ${result.author}\n`;
    }

    if ("type" in result && result.type) {
      formatted += `   Type: ${result.type}\n`;
    }

    if ("source" in result && result.source) {
      formatted += `   Source: ${result.source}\n`;
    }

    formatted += "\n";
  });

  return formatted;
}
