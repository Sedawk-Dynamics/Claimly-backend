/**
 * Generate a unique referral code
 * Format: CLM + 7 characters = 10 characters total
 * Starts with "CLM" followed by 7 uppercase alphanumeric characters (excluding ambiguous chars like 0, O, I, L)
 */
export const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excluding 0, O, I, L, 1
  let code = 'CLM'; // Always start with CLM
  
  // Add 7 more characters to make total length 10
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
};

/**
 * Validate referral code format
 * Must start with "CLM" and be exactly 10 characters
 */
export const isValidReferralCodeFormat = (code: string): boolean => {
  return /^CLM[A-Z0-9]{7}$/.test(code.toUpperCase());
};

