import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';
import { deleteFile } from '../utils/fileUpload';

export interface CreateOfferBannerData {
  title?: string;
  imageUrl: string;
  createdBy: bigint;
}

export interface UpdateOfferBannerData {
  title?: string;
  isActive?: boolean;
}

export interface OfferBanner {
  id: string;
  title: string | null;
  imageUrl: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get active offer banner (for public user access)
 */
export const getActiveOfferBanner = async (): Promise<OfferBanner | null> => {
  try {
    const offerBanner = await prisma.offerBanner.findFirst({
      where: {
        is_active: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!offerBanner) {
      return null;
    }

    return {
      id: offerBanner.id.toString(),
      title: offerBanner.title,
      imageUrl: offerBanner.image_url,
      isActive: offerBanner.is_active,
      createdBy: offerBanner.created_by.toString(),
      createdAt: offerBanner.created_at.toISOString(),
      updatedAt: offerBanner.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('Error fetching active offer banner', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get all offer banners (admin access)
 */
export const getAllOfferBanners = async (): Promise<OfferBanner[]> => {
  try {
    const offerBanners = await prisma.offerBanner.findMany({
      orderBy: {
        created_at: 'desc',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return offerBanners.map((offerBanner) => ({
      id: offerBanner.id.toString(),
      title: offerBanner.title,
      imageUrl: offerBanner.image_url,
      isActive: offerBanner.is_active,
      createdBy: offerBanner.created_by.toString(),
      createdAt: offerBanner.created_at.toISOString(),
      updatedAt: offerBanner.updated_at.toISOString(),
    }));
  } catch (error: any) {
    logger.error('Error fetching all offer banners', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get offer banner by ID
 */
export const getOfferBannerById = async (offerBannerId: string): Promise<OfferBanner> => {
  try {
    const offerBanner = await prisma.offerBanner.findUnique({
      where: {
        id: BigInt(offerBannerId),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!offerBanner) {
      throw new NotFoundError('Offer banner not found');
    }

    return {
      id: offerBanner.id.toString(),
      title: offerBanner.title,
      imageUrl: offerBanner.image_url,
      isActive: offerBanner.is_active,
      createdBy: offerBanner.created_by.toString(),
      createdAt: offerBanner.created_at.toISOString(),
      updatedAt: offerBanner.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error fetching offer banner by ID', {
      error: error.message,
      offerBannerId,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Create a new offer banner
 */
export const createOfferBanner = async (data: CreateOfferBannerData): Promise<OfferBanner> => {
  try {
    const offerBanner = await prisma.offerBanner.create({
      data: {
        title: data.title || null,
        image_url: data.imageUrl,
        is_active: false, // New offer banners are inactive by default
        created_by: data.createdBy,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Offer banner created', {
      offerBannerId: offerBanner.id.toString(),
    });

    return {
      id: offerBanner.id.toString(),
      title: offerBanner.title,
      imageUrl: offerBanner.image_url,
      isActive: offerBanner.is_active,
      createdBy: offerBanner.created_by.toString(),
      createdAt: offerBanner.created_at.toISOString(),
      updatedAt: offerBanner.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('Error creating offer banner', {
      error: error.message,
      data,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Update an offer banner
 */
export const updateOfferBanner = async (
  offerBannerId: string,
  data: UpdateOfferBannerData
): Promise<OfferBanner> => {
  try {
    // Check if offer banner exists
    const existingOfferBanner = await prisma.offerBanner.findUnique({
      where: {
        id: BigInt(offerBannerId),
      },
    });

    if (!existingOfferBanner) {
      throw new NotFoundError('Offer banner not found');
    }

    // If setting this offer banner as active, deactivate all other offer banners
    if (data.isActive === true) {
      await prisma.offerBanner.updateMany({
        where: {
          is_active: true,
          id: { not: BigInt(offerBannerId) },
        },
        data: {
          is_active: false,
        },
      });
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title || null;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const offerBanner = await prisma.offerBanner.update({
      where: {
        id: BigInt(offerBannerId),
      },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Offer banner updated', {
      offerBannerId: offerBanner.id.toString(),
    });

    return {
      id: offerBanner.id.toString(),
      title: offerBanner.title,
      imageUrl: offerBanner.image_url,
      isActive: offerBanner.is_active,
      createdBy: offerBanner.created_by.toString(),
      createdAt: offerBanner.created_at.toISOString(),
      updatedAt: offerBanner.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error updating offer banner', {
      error: error.message,
      offerBannerId,
      data,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Delete an offer banner
 */
export const deleteOfferBanner = async (offerBannerId: string): Promise<void> => {
  try {
    const offerBanner = await prisma.offerBanner.findUnique({
      where: {
        id: BigInt(offerBannerId),
      },
    });

    if (!offerBanner) {
      throw new NotFoundError('Offer banner not found');
    }

    // Extract filename from image_url
    const imageUrl = offerBanner.image_url;
    const filename = imageUrl.split('/').pop() || '';

    // Delete the file from filesystem
    if (filename) {
      try {
        deleteFile(filename, 'offer-banners');
      } catch (fileError) {
        logger.warn('Error deleting offer banner file', {
          filename,
          error: fileError,
        });
      }
    }

    await prisma.offerBanner.delete({
      where: {
        id: BigInt(offerBannerId),
      },
    });

    logger.info('Offer banner deleted', {
      offerBannerId,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error deleting offer banner', {
      error: error.message,
      offerBannerId,
      stack: error.stack,
    });
    throw error;
  }
};

