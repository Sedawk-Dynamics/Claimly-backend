import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';
import { getBannerUrl, deleteFile } from '../utils/fileUpload';

export interface CreateBannerData {
  title?: string;
  imageUrl: string;
  createdBy: bigint;
}

export interface UpdateBannerData {
  title?: string;
  isActive?: boolean;
}

export interface Banner {
  id: string;
  title: string | null;
  imageUrl: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get active banner (for public user access)
 */
export const getActiveBanner = async (): Promise<Banner | null> => {
  try {
    const banner = await prisma.banner.findFirst({
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

    if (!banner) {
      return null;
    }

    return {
      id: banner.id.toString(),
      title: banner.title,
      imageUrl: banner.image_url,
      isActive: banner.is_active,
      createdBy: banner.created_by.toString(),
      createdAt: banner.created_at.toISOString(),
      updatedAt: banner.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('Error fetching active banner', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get all banners (admin access)
 */
export const getAllBanners = async (): Promise<Banner[]> => {
  try {
    const banners = await prisma.banner.findMany({
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

    return banners.map((banner) => ({
      id: banner.id.toString(),
      title: banner.title,
      imageUrl: banner.image_url,
      isActive: banner.is_active,
      createdBy: banner.created_by.toString(),
      createdAt: banner.created_at.toISOString(),
      updatedAt: banner.updated_at.toISOString(),
    }));
  } catch (error: any) {
    logger.error('Error fetching all banners', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get banner by ID
 */
export const getBannerById = async (bannerId: string): Promise<Banner> => {
  try {
    const banner = await prisma.banner.findUnique({
      where: {
        id: BigInt(bannerId),
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

    if (!banner) {
      throw new NotFoundError('Banner not found');
    }

    return {
      id: banner.id.toString(),
      title: banner.title,
      imageUrl: banner.image_url,
      isActive: banner.is_active,
      createdBy: banner.created_by.toString(),
      createdAt: banner.created_at.toISOString(),
      updatedAt: banner.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error fetching banner by ID', {
      error: error.message,
      bannerId,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Create a new banner
 */
export const createBanner = async (data: CreateBannerData): Promise<Banner> => {
  try {
    const banner = await prisma.banner.create({
      data: {
        title: data.title || null,
        image_url: data.imageUrl,
        is_active: false, // New banners are inactive by default
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

    logger.info('Banner created', {
      bannerId: banner.id.toString(),
    });

    return {
      id: banner.id.toString(),
      title: banner.title,
      imageUrl: banner.image_url,
      isActive: banner.is_active,
      createdBy: banner.created_by.toString(),
      createdAt: banner.created_at.toISOString(),
      updatedAt: banner.updated_at.toISOString(),
    };
  } catch (error: any) {
    logger.error('Error creating banner', {
      error: error.message,
      data,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Update a banner
 */
export const updateBanner = async (
  bannerId: string,
  data: UpdateBannerData
): Promise<Banner> => {
  try {
    // Check if banner exists
    const existingBanner = await prisma.banner.findUnique({
      where: {
        id: BigInt(bannerId),
      },
    });

    if (!existingBanner) {
      throw new NotFoundError('Banner not found');
    }

    // If setting this banner as active, deactivate all other banners
    if (data.isActive === true) {
      await prisma.banner.updateMany({
        where: {
          is_active: true,
          id: { not: BigInt(bannerId) },
        },
        data: {
          is_active: false,
        },
      });
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title || null;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const banner = await prisma.banner.update({
      where: {
        id: BigInt(bannerId),
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

    logger.info('Banner updated', {
      bannerId: banner.id.toString(),
    });

    return {
      id: banner.id.toString(),
      title: banner.title,
      imageUrl: banner.image_url,
      isActive: banner.is_active,
      createdBy: banner.created_by.toString(),
      createdAt: banner.created_at.toISOString(),
      updatedAt: banner.updated_at.toISOString(),
    };
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error updating banner', {
      error: error.message,
      bannerId,
      data,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Delete a banner
 */
export const deleteBanner = async (bannerId: string): Promise<void> => {
  try {
    const banner = await prisma.banner.findUnique({
      where: {
        id: BigInt(bannerId),
      },
    });

    if (!banner) {
      throw new NotFoundError('Banner not found');
    }

    // Extract filename from image_url
    const imageUrl = banner.image_url;
    const filename = imageUrl.split('/').pop() || '';
    
    // Delete the file from filesystem
    if (filename) {
      try {
        deleteFile(filename, 'banners');
      } catch (fileError) {
        logger.warn('Error deleting banner file', {
          filename,
          error: fileError,
        });
      }
    }

    await prisma.banner.delete({
      where: {
        id: BigInt(bannerId),
      },
    });

    logger.info('Banner deleted', {
      bannerId,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error deleting banner', {
      error: error.message,
      bannerId,
      stack: error.stack,
    });
    throw error;
  }
};
