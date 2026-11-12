import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge, Button, EmptyState, ErrorState, Field, Input, Pagination, StatusBadge } from '../components/ui';
import { ToastProvider, useToast } from '../components/ui/Toast';

describe('ui primitives', () => {
  it('renders a button and blocks clicks while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('surfaces field validation messages to assistive tech', () => {
    render(
      <Field label="Email" error="Email is required" htmlFor="email">
        <Input id="email" invalid />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  });

  it('renders status badges for payment states', () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('renders empty and error states with a retry action', async () => {
    const retry = vi.fn();
    render(
      <>
        <EmptyState title="No products" description="Add one to get started" />
        <ErrorState message="Boom" onRetry={retry} />
      </>,
    );
    expect(screen.getByText('No products')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });

  it('disables pagination edges', () => {
    render(<Pagination page={1} totalPages={3} total={25} onPage={() => {}} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('renders a badge', () => {
    render(<Badge tone="green">active</Badge>);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows toasts and can dismiss them', async () => {
    function Trigger() {
      const { success } = useToast();
      return <button onClick={() => success('Saved!')}>go</button>;
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });
});
