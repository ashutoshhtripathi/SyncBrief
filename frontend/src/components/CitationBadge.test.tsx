import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CitationBadge } from './CitationBadge';
import { CitationItem } from '../types';

describe('CitationBadge Component', () => {
  it('renders verified citation with green indicator and channel tag', () => {
    const verifiedCitation: CitationItem = {
      message_id: 'msg_492',
      channel: '#backend',
      author: 'Vikram Joshi',
      quote: 'The v2.4 Auth schema migration script is currently blocked.',
      status: 'VERIFIED',
    };

    render(
      <BrowserRouter>
        <CitationBadge citation={verifiedCitation} />
      </BrowserRouter>
    );

    expect(screen.getByText('Verified Link')).toBeDefined();
    expect(screen.getByText(/#backend/)).toBeDefined();
    expect(screen.getByText(/msg_492/)).toBeDefined();
  });

  it('renders unverified citation when status is UNVERIFIED', () => {
    const unverifiedCitation: CitationItem = {
      message_id: 'msg_fake_999',
      channel: '#devops',
      author: 'NonExistentBot',
      quote: 'Fake outage report.',
      status: 'UNVERIFIED',
      rejection_reason: 'Message not found in database',
    };

    render(
      <BrowserRouter>
        <CitationBadge citation={unverifiedCitation} />
      </BrowserRouter>
    );

    expect(screen.getByText('Unverified')).toBeDefined();
    expect(screen.getByText(/#devops/)).toBeDefined();
  });
});
