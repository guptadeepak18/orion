import React from 'react';
import {
  Bookmark,
  Scale,
  Sparkles,
} from 'lucide-react';

interface ParsedBlock {
  heading: string | null;
  items: string[];
}

export const parseUnitContent = (text?: string): ParsedBlock[] => {
  if (!text || !text.trim()) return [];

  // Split lines if explicitly provided, or split sentences before major topic headers
  // Avoid splitting common abbreviations like vs., e.g., i.e., Ltd., No., etc.
  const rawText = text.trim();

  // If text already has explicit newlines or bullet points
  const rawLines = rawText
    .split(/\n+|•/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const blocks: ParsedBlock[] = [];

  for (const line of rawLines) {
    // If the line contains multiple sub-topics with "Header: Details..."
    // Split sentences ending in period followed by Capitalized Header with colon
    const subSentences = line
      .split(/(?<=[.?!])\s+(?=[A-Z][a-zA-Z0-9\s\(\)\/\,\-]{2,55}\:)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const sentence of subSentences) {
      const colonIdx = sentence.indexOf(':');
      if (colonIdx > 2 && colonIdx < 60 && !sentence.slice(0, colonIdx).includes('.')) {
        const heading = sentence.slice(0, colonIdx).trim();
        const body = sentence.slice(colonIdx + 1).trim();

        // Split body by semicolons or dashes if multiple items exist
        const items = body
          .split(/;|\n|•/)
          .map((item) => item.trim().replace(/^[-–—]\s*/, '').replace(/\.$/, ''))
          .filter((item) => item.length > 0);

        blocks.push({
          heading,
          items: items.length > 0 ? items : [body],
        });
      } else {
        // Check if list separated by semicolons
        const items = sentence
          .split(/;|\n|•/)
          .map((item) => item.trim().replace(/^[-–—]\s*/, '').replace(/\.$/, ''))
          .filter((item) => item.length > 0);

        if (items.length > 1) {
          blocks.push({
            heading: null,
            items,
          });
        } else {
          blocks.push({
            heading: null,
            items: [sentence],
          });
        }
      }
    }
  }

  return blocks;
};

export const UnitContentFormatter: React.FC<{ content?: string }> = ({ content }) => {
  if (!content || !content.trim()) {
    return <p className="text-xs text-slate-400 italic">No topics detailed for this unit.</p>;
  }

  const blocks = parseUnitContent(content);

  if (blocks.length === 0) {
    return <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{content}</p>;
  }

  return (
    <div className="space-y-3.5 pt-1">
      {blocks.map((block, bIdx) => {
        const isCaseDiscussion = block.heading?.toLowerCase().includes('case') || false;
        const isPractical =
          block.heading?.toLowerCase().includes('practical') ||
          block.heading?.toLowerCase().includes('exercise') ||
          block.heading?.toLowerCase().includes('technology');

        return (
          <div
            key={bIdx}
            className={`rounded-xl p-3.5 transition-all ${
              block.heading
                ? isCaseDiscussion
                  ? 'bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40'
                  : isPractical
                  ? 'bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-800/40'
                  : 'bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60'
                : 'bg-transparent'
            }`}
          >
            {block.heading && (
              <div className="flex items-center gap-2 mb-2">
                {isCaseDiscussion ? (
                  <Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : isPractical ? (
                  <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                )}
                <h6
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isCaseDiscussion
                      ? 'text-amber-900 dark:text-amber-200'
                      : isPractical
                      ? 'text-cyan-900 dark:text-cyan-200'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {block.heading}
                </h6>
              </div>
            )}

            <div className="space-y-1.5 pl-0.5">
              {block.items.map((item, iIdx) => (
                <div key={iIdx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500/70 shrink-0" />
                  <span className="flex-1 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
