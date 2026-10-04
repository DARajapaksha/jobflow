import { createContext, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export const AuthContext = createContext(null);

async function fetchMe() {
  try {
    return (await api.get('/auth/me')).data;
  } catch (err) {
    if (err.response?.status === 401) return null; // not logged in is a normal state, not an error
    throw err;
  }
}

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: Infinity, retry: false });

  const value = useMemo(() => {
    const refresh = async () => {
      const me = await qc.fetchQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 0 });
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' }); // personalised data (saved flags, applications) must reload
      return me;
    };
    return {
      user: data?.user ?? null,
      profile: data?.profile ?? null, // seekers
      company: data?.company ?? null, // employers
      loading: isPending,
      async login(body) {
        await api.post('/auth/login', body);
        return (await refresh()).user;
      },
      async register(body) {
        await api.post('/auth/register', body);
        return (await refresh()).user;
      },
      async logout() {
        await api.post('/auth/logout');
        qc.setQueryData(['me'], null);
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      },
    };
  }, [data, isPending, qc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
