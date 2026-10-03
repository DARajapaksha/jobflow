import * as service from '../services/jobService.js';
import { createJobSchema, updateJobSchema, searchQuerySchema, myJobsQuerySchema, idParamSchema } from '../validators/jobs.js';

export const search = async (req, res) => {
  res.json(await service.search(searchQuerySchema.parse(req.query)));
};

export const getOne = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ job: await service.getById(id, req.user) });
};

export const create = async (req, res) => {
  const job = await service.create(req.user, createJobSchema.parse(req.body));
  res.status(201).json({ job });
};

export const update = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ job: await service.update(id, req.user, updateJobSchema.parse(req.body)) });
};

export const remove = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await service.remove(id, req.user);
  res.status(204).end();
};

export const listMine = async (req, res) => {
  const { status } = myJobsQuerySchema.parse(req.query);
  res.json({ data: await service.listMine(req.user, status) });
};

export const categories = async (_req, res) => {
  res.json({ data: await service.listCategories() });
};
