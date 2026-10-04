import { describe, expect, it } from 'vitest';
import { emptyJob, formToPayload, jobToForm, makeJobSchema } from './jobForm';

const valid = { ...emptyJob, title: 'Backend Developer', description: 'Build and run the services behind our products.' };
const issues = (schema, values) => {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('job form schema', () => {
  const schema = makeJobSchema();

  it('accepts a minimal job', () => {
    expect(issues(schema, valid)).toEqual([]);
  });

  it('rejects short titles and descriptions', () => {
    expect(issues(schema, { ...valid, title: 'ab' })[0]).toMatch(/^title/);
    expect(issues(schema, { ...valid, description: 'too short' })[0]).toMatch(/^description/);
  });

  it('checks the salary range', () => {
    expect(issues(schema, { ...valid, salaryMin: 200, salaryMax: 100 })).toEqual(['salaryMax: Maximum must be at least the minimum']);
    expect(issues(schema, { ...valid, salaryMin: 100, salaryMax: null })).toEqual([]);
    expect(issues(schema, { ...valid, salaryMin: -5 })[0]).toMatch(/^salaryMin/);
  });

  it('requires a future expiry date, but not for an unchanged one', () => {
    expect(issues(schema, { ...valid, expiresAt: day(-1) })[0]).toMatch(/^expiresAt/);
    expect(issues(schema, { ...valid, expiresAt: day(7) })).toEqual([]);
    expect(issues(makeJobSchema(day(-1)), { ...valid, expiresAt: day(-1) })).toEqual([]);
  });
});

describe('formToPayload', () => {
  it('turns blanks into null and adds the status when given', () => {
    expect(formToPayload({ ...valid, location: '', expiresAt: day(7) }, { status: 'draft' })).toMatchObject({
      location: null, salaryMin: null, status: 'draft', expiresAt: `${day(7)}T23:59:59Z`,
    });
  });

  it('only sends expiresAt when it changed (and null when cleared)', () => {
    const original = day(5);
    expect(formToPayload({ ...valid, expiresAt: original }, { originalExpiry: original })).not.toHaveProperty('expiresAt');
    expect(formToPayload({ ...valid, expiresAt: '' }, { originalExpiry: original }).expiresAt).toBeNull();
  });

  it('round-trips an API job through the form', () => {
    const job = { title: 'T', category: { id: 3 }, jobType: 'contract', workMode: 'remote', location: null, salaryMin: 1, salaryMax: 2, expiresAt: '2030-01-02T23:59:59Z', description: 'd' };
    const form = jobToForm(job);
    expect(form).toMatchObject({ categoryId: 3, location: '', expiresAt: '2030-01-02' });
    expect(formToPayload(form, { originalExpiry: form.expiresAt })).not.toHaveProperty('expiresAt');
  });
});
