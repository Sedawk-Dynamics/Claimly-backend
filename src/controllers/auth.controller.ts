import { Request, Response, NextFunction } from 'express';
import { verifyOTP } from '../services/auth.service';

export const verifyOTPController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken, mobileNumber, name, email, deviceId, referralCode } = req.body;

    const result = await verifyOTP({
      idToken,
      mobileNumber,
      name,
      email,
      deviceId,
      referralCode,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

