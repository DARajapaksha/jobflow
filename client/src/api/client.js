import axios from 'axios';
import { toast } from 'sonner';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

export function errorMessage(err, fallback = 'Something went wrong. Try again.') {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (!err?.response) return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

// Puts server-side validation messages next to the right form fields.
// Returns true when every message was attached to a field.
export function applyApiErrors(err, setError) {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details) || details.length === 0) return false;
  let attached = 0;
  for (const { path, message } of details) {
    if (path) {
      setError(path, { type: 'server', message });
      attached += 1;
    }
  }
  return attached === details.length;
}

export const notifyError = (err) => toast.error(errorMessage(err));
