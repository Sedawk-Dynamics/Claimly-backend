import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  uploadPolicyDocument,
  getPolicyDocuments,
  getPolicyDocumentById,
  updatePolicyDocument,
  deletePolicyDocument,
} from '../services/policyDocument.service';

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

    const { policyId } = req.params;
    const { documentType } = req.body;
    const documents = [];

    // Process each file
    for (const file of files) {
      const document = await uploadPolicyDocument(req.user.userId, policyId, {
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

    const { policyId } = req.params;
    const documents = await getPolicyDocuments(req.user.userId, policyId);
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

    const { policyId, documentId } = req.params;
    const document = await getPolicyDocumentById(req.user.userId, policyId, documentId);
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

    const { policyId, documentId } = req.params;
    const { documentType, documentName } = req.body;
    const document = await updatePolicyDocument(req.user.userId, policyId, documentId, {
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

    const { policyId, documentId } = req.params;
    const result = await deletePolicyDocument(req.user.userId, policyId, documentId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

