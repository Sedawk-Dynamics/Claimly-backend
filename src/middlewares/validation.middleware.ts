import { Request, Response, NextFunction } from 'express';

export const validateVerifyOTP = (req: Request, res: Response, next: NextFunction): void => {
  const { idToken, mobileNumber } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({
      success: false,
      error: 'idToken is required and must be a string',
    });
    return;
  }

  if (!mobileNumber || typeof mobileNumber !== 'string') {
    res.status(400).json({
      success: false,
      error: 'mobileNumber is required and must be a string',
    });
    return;
  }

  // Validate mobile number format (basic validation)
  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobileNumber.replace(/[^0-9]/g, ''))) {
    res.status(400).json({
      success: false,
      error: 'Invalid mobile number format',
    });
    return;
  }

  next();
};

export const validateUpdateProfile = (req: Request, res: Response, next: NextFunction): void => {
  const { name, dob, email, deviceId } = req.body;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    res.status(400).json({
      success: false,
      error: 'name must be a non-empty string',
    });
    return;
  }

  if (dob !== undefined) {
    if (typeof dob !== 'string') {
      res.status(400).json({
        success: false,
        error: 'dob must be a string in YYYY-MM-DD format',
      });
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dob)) {
      res.status(400).json({
        success: false,
        error: 'dob must be in YYYY-MM-DD format',
      });
      return;
    }
    const date = new Date(dob);
    if (isNaN(date.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
      return;
    }
  }

  if (email !== undefined && email !== null) {
    if (typeof email !== 'string') {
      res.status(400).json({
        success: false,
        error: 'email must be a string or null',
      });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }
  }

  if (deviceId !== undefined && deviceId !== null && typeof deviceId !== 'string') {
    res.status(400).json({
      success: false,
      error: 'deviceId must be a string or null',
    });
    return;
  }

  next();
};

export const validateCreatePolicy = (req: Request, res: Response, next: NextFunction): void => {
  const { insuranceCompanyId, policyNumber, sumAssured } = req.body;

  if (!insuranceCompanyId || typeof insuranceCompanyId !== 'string') {
    res.status(400).json({
      success: false,
      error: 'insuranceCompanyId is required and must be a string',
    });
    return;
  }

  if (!policyNumber || typeof policyNumber !== 'string' || policyNumber.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'policyNumber is required and must be a non-empty string',
    });
    return;
  }

  if (!sumAssured || typeof sumAssured !== 'string') {
    res.status(400).json({
      success: false,
      error: 'sumAssured is required and must be a string',
    });
    return;
  }

  const sumAssuredNum = parseFloat(sumAssured);
  if (isNaN(sumAssuredNum) || sumAssuredNum <= 0) {
    res.status(400).json({
      success: false,
      error: 'sumAssured must be a positive number',
    });
    return;
  }

  next();
};

export const validateCreateNominee = (req: Request, res: Response, next: NextFunction): void => {
  const { name, relationship, mobileNumber } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'name is required and must be a non-empty string',
    });
    return;
  }

  const validRelationships = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER'];
  if (!relationship || !validRelationships.includes(relationship)) {
    res.status(400).json({
      success: false,
      error: `relationship is required and must be one of: ${validRelationships.join(', ')}`,
    });
    return;
  }

  if (!mobileNumber || typeof mobileNumber !== 'string') {
    res.status(400).json({
      success: false,
      error: 'mobileNumber is required and must be a string',
    });
    return;
  }

  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(mobileNumber.replace(/[^0-9]/g, ''))) {
    res.status(400).json({
      success: false,
      error: 'Invalid mobile number format',
    });
    return;
  }

  if (req.body.email !== undefined && req.body.email !== null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (req.body.email && !emailRegex.test(req.body.email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }
  }

  next();
};

export const validateLinkNominee = (req: Request, res: Response, next: NextFunction): void => {
  const { nomineeId, sharePercentage } = req.body;

  if (!nomineeId || typeof nomineeId !== 'string') {
    res.status(400).json({
      success: false,
      error: 'nomineeId is required and must be a string',
    });
    return;
  }

  if (!sharePercentage || typeof sharePercentage !== 'string') {
    res.status(400).json({
      success: false,
      error: 'sharePercentage is required and must be a string',
    });
    return;
  }

  const share = parseFloat(sharePercentage);
  if (isNaN(share) || share <= 0 || share > 100) {
    res.status(400).json({
      success: false,
      error: 'sharePercentage must be a number between 0 and 100',
    });
    return;
  }

  next();
};

export const validateUploadDocument = (req: Request, res: Response, next: NextFunction): void => {
  const { documentType, documentName, documentUrl } = req.body;

  const validTypes = ['POLICY_COPY', 'RECEIPT', 'OTHER'];
  if (!documentType || !validTypes.includes(documentType)) {
    res.status(400).json({
      success: false,
      error: `documentType is required and must be one of: ${validTypes.join(', ')}`,
    });
    return;
  }

  if (!documentName || typeof documentName !== 'string' || documentName.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'documentName is required and must be a non-empty string',
    });
    return;
  }

  if (!documentUrl || typeof documentUrl !== 'string' || documentUrl.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'documentUrl is required and must be a non-empty string',
    });
    return;
  }

  next();
};

export const validateAdminLogin = (req: Request, res: Response, next: NextFunction): void => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({
      success: false,
      error: 'email is required and must be a string',
    });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({
      success: false,
      error: 'Invalid email format',
    });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({
      success: false,
      error: 'password is required and must be a string',
    });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({
      success: false,
      error: 'password must be at least 6 characters long',
    });
    return;
  }

  next();
};

// validateCreateAlert removed - using zod schema validation instead

export const validateVerifyAlert = (req: Request, res: Response, next: NextFunction): void => {
  const { verificationStatus, remarks } = req.body;

  const validStatuses = ['VERIFIED', 'FALSE_ALERT'];
  if (!verificationStatus || !validStatuses.includes(verificationStatus)) {
    res.status(400).json({
      success: false,
      error: `verificationStatus is required and must be one of: ${validStatuses.join(', ')}`,
    });
    return;
  }

  if (remarks !== undefined && typeof remarks !== 'string') {
    res.status(400).json({
      success: false,
      error: 'remarks must be a string',
    });
    return;
  }

  next();
};

