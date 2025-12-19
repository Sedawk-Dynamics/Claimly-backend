import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function addReceiptUrlColumn() {
  try {
    console.log('Adding receipt_url column to Subscription table...');
    
    await prisma.$executeRaw`
      ALTER TABLE Subscription 
      ADD COLUMN receipt_url VARCHAR(191) NULL
    `;
    
    console.log('✅ Successfully added receipt_url column!');
  } catch (error: any) {
    if (error.message.includes('Duplicate column name')) {
      console.log('✅ Column receipt_url already exists. No changes needed.');
    } else {
      console.error('❌ Error adding column:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addReceiptUrlColumn();
