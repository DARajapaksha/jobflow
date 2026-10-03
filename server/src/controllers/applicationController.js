import * as service from '../services/applicationService.js';
import { idParamSchema, applyBodySchema, statusBodySchema, applicantsQuerySchema, myApplicationsQuerySchema } from '../validators/applications.js';

export const apply = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = applyBodySchema.parse(req.body ?? {});
  res.status(201).json({ application: await service.apply(req.user, id, body, req.file) });
};

export const listMine = async (req, res) => {
  const { status } = myApplicationsQuerySchema.parse(req.query);
  res.json({ data: await service.listMine(req.user, status) });
};

export const listForJob = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await service.listForJob(req.user, id, applicantsQuerySchema.parse(req.query)));
};

export const getOne = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ application: await service.getOne(id, req.user) });
};

export const updateStatus = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status } = statusBodySchema.parse(req.body);
  res.json({ application: await service.updateStatus(id, req.user, status) });
};

export const downloadResume = async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await service.sendResume(id, req.user, res);
};
