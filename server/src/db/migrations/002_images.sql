-- Profile pictures: seekers get an avatar, companies get a logo. Both are stored as files (storage keys),
-- like resumes. companies.logo_url was never used, so it is replaced by logo_key.
ALTER TABLE seeker_profiles ADD COLUMN avatar_key VARCHAR(500);
ALTER TABLE companies ADD COLUMN logo_key VARCHAR(500);
ALTER TABLE companies DROP COLUMN logo_url;
