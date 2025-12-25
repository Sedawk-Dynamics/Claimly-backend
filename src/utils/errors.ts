export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Safely converts a string to BigInt, validating that it's a valid numeric string
 * @param value - The string value to convert
 * @param fieldName - The name of the field (for error messages)
 * @returns The BigInt value
 * @throws ValidationError if the value is not a valid numeric string
 */
export function safeBigInt(value: string, fieldName: string = 'ID'): bigint {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a valid string`);
  }
  
  // Check if the string contains only digits (and optionally a leading minus sign)
  if (!/^-?\d+$/.test(value.trim())) {
    throw new ValidationError(`${fieldName} must be a valid numeric string`);
  }
  
  try {
    return BigInt(value.trim());
  } catch (error) {
    throw new ValidationError(`${fieldName} must be a valid numeric string`);
  }
}

