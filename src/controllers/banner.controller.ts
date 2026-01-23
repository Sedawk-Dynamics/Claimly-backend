import { Response, NextFunction, Request as ExpressRequest } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  getActiveBanner,
} from '../services/banner.service';
import { getBannerUrl } from '../utils/fileUpload';
import logger from '../config/logger';

// Admin controllers
export const uploadBannerController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const { title } = req.body;
    const imageUrl = getBannerUrl(file.filename);

    const banner = await createBanner({
      title: title || undefined,
      imageUrl,
      createdBy: BigInt(req.admin.adminId),
    });

    res.status(201).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBannersController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const banners = await getAllBanners();
    res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

export const getBannerByIdController = async (
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
    const banner = await getBannerById(id);
    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBannerController = async (
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
    const { title, isActive } = req.body;
    const updatedBanner = await updateBanner(id, {
      title,
      isActive,
    });
    res.status(200).json({
      success: true,
      data: updatedBanner,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBannerController = async (
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
    await deleteBanner(id);
    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public controller for users - NO AUTHENTICATION REQUIRED
 * This endpoint is accessible without login/signup
 * Returns the currently active banner that should be displayed to users
 */
export const getActiveBannerController = async (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const banner = await getActiveBanner();
    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};
