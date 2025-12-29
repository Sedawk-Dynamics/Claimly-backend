import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  createNominee,
  getUserNominees,
  getNomineeById,
  updateNominee,
  deleteNominee,
  createNomineeDraft,
} from '../services/nominee.service';

export const createNomineeController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, relationship, mobileNumber, dob, email, address, gender } = req.body;
    const isDraft = !relationship || !mobileNumber || !dob;

    const nominee = isDraft
      ? await createNomineeDraft(req.user.userId, {
          name,
          relationship,
          mobileNumber,
          dob,
          email,
          address,
          gender,
        })
      : await createNominee(req.user.userId, {
          name,
          relationship: relationship!,
          mobileNumber: mobileNumber!,
          dob: dob!,
          email,
          address,
          gender,
        });

    res.status(201).json({
      success: true,
      data: nominee,
    });
  } catch (error) {
    next(error);
  }
};

export const getNomineesController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const nominees = await getUserNominees(req.user.userId);
    res.status(200).json({
      success: true,
      data: nominees,
    });
  } catch (error) {
    next(error);
  }
};

export const getNomineeByIdController = async (
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
    const nominee = await getNomineeById(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: nominee,
    });
  } catch (error) {
    next(error);
  }
};

export const updateNomineeController = async (
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
    const { name, relationship, mobileNumber, dob, email, address, gender, documentsToDelete, status } = req.body;
    
    // Parse documentsToDelete if it's a string (from form data)
    let documentsToDeleteArray: string[] = [];
    if (documentsToDelete) {
      if (typeof documentsToDelete === 'string') {
        try {
          documentsToDeleteArray = JSON.parse(documentsToDelete);
        } catch {
          // If not JSON, treat as single ID
          documentsToDeleteArray = [documentsToDelete];
        }
      } else if (Array.isArray(documentsToDelete)) {
        documentsToDeleteArray = documentsToDelete;
      }
    }

    // Handle file uploads
    const files = (req.files as Express.Multer.File[]) || [];
    const documentsToAdd: any[] = [];
    const documentsToUpdate: any[] = [];
    
    // Process files
    files.forEach((file) => {
      const fieldName = file.fieldname;
      
      // New documents: fieldname should be "document" or "document[N]"
      if (fieldName === 'document' || fieldName.startsWith('document[')) {
        // Extract index if present (e.g., "document[0]" -> 0)
        const match = fieldName.match(/document\[?(\d+)?\]?/);
        const index = match ? match[1] : '';
        
        const documentType = req.body[`documentType${index}`] || req.body.documentType || 'OTHER';
        const documentName = req.body[`documentName${index}`] || req.body.documentName || file.originalname;
        
        documentsToAdd.push({
          documentType,
          documentName,
          filename: file.filename,
        });
      }
      
      // Update documents: fieldname should be "updateDocument" or "updateDocument[N]"
      if (fieldName === 'updateDocument' || fieldName.startsWith('updateDocument[')) {
        const match = fieldName.match(/updateDocument\[?(\d+)?\]?/);
        const index = match ? match[1] : '';
        
        const documentId = req.body[`updateDocumentId${index}`] || req.body.updateDocumentId;
        const documentType = req.body[`updateDocumentType${index}`] || req.body.updateDocumentType || 'OTHER';
        const documentName = req.body[`updateDocumentName${index}`] || req.body.updateDocumentName || file.originalname;
        
        if (documentId) {
          documentsToUpdate.push({
            documentId,
            documentType,
            documentName,
            filename: file.filename,
          });
        }
      }
    });

    const normalizedStatus =
      typeof status === 'string' && status.toUpperCase() === 'DRAFT' ? 'DRAFT' : undefined;

    const updatedNominee = await updateNominee(req.user.userId, id, {
      name,
      relationship,
      mobileNumber,
      dob,
      email,
      address,
      gender,
      status: normalizedStatus,
      documentsToAdd: documentsToAdd.length > 0 ? documentsToAdd : undefined,
      documentsToUpdate: documentsToUpdate.length > 0 ? documentsToUpdate : undefined,
      documentsToDelete: documentsToDeleteArray.length > 0 ? documentsToDeleteArray : undefined,
    });

    res.status(200).json({
      success: true,
      data: updatedNominee,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNomineeController = async (
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
    const result = await deleteNominee(req.user.userId, id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

