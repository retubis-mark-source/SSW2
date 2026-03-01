/**
 * Parses a string containing furigana in the format [Kanji|Reading] or Kanji(Reading)
 * and returns an array of segments for rendering.
 */

export interface ParsedSegment {
  text: string;
  furigana?: string;
}

export function parseFuriganaString(input: string): ParsedSegment[] {
  if (!input) return [];

  // First, convert standard Kanji(Reading) to [Kanji|Reading] format for unified parsing
  // This regex looks for Kanji characters followed by (Reading)
  // Kanji range: \u4e00-\u9faf, including \u3005 (々)
  // Supports both half-width () and full-width （） parentheses
  const processedInput = input.replace(/([\u4e00-\u9faf\u3005]+)[(（]([\u3040-\u309f\u30a0-\u30ff]+)[)）]/g, '[$1|$2]');

  const segments: ParsedSegment[] = [];
  let currentPos = 0;

  // Regex to find [Kanji|Reading]
  const bracketRegex = /\[([^|\]]+)\|([^\]]+)\]/g;
  let match;

  while ((match = bracketRegex.exec(processedInput)) !== null) {
    // Add text before the match
    if (match.index > currentPos) {
      segments.push({
        text: processedInput.substring(currentPos, match.index)
      });
    }

    // Add the furigana segment
    segments.push({
      text: match[1],
      furigana: match[2]
    });

    currentPos = bracketRegex.lastIndex;
  }

  // Add remaining text
  if (currentPos < processedInput.length) {
    segments.push({
      text: processedInput.substring(currentPos)
    });
  }

  return segments;
}
