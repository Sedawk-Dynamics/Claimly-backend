import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import logger from '../config/logger';
import Razorpay from 'razorpay';

const RECEIPTS_DIR = path.join(process.cwd(), 'uploads', 'receipts');
const RECEIPT_SEQUENCE_FILE = path.join(RECEIPTS_DIR, 'receipt_sequence.json');
const CLAIMLY_LOGO_PATH = path.resolve(process.cwd(), 'logo', 'claimly logo png.png');
const TOTAL_ALPHA_COMBINATIONS = 26 * 26;
const MAX_NUMERIC_SEQUENCE = 9999;

interface ReceiptSequenceState {
  alphaIndex: number;
  numericSequence: number;
}

// Initialize Razorpay instance
let razorpayInstance: Razorpay | null = null;

function getRazorpayInstance(): Razorpay {
  if (!razorpayInstance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

const ensureReceiptsDirectory = (): void => {
  if (!fs.existsSync(RECEIPTS_DIR)) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  }
};

export const ensureLogoDirectory = (): void => {
  const logoDir = path.join(process.cwd(), 'logo');
  if (!fs.existsSync(logoDir)) {
    logger.warn('Logo directory does not exist, creating it', { logoDir });
    fs.mkdirSync(logoDir, { recursive: true });
  }
  
  // Log logo file status at startup
  const logoExists = fs.existsSync(CLAIMLY_LOGO_PATH);
  logger.info('Logo file check', {
    logoPath: CLAIMLY_LOGO_PATH,
    exists: logoExists,
    cwd: process.cwd(),
    logoDir,
    logoDirExists: fs.existsSync(logoDir),
  });
  
  if (logoExists) {
    try {
      const stats = fs.statSync(CLAIMLY_LOGO_PATH);
      logger.info('Logo file details', {
        logoPath: CLAIMLY_LOGO_PATH,
        size: stats.size,
        isFile: stats.isFile(),
      });
    } catch (error: any) {
      logger.error('Error reading logo file stats', {
        error: error.message,
        logoPath: CLAIMLY_LOGO_PATH,
      });
    }
  } else {
    logger.error('Logo file not found at expected path', {
      logoPath: CLAIMLY_LOGO_PATH,
      cwd: process.cwd(),
      logoDir,
    });
  }
};

const convertAlphaIndexToLetters = (index: number): string => {
  const safeIndex = Math.max(0, Math.min(index, TOTAL_ALPHA_COMBINATIONS - 1));
  const first = Math.floor(safeIndex / 26);
  const second = safeIndex % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
};

const readSequenceState = (): ReceiptSequenceState => {
  try {
    if (!fs.existsSync(RECEIPT_SEQUENCE_FILE)) {
      return { alphaIndex: 0, numericSequence: 0 };
    }
    const rawContent = fs.readFileSync(RECEIPT_SEQUENCE_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);
    const parsedAlphaIndex = Number(parsed?.alphaIndex);
    const parsedNumericSequence = Number(parsed?.numericSequence);
    return {
      alphaIndex: Number.isFinite(parsedAlphaIndex) ? parsedAlphaIndex : 0,
      numericSequence: Number.isFinite(parsedNumericSequence) ? parsedNumericSequence : 0,
    };
  } catch (error) {
    logger.warn('Unable to read receipt sequence state, using defaults', {
      error: error instanceof Error ? error.message : error,
    });
    return { alphaIndex: 0, numericSequence: 0 };
  }
};

const persistSequenceState = (state: ReceiptSequenceState): void => {
  try {
    ensureReceiptsDirectory();
    fs.writeFileSync(RECEIPT_SEQUENCE_FILE, JSON.stringify(state), { encoding: 'utf-8' });
  } catch (error) {
    logger.error('Unable to persist receipt sequence state', {
      error: error instanceof Error ? error.message : error,
    });
  }
};

const getNextAlphaNumericSuffix = (): { letters: string; digits: string } => {
  const state = readSequenceState();
  let { alphaIndex, numericSequence } = state;

  numericSequence += 1;
  if (numericSequence > MAX_NUMERIC_SEQUENCE) {
    numericSequence = 1;
    alphaIndex = (alphaIndex + 1) % TOTAL_ALPHA_COMBINATIONS;
  }

  persistSequenceState({ alphaIndex, numericSequence });

  return {
    letters: convertAlphaIndexToLetters(alphaIndex),
    digits: numericSequence.toString().padStart(4, '0'),
  };
};

const getISTDate = (): Date => {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const IST_OFFSET_MILLIS = 5.5 * 60 * 60 * 1000;
  return new Date(utcMillis + IST_OFFSET_MILLIS);
};

const formatISTDateForReceipt = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  // Return YYMMDD format (2-digit year)
  const year = date.getFullYear().toString().slice(-2);
  return year + pad(date.getMonth() + 1) + pad(date.getDate());
};

export interface ReceiptData {
  subscriptionId: string;
  receiptNumber: string; // Auto-generated receipt number
  userId: string;
  userName: string;
  userEmail: string | null;
  userPhone: string;
  orderId: string; // Razorpay Order ID or Apple IAP reference
  paymentId: string; // Razorpay Payment ID or Apple transaction ID
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
  planName: string;
  amount: number;
  currency: string;
  walletAmountUsed?: number;
  finalAmountPaid: number;
  transactionDate: Date;
  expiresAt?: Date | null;
  /** When 'iap', receipt shows "IAP"; otherwise "Razorpay" */
  paymentMethod?: 'razorpay' | 'iap';
}

/**
 * Generate a unique receipt number
 */
export const generateReceiptNumber = (): string => {
  try {
    ensureReceiptsDirectory();
    const istDate = getISTDate();
    const datePart = formatISTDateForReceipt(istDate);
    const suffix = getNextAlphaNumericSuffix();
    return `CLM${datePart}-${suffix.letters}${suffix.digits}`;
  } catch (error) {
    logger.error('Falling back to timestamp-based receipt number generation', {
      error: error instanceof Error ? error.message : error,
    });
    const fallbackRandom = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const day = new Date().getDate().toString().padStart(2, '0');
    return `CLM${year}${month}${day}-${fallbackRandom}`;
  }
};

/**
 * Get rupee symbol
 * Returns "Rs." which works with all PDFKit fonts
 */
const getRupeeSymbol = (): string => {
  return 'Rs.';
};

/**
 * Company information for receipts
 */
const COMPANY_INFO = {
  name: 'Tech Life Invention Pvt. Ltd.',
  address: [
    'Chandigarh, India'
  ],
  email: 'support@claimly.co.in',
  phone: '+91 1800-XXX-XXXX',
  gst: '', // GST number if available
  cin: '', // Add CIN if available
};

/**
 * Format date with day and time for receipt display (used at top)
 */
const formatDateWithTimeForReceipt = (date: Date): string => {
  const dayName = date.toLocaleDateString('en-IN', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `${dayName}, ${dateStr}, ${timeStr}`;
};

/**
 * Format date only for receipt display (used in other places)
 */
const formatDateOnlyForReceipt = (date: Date): string => {
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format date range for subscription period
 */
const formatDateRange = (startDate: Date, endDate: Date): string => {
  const start = startDate.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const end = endDate.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return `${start} – ${end}`;
};

/**
 * Generate a PDF receipt for subscription payment
 */
export const generateReceiptPDF = async (data: ReceiptData): Promise<string> => {
  try {
    ensureReceiptsDirectory();
    const fileName = `receipt-${data.receiptNumber}.pdf`;
    const filePath = path.join(RECEIPTS_DIR, fileName);
    
    logger.info('Generating receipt PDF', {
      receiptNumber: data.receiptNumber,
      fileName,
      filePath,
      subscriptionId: data.subscriptionId
    });

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Helper to format amounts with rupee symbol
    const formatAmountWithSymbol = (amount: number): string => {
      const rupeeSymbol = getRupeeSymbol();
      return `${rupeeSymbol} ${amount.toFixed(2)}`;
    };

    let yPos = 50;
    const pageWidth = 595; // A4 width in points
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    // Header Section - Receipt title and logo
    doc.fontSize(24).fillColor('#000000').text('Receipt', margin, yPos);
    
    // Invoice number and date
    const invoiceNumber = data.receiptNumber;
    const datePaid = formatDateWithTimeForReceipt(data.transactionDate);
    
    yPos += 30;
    doc.fontSize(10).fillColor('#666666');
    doc.text(`Invoice number ${invoiceNumber}`, margin, yPos);
    yPos += 15;
    doc.text(`Date paid ${datePaid}`, margin, yPos);
    yPos += 20;

    // Logo on the right side
    const brandLogoAvailable = fs.existsSync(CLAIMLY_LOGO_PATH);
    const logoSize = 80;
    const logoX = pageWidth - margin - logoSize;
    const logoY = 50;
    
    if (brandLogoAvailable) {
      try {
        doc.image(CLAIMLY_LOGO_PATH, logoX, logoY, { fit: [logoSize, logoSize] });
        logger.info('Logo added to PDF successfully', { logoPath: CLAIMLY_LOGO_PATH });
      } catch (logoError: any) {
        logger.error('Error adding logo to PDF', {
          error: logoError.message,
          stack: logoError.stack,
          logoPath: CLAIMLY_LOGO_PATH,
        });
      }
    } else {
      logger.warn('Logo file not found, generating PDF without logo', {
        logoPath: CLAIMLY_LOGO_PATH,
        cwd: process.cwd(),
      });
    }

    // Two-column layout: Company info (left) and Bill to (right)
    yPos = 150;
    const leftColX = margin;
    const rightColX = margin + (contentWidth / 2) + 20;
    const colWidth = (contentWidth / 2) - 20;

    // Left column - Company information
    doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold');
    doc.text(COMPANY_INFO.name, leftColX, yPos);
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    yPos += 15;
    
    COMPANY_INFO.address.forEach((line) => {
      doc.text(line, leftColX, yPos);
      yPos += 12;
    });
    
    doc.text(COMPANY_INFO.phone, leftColX, yPos);
    yPos += 12;
    doc.text(COMPANY_INFO.email, leftColX, yPos);
    yPos += 12;
    if (COMPANY_INFO.gst) {
      doc.text(COMPANY_INFO.gst, leftColX, yPos);
    }

    // Right column - Bill to (Customer information)
    yPos = 150;
    doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold');
    doc.text('Bill to', rightColX, yPos);
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    yPos += 15;
    
    doc.text(data.userName, rightColX, yPos);
    yPos += 12;
    if (data.userEmail) {
      doc.text(data.userEmail, rightColX, yPos);
      yPos += 12;
    }
    doc.text(`+91 ${data.userPhone}`, rightColX, yPos);

    // Payment summary statement
    yPos = 250;
    doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold');
    const datePaidOnly = formatDateOnlyForReceipt(data.transactionDate);
    const paymentSummary = `${formatAmountWithSymbol(data.finalAmountPaid)} paid on ${datePaidOnly}`;
    doc.text(paymentSummary, margin, yPos);
    yPos += 30;

    // Line items table
    const tableTop = yPos;
    const tableLeft = margin;
    const tableWidth = contentWidth;
    
    // Table header
    doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
    doc.text('Description', tableLeft, tableTop);
    doc.text('Qty', tableLeft + 200, tableTop);
    doc.text('Unit price', tableLeft + 250, tableTop);
    doc.text('Amount', tableLeft + 350, tableTop, { align: 'right', width: 100 });
    
    yPos = tableTop + 20;
    doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).strokeColor('#cccccc').lineWidth(0.5).stroke();
    yPos += 15;

    // Subscription line item (lifetime = never expires)
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    const subscriptionPeriod = data.expiresAt
      ? formatDateRange(data.transactionDate, data.expiresAt)
      : `${formatDateOnlyForReceipt(data.transactionDate)} — Never expires`;
    
    doc.text(data.planName, tableLeft, yPos);
    yPos += 12;
    doc.fontSize(9).fillColor('#666666');
    doc.text(subscriptionPeriod, tableLeft, yPos);
    yPos += 15;
    
    doc.fontSize(10).fillColor('#333333');
    doc.text('1', tableLeft + 200, yPos - 15);
    doc.text(formatAmountWithSymbol(data.amount), tableLeft + 250, yPos - 15);
    doc.text(formatAmountWithSymbol(data.amount), tableLeft + 350, yPos - 15, { align: 'right', width: 100 });
    
    yPos += 20;
    doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).strokeColor('#cccccc').lineWidth(0.5).stroke();
    yPos += 15;

    // Totals section
    doc.fontSize(10).fillColor('#333333');
    doc.text('Subtotal', tableLeft + 300, yPos);
    doc.text(formatAmountWithSymbol(data.amount), tableLeft + 350, yPos, { align: 'right', width: 100 });
    yPos += 15;
    
    // Show wallet discount if applicable
    if (data.walletAmountUsed && data.walletAmountUsed > 0) {
      doc.text('Wallet Discount', tableLeft + 300, yPos);
      doc.fillColor('#10b981');
      const rupeeSymbol = getRupeeSymbol();
      doc.text(`-${rupeeSymbol} ${data.walletAmountUsed.toFixed(2)}`, tableLeft + 350, yPos, { align: 'right', width: 100 });
      doc.fillColor('#333333');
      yPos += 15;
    }
    
    doc.font('Helvetica-Bold');
    doc.text('Total', tableLeft + 300, yPos);
    doc.text(formatAmountWithSymbol(data.finalAmountPaid), tableLeft + 350, yPos, { align: 'right', width: 100 });
    yPos += 15;
    
    doc.text('Amount paid', tableLeft + 300, yPos);
    doc.text(formatAmountWithSymbol(data.finalAmountPaid), tableLeft + 350, yPos, { align: 'right', width: 100 });
    yPos += 30;

    // Payment history section
    doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold');
    doc.text('Payment history', margin, yPos);
    yPos += 20;

    // Payment history table
    const paymentTableTop = yPos;
    doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
    doc.text('Payment method', tableLeft, paymentTableTop);
    doc.text('Date', tableLeft + 150, paymentTableTop);
    doc.text('Amount paid', tableLeft + 250, paymentTableTop);
    doc.text('Receipt number', tableLeft + 350, paymentTableTop);
    
    yPos = paymentTableTop + 15;
    doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).strokeColor('#cccccc').lineWidth(0.5).stroke();
    yPos += 15;

    // Payment entry: show IAP for Apple In-App Purchase, Razorpay otherwise
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    const paymentMethodLabel = data.paymentMethod === 'iap' ? 'IAP' : 'Razorpay';
    doc.text(paymentMethodLabel, tableLeft, yPos);
    doc.text(datePaidOnly, tableLeft + 150, yPos);
    doc.text(formatAmountWithSymbol(data.finalAmountPaid), tableLeft + 250, yPos);
    doc.text(invoiceNumber, tableLeft + 350, yPos);
    yPos += 30;

    // Footer section with company legal info
    doc.moveTo(margin, yPos).lineTo(margin + contentWidth, yPos).strokeColor('#cccccc').lineWidth(0.5).stroke();
    yPos += 15;
    
    doc.fontSize(9).fillColor('#666666');
    doc.text(COMPANY_INFO.name, margin, yPos);
    if (COMPANY_INFO.cin) {
      yPos += 12;
      doc.text(`CIN: ${COMPANY_INFO.cin}`, margin, yPos);
    }
    yPos += 20;

    // Additional footer text
    doc.fontSize(9).fillColor('#999999');
    const footerText = `This is a computer-generated receipt and does not require a signature. For any queries, please contact our support team at ${COMPANY_INFO.email}.`;
    doc.text(footerText, margin, yPos, { align: 'left', width: contentWidth });
    yPos += 30;

    // Finalize PDF
    doc.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    logger.info('Receipt PDF generated successfully', { filePath, subscriptionId: data.subscriptionId });

    // Return relative path for URL
    return `/uploads/receipts/${fileName}`;
  } catch (error: any) {
    logger.error('Error generating receipt PDF', {
      error: error.message,
      stack: error.stack,
      subscriptionId: data.subscriptionId,
    });
    throw error;
  }
};

/**
 * Get Razorpay receipt/invoice URL if available
 */
export const getRazorpayReceiptURL = async (paymentId: string): Promise<string | null> => {
  try {
    const razorpay = getRazorpayInstance();
    const payment = await razorpay.payments.fetch(paymentId);
    
    // Razorpay provides invoice link if invoice was generated
    // Check if invoice_id exists in payment details
    if ((payment as any).invoice_id) {
      // Fetch invoice details
      const invoice = await razorpay.invoices.fetch((payment as any).invoice_id);
      if (invoice.short_url) {
        return invoice.short_url;
      }
      if ((invoice as any).invoice_url) {
        return (invoice as any).invoice_url;
      }
    }
    
    // Return Razorpay payment page URL as fallback
    return `https://dashboard.razorpay.com/app/payments/${paymentId}`;
  } catch (error: any) {
    logger.error('Error fetching Razorpay receipt URL', {
      error: error.message,
      paymentId,
    });
    return null;
  }
};
