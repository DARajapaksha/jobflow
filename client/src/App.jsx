import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './routes/ProtectedRoute';
import Home from './pages/Home';
import JobDetails from './pages/JobDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import Applications from './pages/Applications';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import ComingSoon from './pages/ComingSoon';
import NotFound from './pages/NotFound';

// New page: start at the top. (Filters change only the query string, so the search page keeps its scroll position.)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="jobs/:id" element={<JobDetails />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          <Route element={<ProtectedRoute roles={['seeker']} />}>
            <Route path="saved" element={<Saved />} />
            <Route path="applications" element={<Applications />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute roles={['employer']} />}>
            <Route path="employer/*" element={<ComingSoon />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
