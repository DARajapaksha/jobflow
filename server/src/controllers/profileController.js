import * as service from '../services/profileService.js';
import { seekerProfileSchema, employerProfileSchema } from '../validators/profile.js';

export async function update(req, res) {
  const schema = req.user.role === 'employer' ? employerProfileSchema : seekerProfileSchema;
  res.json(await service.updateProfile(req.user, schema.parse(req.body)));
}
