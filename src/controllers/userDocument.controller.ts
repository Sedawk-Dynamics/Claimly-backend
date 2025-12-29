import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  uploadUserDocument,
  getUserDocuments,
  getUserDocumentById,
  updateUserDocument,
  deleteUserDocument,
} from '../services/userDocument.service';

export const uploadDocumentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    
    if (files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
      return;
    }

    const { documentType } = req.body;
    const documents = [];

    // Process each file
    for (const file of files) {
      const document = await uploadUserDocument(req.user.userId, {
        documentType,
        documentName: file.originalname,
        filename: file.filename,
      });
      documents.push(document);
    }

    res.status(201).json({
      success: true,
      data: documents.length === 1 ? documents[0] : documents,
      count: documents.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getDocumentsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const documents = await getUserDocuments(req.user.userId);
    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    // Log the error for debugging
    const logger = (await import('../config/logger')).default;
    logger.error('Error in getDocumentsController', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.userId,
    });
    next(error);
  }
};

export const getDocumentByIdController = async (
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
    const document = await getUserDocumentById(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDocumentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const { id } = req.params;
    const { documentType, documentName } = req.body;
    const document = await updateUserDocument(req.user.userId, id, {
      documentType,
      documentName: documentName || req.file.originalname,
      filename: req.file.filename,
    });

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentController = async (
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
    const result = await deleteUserDocument(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

