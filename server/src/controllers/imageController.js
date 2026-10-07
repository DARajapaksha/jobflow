import * as images from '../services/imageService.js';
import { z } from 'zod';

const idParam = z.object({ id: z.uuid('Invalid id') });

export const uploadAvatar = async (req, res) => res.json(await images.setAvatar(req.user.id, req.file));
export const deleteAvatar = async (req, res) => {
  await images.removeAvatar(req.user.id);
  res.status(204).end();
};

export const uploadLogo = async (req, res) => res.json(await images.setLogo(req.user, req.file));
export const deleteLogo = async (req, res) => {
  await images.removeLogo(req.user);
  res.status(204).end();
};

export const companyLogo = async (req, res) => {
  const { id } = idParam.parse(req.params);
  await images.sendCompanyLogo(id, res);
};

export const userAvatar = async (req, res) => {
  const { id } = idParam.parse(req.params);
  await images.sendAvatar(id, req.user, res);
};
