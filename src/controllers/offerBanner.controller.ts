import { Response, NextFunction, Request as ExpressRequest } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import {
  createOfferBanner,
  getAllOfferBanners,
  getOfferBannerById,
  updateOfferBanner,
  deleteOfferBanner,
  getActiveOfferBanner,
} from '../services/offerBanner.service';
import { getOfferBannerUrl } from '../utils/fileUpload';

// Admin controllers
export const uploadOfferBannerController = async (
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
    const imageUrl = getOfferBannerUrl(file.filename);

    const offerBanner = await createOfferBanner({
      title: title || undefined,
      imageUrl,
      createdBy: BigInt(req.admin.adminId),
    });

    res.status(201).json({
      success: true,
      data: offerBanner,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllOfferBannersController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const offerBanners = await getAllOfferBanners();
    res.status(200).json({
      success: true,
      data: offerBanners,
    });
  } catch (error) {
    next(error);
  }
};

export const getOfferBannerByIdController = async (
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
    const offerBanner = await getOfferBannerById(id);
    res.status(200).json({
      success: true,
      data: offerBanner,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOfferBannerController = async (
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
    const updatedOfferBanner = await updateOfferBanner(id, {
      title,
      isActive,
    });
    res.status(200).json({
      success: true,
      data: updatedOfferBanner,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOfferBannerController = async (
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
    await deleteOfferBanner(id);
    res.status(200).json({
      success: true,
      message: 'Offer banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public controller for users - NO AUTHENTICATION REQUIRED
 * Returns the currently active offer banner that should be displayed to users
 */
export const getActiveOfferBannerController = async (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offerBanner = await getActiveOfferBanner();
    res.status(200).json({
      success: true,
      data: offerBanner,
    });
  } catch (error) {
    next(error);
  }
};

