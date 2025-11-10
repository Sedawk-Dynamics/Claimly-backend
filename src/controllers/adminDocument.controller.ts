import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middlewares/adminAuth.middleware';
import {
  verifyUserDocument,
  verifyPolicyDocument,
  verifyNomineeDocument,
  rejectUserDocument,
  rejectPolicyDocument,
  rejectNomineeDocument,
  getKycDocuments,
} from '../services/adminDocument.service';

export const verifyDocumentController = async (
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
    const { documentType } = req.body; // 'user', 'policy', or 'nominee'

    let verifiedDocument;

    switch (documentType) {
      case 'user':
        verifiedDocument = await verifyUserDocument(id, req.admin.adminId);
        break;
      case 'policy':
        verifiedDocument = await verifyPolicyDocument(id, req.admin.adminId);
        break;
      case 'nominee':
        verifiedDocument = await verifyNomineeDocument(id, req.admin.adminId);
        break;
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid documentType. Must be one of: user, policy, nominee',
        });
        return;
    }

    res.status(200).json({
      success: true,
      data: verifiedDocument,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectDocumentController = async (
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
    const { documentType } = req.body; // 'user', 'policy', or 'nominee'

    let rejectedDocument;

    switch (documentType) {
      case 'user':
        rejectedDocument = await rejectUserDocument(id, req.admin.adminId);
        break;
      case 'policy':
        rejectedDocument = await rejectPolicyDocument(id, req.admin.adminId);
        break;
      case 'nominee':
        rejectedDocument = await rejectNomineeDocument(id, req.admin.adminId);
        break;
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid documentType. Must be one of: user, policy, nominee',
        });
        return;
    }

    res.status(200).json({
      success: true,
      data: rejectedDocument,
    });
  } catch (error) {
    next(error);
  }
};

export const getKycDocumentsController = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);
    const statusQuery = ((req.query.status as string) || 'pending').toLowerCase();
    const status = statusQuery === 'verified' ? 'verified' : 'pending';

    const result = await getKycDocuments(page, limit, status);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


