export const JOB_TYPES = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' };
export const WORK_MODES = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };

// The hiring pipeline, in order. "rejected" sits outside it.
export const APPLICATION_STAGES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'hired', label: 'Hired' },
];

export const MAX_RESUME_MB = 5;
