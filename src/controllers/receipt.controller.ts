import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../config/prismaClient';
import { NotFoundError } from '../utils/errors';
import logger from '../config/logger';
import path from 'path';
import fs from 'fs';

/**
 * Download receipt for a subscription
 * GET /subscription/:id/receipt
 */
export const downloadReceiptController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscriptionId = req.params.id;

    // Find subscription and verify it belongs to the user
    const subscription = await prisma.subscription.findUnique({
      where: { id: BigInt(subscriptionId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Verify subscription belongs to the authenticated user
    if (subscription.user_id.toString() !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. This subscription does not belong to you.' });
      return;
    }

    // Check if receipt URL exists
    if (!subscription.receipt_url) {
      res.status(404).json({ error: 'Receipt not available for this subscription' });
      return;
    }

    // All receipts are stored as local files in uploads/receipts/ directory
    // Receipt URL format: /uploads/receipts/receipt_xxx.pdf
    const filePath = path.join(process.cwd(), subscription.receipt_url.replace(/^\//, ''));
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error('Receipt file not found', { filePath, subscriptionId });
      res.status(404).json({ error: 'Receipt file not found' });
      return;
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${subscriptionId}.pdf"`);
    
    // Send file
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error('Error sending receipt file', { error: err.message, filePath });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error downloading receipt' });
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get receipt URL for a subscription
 * GET /subscription/:id/receipt-url
 */
export const getReceiptURLController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscriptionId = req.params.id;

    // Find subscription and verify it belongs to the user
    const subscription = await prisma.subscription.findUnique({
      where: { id: BigInt(subscriptionId) },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Verify subscription belongs to the authenticated user
    if (subscription.user_id.toString() !== req.user.userId) {
      res.status(403).json({ error: 'Access denied. This subscription does not belong to you.' });
      return;
    }

    if (!subscription.receipt_url) {
      res.status(404).json({ error: 'Receipt not available for this subscription' });
      return;
    }

    // Construct full URL for download
    const baseUrl = req.protocol + '://' + req.get('host');
    const receiptUrl = `${baseUrl}${subscription.receipt_url}`;

    res.status(200).json({
      success: true,
      data: {
        receiptUrl,
        downloadUrl: `${baseUrl}/subscription/${subscriptionId}/receipt`,
      },
    });
  } catch (error) {
    next(error);
  }
};
