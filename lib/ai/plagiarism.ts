/**
 * N-gram fingerprinting for plagiarism detection.
 * No vector DB required — uses Jaccard similarity on shingle sets.
 */

/**
 * Generate n-gram shingles from text.
 */
export function computeShingles(text: string, n: number = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    shingles.add(words.slice(i, i + n).join(' '));
  }
  return shingles;
}

/**
 * Compute Jaccard similarity between two shingle sets.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  const smaller = set1.size <= set2.size ? set1 : set2;
  const larger = set1.size <= set2.size ? set2 : set1;

  for (const shingle of smaller) {
    if (larger.has(shingle)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Compare a submission text against multiple reference texts.
 * Returns the highest similarity score and matched source.
 */
export function checkSimilarity(
  submissionText: string,
  referenceSources: Array<{ id: string; text: string; title?: string }>,
  shingleSize: number = 5
): {
  maxSimilarity: number;
  matchedSourceId: string | null;
  matchedSourceTitle: string | null;
  allResults: Array<{ sourceId: string; title: string; similarity: number }>;
} {
  const submissionShingles = computeShingles(submissionText, shingleSize);
  let maxSimilarity = 0;
  let matchedSourceId: string | null = null;
  let matchedSourceTitle: string | null = null;

  const allResults = referenceSources.map((source) => {
    const sourceShingles = computeShingles(source.text, shingleSize);
    const similarity = jaccardSimilarity(submissionShingles, sourceShingles);

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedSourceId = source.id;
      matchedSourceTitle = source.title || null;
    }

    return {
      sourceId: source.id,
      title: source.title || 'Unknown',
      similarity: Math.round(similarity * 100),
    };
  });

  return {
    maxSimilarity: Math.round(maxSimilarity * 100),
    matchedSourceId,
    matchedSourceTitle,
    allResults: allResults.sort((a, b) => b.similarity - a.similarity),
  };
}
