import * as service from '../services/jobService.js';
import { createJobSchema, updateJobSchema, searchQuerySchema, myJobsQuerySchema, idParamSchema, pageQuerySchema } from '../validators/jobs.js';

export const search = async (req, res) => {
  const viewerId = req.user?.role === 'seeker' ? req.user.id : null;
  res.json(await service.search(searchQuerySchema.parse(req.query), viewerId));
};

export const getOne = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = { job: await service.getById(id, req.user) };
  // Lets the UI show "Applied" instead of the Apply button, and a filled bookmark
  if (req.user?.role === 'seeker') body.viewer = await service.viewerState(id, req.user);
  res.json(body);
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

export const save = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await service.saveJob(req.user, id);
  res.json({ saved: true });
};

export const unsave = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await service.unsaveJob(req.user, id);
  res.status(204).end();
};

export const listSaved = async (req, res) => {
  res.json(await service.listSaved(req.user, pageQuerySchema.parse(req.query)));
};
