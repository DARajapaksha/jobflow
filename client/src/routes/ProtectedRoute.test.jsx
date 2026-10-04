import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../context/AuthContext';

const LoginPage = () => <p>login page {useLocation().search}</p>;

function renderAt(path, auth, roles) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>home page</p>} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute roles={roles} />}>
            <Route path="/secret" element={<p>secret page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('<ProtectedRoute>', () => {
  it('sends guests to login and remembers where they were going', () => {
    renderAt('/secret?tab=1', { user: null, loading: false });
    expect(screen.getByText(/login page/)).toHaveTextContent('?next=%2Fsecret%3Ftab%3D1');
  });

  it('waits while the session is being checked', () => {
    renderAt('/secret', { user: null, loading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });

  it('lets the right role through and turns the wrong one away', () => {
    const { unmount } = renderAt('/secret', { user: { role: 'seeker' }, loading: false }, ['seeker']);
    expect(screen.getByText('secret page')).toBeInTheDocument();
    unmount();
    renderAt('/secret', { user: { role: 'seeker' }, loading: false }, ['employer']);
    expect(screen.getByText('home page')).toBeInTheDocument();
  });
});
