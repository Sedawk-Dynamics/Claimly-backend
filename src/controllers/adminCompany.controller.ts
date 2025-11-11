import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from '../services/adminCompany.service';

export const createCompanyController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, contactEmail, contactNumber, websiteUrl, address } = req.body;
    const company = await createCompany({ name, contactEmail, contactNumber, websiteUrl, address });
    res.status(201).json({
      success: true,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCompaniesController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as 'ACTIVE' | 'INACTIVE' | undefined;
    const search = req.query.search as string | undefined;

    const result = await getAllCompanies(page, limit, status, search);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompanyByIdController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const company = await getCompanyById(id);
    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCompanyController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, contactEmail, contactNumber, websiteUrl, address, status } = req.body;
    const updatedCompany = await updateCompany(id, {
      name,
      contactEmail,
      contactNumber,
      websiteUrl,
      address,
      status,
    });
    res.status(200).json({
      success: true,
      data: updatedCompany,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCompanyController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await deleteCompany(id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

