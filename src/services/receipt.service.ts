import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import logger from '../config/logger';
import Razorpay from 'razorpay';

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

export interface ReceiptData {
  subscriptionId: string;
  receiptNumber: string; // Auto-generated receipt number
  userId: string;
  userName: string;
  userEmail: string | null;
  userPhone: string;
  orderId: string; // Razorpay Order ID
  paymentId: string; // Razorpay Payment ID
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
  planName: string;
  amount: number;
  currency: string;
  walletAmountUsed?: number;
  finalAmountPaid: number;
  transactionDate: Date;
  expiresAt?: Date | null;
}

/**
 * Generate a unique receipt number
 */
export const generateReceiptNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CLM-${timestamp}-${random}`;
};

/**
 * Get rupee symbol
 * Returns "Rs." which works with all PDFKit fonts
 */
const getRupeeSymbol = (): string => {
  return 'Rs.';
};


/**
 * Generate a PDF receipt for subscription payment
 */
export const generateReceiptPDF = async (data: ReceiptData): Promise<string> => {
  try {
    // Create receipts directory if it doesn't exist
    const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const fileName = `receipt_${data.subscriptionId}_${Date.now()}.pdf`;
    const filePath = path.join(receiptsDir, fileName);

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

    // Header Section
    doc.fontSize(28).fillColor('#0ea5e9').text('Claimly', 50, yPos, { align: 'left' });
    yPos += 35;
    doc.fontSize(20).fillColor('#0f172a').text('Payment Receipt', 50, yPos, { align: 'left' });
    yPos += 40;

    // Line separator
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();
    yPos += 20;

    // Receipt Number Section
    doc.fontSize(14).fillColor('#0f172a').text('Receipt Number:', 50, yPos);
    doc.fontSize(14).fillColor('#64748b').text(data.receiptNumber, 200, yPos);
    yPos += 25;

    // Payment Information Section
    doc.fontSize(16).fillColor('#0f172a').text('Payment Information', 50, yPos);
    yPos += 25;

    // Two-column layout for payment details
    const leftCol = 50;
    const rightCol = 300;
    
    doc.fontSize(11).fillColor('#64748b');
    doc.text('Order ID:', leftCol, yPos);
    doc.text(data.orderId, leftCol + 80, yPos);
    doc.text('Payment ID:', rightCol, yPos);
    doc.text(data.paymentId, rightCol + 80, yPos);
    yPos += 20;

    doc.text('Payment Status:', leftCol, yPos);
    doc.fontSize(11).fillColor(data.paymentStatus === 'SUCCESS' ? '#10b981' : '#f59e0b');
    doc.text(data.paymentStatus, leftCol + 100, yPos);
    doc.fontSize(11).fillColor('#64748b');
    doc.text('Payment Method:', rightCol, yPos);
    doc.text('Razorpay', rightCol + 100, yPos);
    yPos += 20;

    doc.text('Currency:', leftCol, yPos);
    doc.text(data.currency, leftCol + 80, yPos);
    doc.text('Date & Time:', rightCol, yPos);
    doc.text(
      `${data.transactionDate.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })} ${data.transactionDate.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`,
      rightCol + 100,
      yPos
    );
    yPos += 30;

    // Line separator
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();
    yPos += 20;

    // Customer Details Section
    doc.fontSize(16).fillColor('#0f172a').text('Customer Details', 50, yPos);
    yPos += 25;

    doc.fontSize(11).fillColor('#64748b');
    doc.text('Name:', leftCol, yPos);
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(data.userName, leftCol + 50, yPos);
    yPos += 20;

    doc.fontSize(11).fillColor('#64748b');
    doc.text('User ID:', leftCol, yPos);
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(data.userId, leftCol + 70, yPos);
    yPos += 20;

    if (data.userEmail) {
      doc.fontSize(11).fillColor('#64748b');
      doc.text('Email:', leftCol, yPos);
      doc.fontSize(11).fillColor('#0f172a');
      doc.text(data.userEmail, leftCol + 55, yPos);
      yPos += 20;
    }

    doc.fontSize(11).fillColor('#64748b');
    doc.text('Phone:', leftCol, yPos);
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(`+91 ${data.userPhone}`, leftCol + 60, yPos);
    yPos += 30;

    // Line separator
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();
    yPos += 20;

    // Subscription Details Section
    doc.fontSize(16).fillColor('#0f172a').text('Subscription Details', 50, yPos);
    yPos += 25;

    doc.fontSize(11).fillColor('#64748b');
    doc.text('Plan Name:', leftCol, yPos);
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(data.planName, leftCol + 90, yPos);
    yPos += 20;

    if (data.expiresAt) {
      doc.fontSize(11).fillColor('#64748b');
      doc.text('Expires On:', leftCol, yPos);
      doc.fontSize(11).fillColor('#0f172a');
      doc.text(data.expiresAt.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }), leftCol + 90, yPos);
      yPos += 25;
    } else {
      yPos += 5;
    }

    // Line separator
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();
    yPos += 20;

    // Amount Details Section
    doc.fontSize(16).fillColor('#0f172a').text('Amount Details', 50, yPos);
    yPos += 25;

    doc.fontSize(11).fillColor('#64748b');
    doc.text('Subscription Amount:', leftCol, yPos);
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(formatAmountWithSymbol(data.amount), 450, yPos, { align: 'right', width: 95 });
    yPos += 20;

    if (data.walletAmountUsed && data.walletAmountUsed > 0) {
      doc.fontSize(11).fillColor('#64748b');
      doc.text('Wallet Amount Used:', leftCol, yPos);
      doc.fontSize(11).fillColor('#10b981');
      const rupeeSymbol = getRupeeSymbol();
      doc.text(`${rupeeSymbol}-${data.walletAmountUsed.toFixed(2)}`, 450, yPos, { align: 'right', width: 95 });
      yPos += 20;
    }

    // Final amount with emphasis
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();
    yPos += 15;
    doc.fontSize(13).fillColor('#64748b').text('Total Amount Paid:', leftCol, yPos);
    doc.fontSize(18).fillColor('#10b981');
    doc.text(formatAmountWithSymbol(data.finalAmountPaid), 450, yPos, { align: 'right', width: 95 });
    yPos += 35;

    // Footer Section
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();
    yPos += 20;

    doc.fontSize(10).fillColor('#94a3b8');
    doc.text('This is a computer-generated receipt and does not require a signature.', 50, yPos, { align: 'center', width: 495 });
    yPos += 15;
    doc.text('Thank you for your subscription!', 50, yPos, { align: 'center', width: 495 });
    yPos += 15;
    doc.text('For any queries, please contact our support team.', 50, yPos, { align: 'center', width: 495 });
    yPos += 20;

    // Razorpay branding (optional)
    doc.fontSize(9).fillColor('#cbd5e1');
    doc.text('Powered by Razorpay', 50, yPos, { align: 'right', width: 495 });

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
