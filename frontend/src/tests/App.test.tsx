import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';

const flowResponse = {
  positionName: 'Senior backend engineer',
  interviewFlow: {
    interviewSteps: [
      { id: 1, name: 'Initial Screening', orderIndex: 1 },
      { id: 2, name: 'Technical Interview', orderIndex: 2 },
    ],
  },
};

const candidatesResponse = [
  {
    id: 1,
    applicationId: 1,
    fullName: 'Jane Smith',
    currentInterviewStep: 'Initial Screening',
    averageScore: 4,
  },
];

const originalFetch = global.fetch;
const mockFetch = jest.fn();

function createFetchResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  };
}

function mockInitialRequests(putResponse: Promise<unknown>) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/interviewFlow')) {
      return Promise.resolve(createFetchResponse(flowResponse));
    }

    if (url.includes('/positions/1/candidates')) {
      return Promise.resolve(createFetchResponse(candidatesResponse));
    }

    if (url.includes('/candidates/1/stage')) {
      return putResponse;
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

beforeEach(() => {
  window.history.pushState({}, '', '/positions/1');
  global.fetch = mockFetch as jest.Mock;
});

afterEach(() => {
  mockFetch.mockReset();
  global.fetch = originalFetch;
});

test('renders the position board header', async () => {
  mockInitialRequests(Promise.resolve(createFetchResponse({ message: 'ok' })));

  render(<App />);

  expect(screen.getByText(/proceso de contratacion/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/volver al listado de posiciones/i)).toBeInTheDocument();
  expect(await screen.findByText(/senior backend engineer/i)).toBeInTheDocument();
});

test('moves a candidate optimistically and keeps the new stage when the API succeeds', async () => {
  let resolvePut: (value: unknown) => void = () => undefined;
  const putResponse = new Promise((resolve) => {
    resolvePut = resolve;
  });
  mockInitialRequests(putResponse);

  render(<App />);

  const initialColumn = await screen.findByLabelText(/fase initial screening/i);
  expect(await within(initialColumn).findByText('Jane Smith')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /mover a technical interview/i }));

  expect(within(screen.getByLabelText(/fase technical interview/i)).getByText('Jane Smith')).toBeInTheDocument();

  resolvePut(createFetchResponse({ message: 'Candidate stage updated successfully' }));

  await waitFor(() =>
    expect(within(screen.getByLabelText(/fase technical interview/i)).getByText('Jane Smith')).toBeInTheDocument(),
  );
});

test('rolls back only the moved candidate when the API update fails', async () => {
  let resolvePut: (value: unknown) => void = () => undefined;
  const putResponse = new Promise((resolve) => {
    resolvePut = resolve;
  });
  mockInitialRequests(putResponse);

  render(<App />);

  const initialColumn = await screen.findByLabelText(/fase initial screening/i);
  expect(await within(initialColumn).findByText('Jane Smith')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /mover a technical interview/i }));

  expect(within(screen.getByLabelText(/fase technical interview/i)).getByText('Jane Smith')).toBeInTheDocument();

  resolvePut(createFetchResponse({ message: 'error' }, false));

  await waitFor(() =>
    expect(within(screen.getByLabelText(/fase initial screening/i)).getByText('Jane Smith')).toBeInTheDocument(),
  );
  expect(screen.getByText(/no se pudo actualizar la etapa del candidato/i)).toBeInTheDocument();
});
