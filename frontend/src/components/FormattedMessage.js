import React from 'react';

/**
 * Cleanly renders chatbot text messages without exposing raw markdown characters
 * like *, |, ###, $$, or LaTeX formatting.
 * Automatically turns markdown tables into clean HTML tables, bold into <strong>,
 * headers into styled headings, and bullet points into styled lists.
 */
export default function FormattedMessage({ text, style }) {
  if (!text) return null;

  // 1. Sanitize LaTeX and math markers
  let cleanText = String(text)
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\%/g, '%')
    .replace(/\\ge/g, '≥')
    .replace(/\\le/g, '≤')
    .replace(/\$\$/g, '')
    .replace(/\$([^$]+)\$/g, '$1');

  // Helper to render inline formatting (bold, italic, code)
  const renderInline = (str) => {
    if (!str) return null;
    const parts = [];
    // Matches: **bold**, *italic*, `code`
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push(str.substring(lastIdx, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} style={{ fontWeight: 650, color: 'inherit' }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={match.index}>
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={match.index} style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em' }}>
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIdx = match.index + token.length;
    }

    if (lastIdx < str.length) {
      parts.push(str.substring(lastIdx));
    }

    return parts.length > 0 ? parts : str;
  };

  // Helper to check if a line is a markdown table separator (e.g. |:---|:---| or |---|)
  const isTableSeparator = (line) => {
    const trimmed = line.trim();
    return /^\|?(\s*:?-+:?\s*\|?)+$/.test(trimmed) && trimmed.includes('-');
  };

  // Helper to check if a line is a markdown table row (contains | and isn't just a separator)
  const isTableRow = (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
  };

  // Parse lines into blocks (paragraphs, headers, lists, tables, hr)
  const rawLines = cleanText.split('\n');
  const blocks = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Check for markdown table
    if (isTableRow(trimmed) && i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1])) {
      const headerCells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      i += 2; // skip header and separator
      const rows = [];
      while (i < rawLines.length && isTableRow(rawLines[i])) {
        const rowCells = rawLines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (rowCells.length > 0) rows.push(rowCells);
        i++;
      }
      blocks.push({
        type: 'table',
        headers: headerCells,
        rows,
      });
      continue;
    }

    // Check for horizontal divider
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Check for headers (###, ##, #)
    if (/^#{1,4}\s+/.test(trimmed)) {
      const headerContent = trimmed.replace(/^#{1,4}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim();
      blocks.push({ type: 'header', text: headerContent });
      i++;
      continue;
    }

    // Check for bullet lists (- item, * item, • item)
    if (/^[-*•]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[-*•]\s+/, '').trim();
      blocks.push({ type: 'bullet', text: bulletContent });
      i++;
      continue;
    }

    // Check for numbered list items (1. item)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] });
      i++;
      continue;
    }

    // Empty line
    if (!trimmed) {
      blocks.push({ type: 'blank' });
      i++;
      continue;
    }

    // Regular line
    blocks.push({ type: 'text', text: line });
    i++;
  }

  return (
    <div style={{ lineHeight: 1.55, ...style }}>
      {blocks.map((block, idx) => {
        if (block.type === 'blank') {
          return <div key={idx} style={{ height: 6 }} />;
        }
        if (block.type === 'hr') {
          return <hr key={idx} style={{ margin: '8px 0', border: 0, borderTop: '1px solid rgba(92,107,192,0.2)' }} />;
        }
        if (block.type === 'header') {
          return (
            <div
              key={idx}
              style={{
                fontWeight: 700,
                fontSize: '0.96rem',
                color: '#1a237e',
                marginTop: idx > 0 ? 8 : 2,
                marginBottom: 4,
                letterSpacing: '-0.2px',
              }}
            >
              {renderInline(block.text)}
            </div>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={idx} style={{ margin: '8px 0', overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  fontSize: '0.8rem',
                  borderCollapse: 'collapse',
                  background: '#fff',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid rgba(92,107,192,0.2)',
                }}
              >
                <thead style={{ background: 'rgba(26,35,126,0.06)' }}>
                  <tr>
                    {block.headers.map((h, hi) => (
                      <th
                        key={hi}
                        style={{
                          textAlign: 'left',
                          padding: '6px 10px',
                          fontWeight: 650,
                          color: '#1a237e',
                          borderBottom: '1px solid rgba(92,107,192,0.25)',
                        }}
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      style={{
                        background: ri % 2 === 1 ? 'rgba(26,35,126,0.02)' : '#fff',
                      }}
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: '6px 10px',
                            borderBottom: ri < block.rows.length - 1 ? '1px solid rgba(92,107,192,0.1)' : 'none',
                          }}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'bullet') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', margin: '2px 0 2px 4px' }}>
              <span style={{ color: '#3f51b5', marginRight: 7, fontSize: '0.82rem', lineHeight: 1.6 }}>•</span>
              <span style={{ flex: 1 }}>{renderInline(block.text)}</span>
            </div>
          );
        }
        if (block.type === 'numbered') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', margin: '2px 0 2px 4px' }}>
              <span style={{ fontWeight: 650, color: '#3f51b5', marginRight: 6, minWidth: 16, fontSize: '0.82rem', lineHeight: 1.6 }}>
                {block.num}.
              </span>
              <span style={{ flex: 1 }}>{renderInline(block.text)}</span>
            </div>
          );
        }
        // Fallback text line
        return (
          <div key={idx} style={{ margin: '2px 0' }}>
            {renderInline(block.text)}
          </div>
        );
      })}
    </div>
  );
}
