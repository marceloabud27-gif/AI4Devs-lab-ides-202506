import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

const mockFetch = jest.fn((url: string) => {
  if (url.includes('/interviewFlow')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          positionName: 'Senior backend engineer',
          interviewFlow: {
            interviewSteps: [{ id: 1, name: 'Initial Screening', orderIndex: 1 }],
          },
        }),
    });
  }

  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve([
        {
          id: 1,
          applicationId: 1,
          fullName: 'Jane Smith',
          currentInterviewStep: 'Initial Screening',
          averageScore: 4,
        },
      ]),
  });
});

beforeEach(() => {
  window.history.pushState({}, '', '/positions/1');
  global.fetch = mockFetch as jest.Mock;
});

afterEach(() => {
  mockFetch.mockClear();
});

test('renders the position board header', async () => {
  render(<App />);
  expect(screen.getByText(/proceso de contratacion/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/volver al listado de posiciones/i)).toBeInTheDocument();
  expect(await screen.findByText(/senior backend engineer/i)).toBeInTheDocument();
});
