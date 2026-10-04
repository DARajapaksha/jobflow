import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Button, Modal, TextField } from './ui';
import { useAuth } from '../context/AuthContext';
import { useApply } from '../api/hooks';
import { errorMessage } from '../api/client';
import { MAX_RESUME_MB } from '../lib/constants';
import { cn } from '../lib/cn';

export const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
export const sizeError = (file) => (file.size > MAX_RESUME_MB * 1024 * 1024 ? `That file is over ${MAX_RESUME_MB} MB. Choose a smaller PDF.` : null);

function ApplyForm({ job, onClose }) {
  const { profile } = useAuth();
  const apply = useApply(job.id);
  const savedName = profile?.resumeFilename;
  const [mode, setMode] = useState(savedName ? 'saved' : 'upload');
  const [coverLetter, setCoverLetter] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [formError, setFormError] = useState('');
  const fileInput = useRef(null);

  const onFile = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    const problem = !isPdf(chosen) ? 'Resumes must be PDF files.' : sizeError(chosen);
    setFileError(problem ?? '');
    setFile(problem ? null : chosen);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (mode === 'upload' && !file) {
      setFileError('Choose a PDF resume to attach.');
      return;
    }
    const body = new FormData();
    if (coverLetter.trim()) body.append('coverLetter', coverLetter.trim());
    if (mode === 'upload') body.append('resume', file);
    try {
      await apply.mutateAsync(body);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError && <p role="alert" className="rounded-lg bg-ruby-tint px-3.5 py-2.5 text-sm text-ruby">{formError}</p>}

      <TextField
        as="textarea"
        rows={6}
        label="Cover letter (optional)"
        value={coverLetter}
        maxLength={5000}
        onChange={(e) => setCoverLetter(e.target.value)}
        hint={`${coverLetter.length} of 5000 characters`}
        placeholder={`Tell ${job.company.name} why you're a good fit for this role.`}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Resume</legend>
        {savedName && (
          <div className="mb-2 space-y-2">
            {[['saved', `Use my saved resume: ${savedName}`], ['upload', 'Upload a different PDF']].map(([value, label]) => (
              <label key={value} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5', mode === value ? 'border-sapphire bg-sapphire-tint/60' : 'border-line hover:bg-moon')}>
                <input type="radio" name="resume-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="size-4 accent-sapphire" />
                <span className="min-w-0 truncate">{label}</span>
              </label>
            ))}
          </div>
        )}
        {mode === 'upload' && (
          <div>
            <input ref={fileInput} id="apply-resume" type="file" accept="application/pdf,.pdf" onChange={onFile} className="sr-only" aria-describedby="apply-resume-help" />
            <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-dashed border-ink-soft/50 bg-moon/50 px-3.5 py-3.5 text-left hover:bg-moon">
              {file ? <FileText className="size-5 shrink-0 text-sapphire" aria-hidden /> : <Upload className="size-5 shrink-0 text-ink-soft" aria-hidden />}
              <span className="min-w-0 truncate font-medium">{file ? file.name : 'Choose a PDF'}</span>
            </button>
            <p id="apply-resume-help" className="mt-1.5 text-sm text-ink-soft">PDF only, up to {MAX_RESUME_MB} MB.</p>
            {fileError && <p role="alert" className="mt-1.5 text-sm text-ruby">{fileError}</p>}
          </div>
        )}
      </fieldset>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={apply.isPending}>Send application</Button>
      </div>
    </form>
  );
}

export default function ApplyModal({ job, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={`Apply to ${job.title}`}>
      <ApplyForm job={job} onClose={onClose} />
    </Modal>
  );
}
