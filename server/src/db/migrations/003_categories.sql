-- Job categories are reference data the app needs (the search filter and the "post a job" form read them),
-- so they come from a migration and exist in every database, with or without any demo content.
-- Safe to run on a database that already has some of them: existing names are left alone.
INSERT INTO categories (name) VALUES
  ('Software Engineering'),
  ('Design'),
  ('Data & Analytics'),
  ('Marketing'),
  ('Finance'),
  ('Customer Support'),
  ('Sales'),
  ('Human Resources'),
  ('Education & Training'),
  ('Engineering'),
  ('Healthcare'),
  ('Hospitality & Tourism'),
  ('Operations & Logistics'),
  ('Administration'),
  ('Legal'),
  ('Media & Communications'),
  ('Other')
ON CONFLICT (name) DO NOTHING;
