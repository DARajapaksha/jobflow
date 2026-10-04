import { z } from 'zod';
import * as companies from '../repositories/companyRepository.js';
import { AppError } from '../utils/AppError.js';

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
const idParam = z.object({ id: z.uuid('Invalid company id') });

export const list = async (req, res) => {
  res.json(await companies.list(listQuery.parse(req.query)));
};

export const getOne = async (req, res) => {
  const { id } = idParam.parse(req.params);
  const company = await companies.findById(id);
  if (!company) throw AppError.notFound('Company not found');
  res.json({ company }); // its jobs: GET /api/jobs?company=<id>
};
