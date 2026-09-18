import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { MapleInsightsCard } from './MapleInsightsCard';
import { useAISettings } from '@/hooks/useAISettings';
import { useBudget } from '@/hooks/useBudget';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';

// Mock the hooks
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: vi.fn(),
}));

vi.mock('@/hooks/useBitcoinPrice', () => ({
  useBitcoinPrice: vi.fn(),
}));

vi.mock('@/hooks/useBudget', () => ({
  useBudget: vi.fn(),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { analyzeMonth } from '@/services/mapleAi';

vi.mock('@/services/mapleAi', async () => {
  const actual = await vi.importActual<typeof import('@/services/mapleAi')>('@/services/mapleAi');
  return {
    ...actual,
    analyzeMonth: vi.fn().mockResolvedValue('You are spending 30% of your Food budget. Great job!'),
    buildBudgetContext: vi.fn().mockReturnValue({
      month: 'April 2026',
      btc_price_usd: 100_000,
      income_usd: 3712,
      planned_budget_usd: 3712,
      total_spent_usd: 1456,
      total_remaining_usd: 2256,
      categories: [],
      recent_transactions: [],
      user_evergreen_context: '',
    }),
  };
});

describe('MapleInsightsCard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    // resetAllMocks wipes the mock implementations declared in the module
    // factory above, so restore defaults that individual tests can override.
    (useAISettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      apiKey: '',
      evergreenContext: '',
    });
    (useBudget as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentBudget: { buckets: [], transactions: [] },
      currentMonth: '2026-04',
    });
    (useBitcoinPrice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { usdPerBtc: 100_000 },
    });
    (analyzeMonth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'You are spending 30% of your Food budget. Great job!'
    );
  });

  it('renders nothing when no API key', () => {
    (useAISettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      apiKey: '',
      evergreenContext: '',
    });
    const { container } = render(
      <TestApp>
        <MapleInsightsCard />
      </TestApp>
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "Analyze This Month" button when key exists', () => {
    (useAISettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      apiKey: 'sk-test',
      evergreenContext: '',
      proxyUrl: 'http://localhost:8080/v1',
    });
    (useBudget as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentBudget: { buckets: [], transactions: [] },
      currentMonth: '2026-04',
    });
    (useBitcoinPrice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { usdPerBtc: 100_000 },
    });

    render(
      <TestApp>
        <MapleInsightsCard />
      </TestApp>
    );

    expect(screen.getByText(/Analyze This Month/i)).toBeInTheDocument();
  });

  it('displays insights after clicking analyze', async () => {
    (useAISettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      apiKey: 'sk-test',
      evergreenContext: '',
      proxyUrl: 'http://localhost:8080/v1',
    });
    (useBudget as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentBudget: { buckets: [], transactions: [] },
      currentMonth: '2026-04',
    });
    (useBitcoinPrice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { usdPerBtc: 100_000 },
    });

    render(
      <TestApp>
        <MapleInsightsCard />
      </TestApp>
    );

    const user = userEvent.setup();
    await user.click(screen.getByText(/Analyze This Month/i));

    await waitFor(() => {
      expect(screen.getByText(/spending 30%/i)).toBeInTheDocument();
    });
  });
});
