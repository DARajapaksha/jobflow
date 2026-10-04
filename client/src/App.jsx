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
import EmployerDashboard from './pages/EmployerDashboard';
import JobForm from './pages/JobForm';
import Applicants from './pages/Applicants';
import Companies from './pages/Companies';
import CompanyPage from './pages/CompanyPage';
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
          <Route path="companies" element={<Companies />} />
          <Route path="companies/:id" element={<CompanyPage />} />

          <Route element={<ProtectedRoute roles={['seeker']} />}>
            <Route path="saved" element={<Saved />} />
            <Route path="applications" element={<Applications />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute roles={['employer']} />}>
            <Route path="employer" element={<EmployerDashboard />} />
            <Route path="employer/jobs/new" element={<JobForm />} />
            <Route path="employer/jobs/:id/edit" element={<JobForm />} />
            <Route path="employer/jobs/:id/applicants" element={<Applicants />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
