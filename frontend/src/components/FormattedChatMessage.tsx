import React from 'react';

interface FormattedChatMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Parses inline formatting:
 * - **bold** or __bold__ -> <strong>
 * - `code` -> <code>
 * - *italic* or _italic_ -> <em>
 * - <br> or <br/> -> <br />
 */
export const renderInlineContent = (text: string): React.ReactNode => {
  if (!text) return null;

  // Handle explicit HTML line breaks like <br> or <br/>
  const brSegments = text.split(/<br\s*\/?>/gi);
  if (brSegments.length > 1) {
    return (
      <>
        {brSegments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && <br />}
            {renderInlineContent(segment)}
          </React.Fragment>
        ))}
      </>
    );
  }

  // Tokenize markdown bold (**text**), inline code (`code`), and italic (*text*)
  const tokenRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g;
  const parts = text.split(tokenRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        // **Bold** or __Bold__
        if (
          (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
          (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
        ) {
          const inner = part.slice(2, -2);
          return (
            <strong
              key={index}
              className="font-semibold text-slate-900 dark:text-white"
            >
              {inner}
            </strong>
          );
        }

        // `Inline Code`
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          const inner = part.slice(1, -1);
          return (
            <code
              key={index}
              className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-medium"
            >
              {inner}
            </code>
          );
        }

        // *Italic*
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
          const inner = part.slice(1, -1);
          return (
            <em key={index} className="italic text-slate-700 dark:text-slate-300">
              {inner}
            </em>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

interface TableData {
  headers: string[];
  rows: string[][];
}

/**
 * FormattedChatMessage
 * Transforms LLM markdown (including bold asterisks, markdown tables,
 * bullets, and headers) into a sleek, clean, modern UI without raw stars or pipe syntax.
 */
export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({
  content,
  isStreaming = false,
  className = ''
}) => {
  if (!content) return null;

  // Split into lines for structured block parsing
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Table Detection: Check if current line starts and ends with '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      // Need at least header + separator or data row
      if (tableLines.length >= 2) {
        const parseRow = (line: string): string[] => {
          return line
            .slice(1, -1)
            .split('|')
            .map(cell => cell.trim());
        };

        const firstRow = parseRow(tableLines[0]);
        const secondRow = parseRow(tableLines[1]);
        const isSecondRowSeparator = secondRow.every(c => /^:?-+:?$/.test(c.replace(/\s+/g, '')));

        let headers: string[] = [];
        let dataRows: string[][] = [];

        if (isSecondRowSeparator) {
          headers = firstRow;
          dataRows = tableLines.slice(2).map(parseRow);
        } else {
          headers = firstRow;
          dataRows = tableLines.slice(1).map(parseRow);
        }

        elements.push(
          <div
            key={`table-${i}`}
            className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 shadow-xs"
          >
            <table className="w-full text-left border-collapse text-xs">
              {headers.length > 0 && (
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80">
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider"
                      >
                        {renderInlineContent(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {dataRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-3 py-2 text-slate-700 dark:text-slate-300 align-top leading-relaxed"
                      >
                        {renderInlineContent(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Headings: #, ##, ###, ####
    if (/^#{1,4}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,4}\s+/, '');
      elements.push(
        <h4
          key={`h-${i}`}
          className="font-bold text-slate-900 dark:text-white mt-2 mb-1 text-xs sm:text-[13px] tracking-tight flex items-center gap-1.5"
        >
          {renderInlineContent(headingText)}
        </h4>
      );
      i++;
      continue;
    }

    // 3. Horizontal Rule: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      elements.push(
        <hr
          key={`hr-${i}`}
          className="my-2 border-slate-200/80 dark:border-slate-700/80"
        />
      );
      i++;
      continue;
    }

    // 4. Bullet Points / Lists: lines starting with •, -, *, or \d+.
    const bulletMatch = trimmed.match(/^([•\-\*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const marker = bulletMatch[1];
      const rest = bulletMatch[2];
      const isNumber = /\d+\./.test(marker);

      elements.push(
        <div
          key={`bullet-${i}`}
          className="flex items-start gap-2 my-1 text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          <span
            className={`select-none shrink-0 text-indigo-500 dark:text-indigo-400 font-semibold text-xs ${
              isNumber ? 'font-mono text-[11px]' : 'mt-0.5'
            }`}
          >
            {isNumber ? marker : '•'}
          </span>
          <div className="flex-1">{renderInlineContent(rest)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 5. Blockquote: lines starting with >
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div
          key={`quote-${i}`}
          className="my-1.5 pl-3 border-l-2 border-indigo-400 dark:border-indigo-500 text-slate-600 dark:text-slate-400 italic text-xs leading-relaxed"
        >
          {renderInlineContent(quoteText)}
        </div>
      );
      i++;
      continue;
    }

    // 6. Empty Line -> spacing
    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 7. Standard Paragraph Line
    elements.push(
      <p key={`p-${i}`} className="my-0.5 leading-relaxed">
        {renderInlineContent(rawLine)}
      </p>
    );
    i++;
  }

  return (
    <div className={`space-y-0.5 text-xs ${className}`}>
      {elements}
      {isStreaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-600 dark:bg-indigo-400 animate-pulse align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
};
