import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  uploadNomineeDocument,
  getNomineeDocuments,
  getNomineeDocumentById,
  updateNomineeDocument,
  deleteNomineeDocument,
} from '../services/nomineeDocument.service';

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

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const { nomineeId } = req.params;
    const { documentType, documentName } = req.body;
    const document = await uploadNomineeDocument(req.user.userId, nomineeId, {
      documentType,
      documentName: documentName || req.file.originalname,
      filename: req.file.filename,
    });

    res.status(201).json({
      success: true,
      data: document,
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

    const { nomineeId } = req.params;
    const documents = await getNomineeDocuments(req.user.userId, nomineeId);
    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
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

    const { nomineeId, documentId } = req.params;
    const document = await getNomineeDocumentById(req.user.userId, nomineeId, documentId);
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

    const { nomineeId, documentId } = req.params;
    const { documentType, documentName } = req.body;
    const document = await updateNomineeDocument(req.user.userId, nomineeId, documentId, {
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

    const { nomineeId, documentId } = req.params;
    const result = await deleteNomineeDocument(req.user.userId, nomineeId, documentId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

