import { Request, Response, NextFunction } from 'express';
import { getActiveCompanies } from '../services/company.service';

export const getCompaniesController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companies = await getActiveCompanies();
    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    next(error);
  }
};


