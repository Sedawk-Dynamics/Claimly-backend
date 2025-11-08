import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  createNominee,
  getUserNominees,
  getNomineeById,
  updateNominee,
  deleteNominee,
} from '../services/nominee.service';

export const createNomineeController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, relationship, mobileNumber, email, address } = req.body;
    const nominee = await createNominee(req.user.userId, {
      name,
      relationship,
      mobileNumber,
      email,
      address,
    });

    res.status(201).json({
      success: true,
      data: nominee,
    });
  } catch (error) {
    next(error);
  }
};

export const getNomineesController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const nominees = await getUserNominees(req.user.userId);
    res.status(200).json({
      success: true,
      data: nominees,
    });
  } catch (error) {
    next(error);
  }
};

export const getNomineeByIdController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const nominee = await getNomineeById(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: nominee,
    });
  } catch (error) {
    next(error);
  }
};

export const updateNomineeController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, relationship, mobileNumber, email, address } = req.body;
    const updatedNominee = await updateNominee(req.user.userId, id, {
      name,
      relationship,
      mobileNumber,
      email,
      address,
    });

    res.status(200).json({
      success: true,
      data: updatedNominee,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNomineeController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await deleteNominee(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

