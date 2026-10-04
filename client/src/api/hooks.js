import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from './client';

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

export const useJobs = (params) =>
  useQuery({ queryKey: ['jobs', params], queryFn: () => get('/jobs', params), placeholderData: keepPreviousData });

export const useJob = (id) =>
  useQuery({ queryKey: ['job', id], queryFn: () => get(`/jobs/${id}`), retry: (count, err) => err?.response?.status >= 500 && count < 2 });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => get('/categories').then((d) => d.data), staleTime: 10 * 60_000 });

export const useMyApplications = () =>
  useQuery({ queryKey: ['applications'], queryFn: () => get('/me/applications').then((d) => d.data) });

export const useSavedJobs = (params) =>
  useQuery({ queryKey: ['saved', params], queryFn: () => get('/me/saved-jobs', params), placeholderData: keepPreviousData });

export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }) => (saved ? api.delete(`/jobs/${id}/save`) : api.post(`/jobs/${id}/save`)),
    onSuccess: (_res, { id, saved }) => {
      toast.success(saved ? 'Removed from saved jobs' : 'Job saved');
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', id] });
      qc.invalidateQueries({ queryKey: ['saved'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useApply(jobId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => api.post(`/jobs/${jobId}/applications`, formData).then((r) => r.data.application),
    onSuccess: () => {
      toast.success('Application sent');
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch('/me/profile', body).then((r) => r.data),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      toast.success('Profile saved');
    },
  });
}

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('resume', file);
      return api.put('/me/resume', form).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success('Resume uploaded');
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/me/resume'),
    onSuccess: () => {
      toast.success('Resume removed');
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
