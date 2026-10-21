import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormattedChatMessage, renderInlineContent } from '../FormattedChatMessage';

describe('FormattedChatMessage Component Tests', () => {
  it('1. converts **bold text** to <strong> tags without raw asterisks', () => {
    const content = '**Yesterday’s key changes** (all grounded in the workspace data):';
    const { container } = render(<FormattedChatMessage content={content} />);

    const strongEl = container.querySelector('strong');
    expect(strongEl).not.toBeNull();
    expect(strongEl?.textContent).toBe('Yesterday’s key changes');
    // Ensure raw asterisks are not in the DOM text
    expect(container.textContent).not.toContain('**');
  });

  it('2. converts markdown tables into structured table cards', () => {
    const tableMarkdown = `
| Area | What changed |
|------|--------------|
| Stand-up updates | Priya Sharma finished OAuth flow |
| Blockers | 1 active blocker on DB migration |
`;
    const { container } = render(<FormattedChatMessage content={tableMarkdown} />);

    const tableEl = container.querySelector('table');
    expect(tableEl).not.toBeNull();

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe('Area');
    expect(headers[1].textContent).toBe('What changed');

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(container.textContent).toContain('Priya Sharma finished OAuth flow');
    // Ensure raw pipe delimiter bars are not printed verbatim
    expect(container.textContent).not.toContain('|------|');
  });

  it('3. handles HTML <br> tags cleanly inside cell contents or paragraphs', () => {
    const textWithBr = 'Line 1<br>Line 2<br />Line 3';
    const { container } = render(<FormattedChatMessage content={textWithBr} />);

    const brs = container.querySelectorAll('br');
    expect(brs.length).toBe(2);
    expect(container.textContent).not.toContain('<br>');
    expect(container.textContent).not.toContain('<br />');
  });

  it('4. converts headings ### to styled header elements', () => {
    const content = '### Sprint 43 Velocity Overview';
    const { container } = render(<FormattedChatMessage content={content} />);

    const heading = container.querySelector('h4');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Sprint 43 Velocity Overview');
    expect(container.textContent).not.toContain('###');
  });

  it('5. renders bullet points with clean indicator icon', () => {
    const content = `
• First update
• Second update with **bold metric**
`;
    const { container } = render(<FormattedChatMessage content={content} />);

    expect(screen.getByText('First update')).toBeDefined();
    expect(screen.getByText('bold metric')).toBeDefined();
    const strongEl = container.querySelector('strong');
    expect(strongEl?.textContent).toBe('bold metric');
    expect(container.textContent).not.toContain('**');
  });

  it('6. displays pulsing cursor when isStreaming is true', () => {
    const { container } = render(<FormattedChatMessage content="Generating live token..." isStreaming={true} />);

    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).not.toBeNull();
  });
});
