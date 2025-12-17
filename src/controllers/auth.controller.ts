import { Request, Response, NextFunction } from 'express';
import { verifyOTP } from '../services/auth.service';

export const verifyOTPController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken, mobileNumber, name, email, deviceId, referralCode } = req.body;

    // Clean up email - convert empty string to undefined
    const cleanedEmail = email && email.trim() !== '' ? email.trim() : undefined;

    // Log request for debugging (without sensitive data)
    console.log('Registration request received', {
      hasIdToken: !!idToken,
      mobileNumber: mobileNumber?.substring(0, 3) + '****',
      hasName: !!name,
      hasEmail: !!cleanedEmail,
    });

    const result = await verifyOTP({
      idToken,
      mobileNumber,
      name,
      email: cleanedEmail,
      deviceId,
      referralCode,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Log error before passing to error handler
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Registration error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};

