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

export const JOB_STATUSES = { draft: 'Draft', open: 'Open', closed: 'Closed' };
export const JOB_STATUS_TONE = { draft: 'citrine', open: 'tea', closed: 'neutral' };

export const APPLICATION_STATUSES = { submitted: 'Submitted', reviewed: 'Reviewed', shortlisted: 'Shortlisted', hired: 'Hired', rejected: 'Not selected' };
export const APPLICATION_TONE = { submitted: 'neutral', reviewed: 'sapphire', shortlisted: 'amethyst', hired: 'tea', rejected: 'ruby' };

// What an employer can do next, mirroring the transitions the API enforces. hired and rejected are final.
export const NEXT_STATUSES = {
  submitted: [{ to: 'reviewed', label: 'Mark as reviewed' }, { to: 'rejected', label: 'Reject', danger: true }],
  reviewed: [{ to: 'shortlisted', label: 'Shortlist' }, { to: 'rejected', label: 'Reject', danger: true }],
  shortlisted: [{ to: 'hired', label: 'Hire' }, { to: 'rejected', label: 'Reject', danger: true }],
  hired: [],
  rejected: [],
};
