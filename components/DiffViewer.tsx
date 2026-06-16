'use client';

import { useMemo } from 'react';
import { diff_match_patch } from 'diff-match-patch';

// Word-mode diff recipe (diff-match-patch has no built-in wordMode).
// Adapted from the documented line-mode recipe, tokenizing on word boundaries.
function diffWords(a: string, b: string): [number, string][] {
  const dmp = new diff_match_patch();

  // Tokenize on whitespace-preserving word boundaries
  const tokens: string[] = [];
  const tokenMap = new Map<string, string>();
  let charCode = 0x100; // Start above ASCII to avoid conflicts

  function tokenize(text: string): string {
    const words = text.match(/\S+\s*/g) ?? [];
    return words
      .map((w) => {
        if (!tokenMap.has(w)) {
          const ch = String.fromCharCode(charCode++);
          tokenMap.set(w, ch);
          tokens.push(w);
        }
        return tokenMap.get(w)!;
      })
      .join('');
  }

  const aEncoded = tokenize(a);
  const bEncoded = tokenize(b);

  const diffs = dmp.diff_main(aEncoded, bEncoded, false);
  dmp.diff_cleanupSemantic(diffs);

  // Decode back to words
  return diffs.map(([op, encoded]) => {
    const decoded = encoded
      .split('')
      .map((ch) => {
        const idx = ch.charCodeAt(0) - 0x100;
        return tokens[idx] ?? ch;
      })
      .join('');
    return [op, decoded] as [number, string];
  });
}

interface Props {
  original: string;
  rewritten: string;
}

export default function DiffViewer({ original, rewritten }: Props) {
  const diffs = useMemo(() => diffWords(original, rewritten), [original, rewritten]);

  const originalParts = diffs.filter(([op]) => op !== 1); // 0 equal, -1 delete
  const rewrittenParts = diffs.filter(([op]) => op !== -1); // 0 equal, 1 insert

  function renderPart([op, text]: [number, string], i: number) {
    if (op === 0) return <span key={i}>{text}</span>;
    if (op === -1)
      return (
        <del key={i} className="bg-red-100 text-red-800 line-through rounded-sm px-0.5">
          {text}
        </del>
      );
    return (
      <ins key={i} className="bg-green-100 text-green-800 no-underline rounded-sm px-0.5">
        {text}
      </ins>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
      {/* Original with deletions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 font-sans">
          Original
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto thin-scroll leading-relaxed whitespace-pre-wrap">
          {originalParts.map((d, i) => renderPart(d, i))}
        </div>
      </div>

      {/* Rewritten with insertions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 font-sans">
          Rewritten
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto thin-scroll leading-relaxed whitespace-pre-wrap">
          {rewrittenParts.map((d, i) => renderPart(d, i))}
        </div>
      </div>
    </div>
  );
}
