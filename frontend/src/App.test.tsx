import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Smoke Test', () => {
  it('renders login page when unauthenticated', () => {
    render(<App />);
    expect(screen.getByText(/CRC One/i)).toBeDefined();
    expect(screen.getByText(/Sign In to Dashboard/i)).toBeDefined();
  });
});
