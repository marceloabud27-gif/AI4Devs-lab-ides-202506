import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      {
        id: 1,
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'ana@example.com',
        phone: '0981000000',
        address: 'Asuncion',
        education: 'Licenciatura',
        workExperience: 'Ventas',
        createdAt: new Date().toISOString(),
      },
    ],
  }) as jest.Mock;
});

test('renders recruiter dashboard', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /dashboard del reclutador/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /anadir candidato/i })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://localhost:3010/candidates'));
  expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
});
