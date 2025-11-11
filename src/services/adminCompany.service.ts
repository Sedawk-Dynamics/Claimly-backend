import prisma from '../config/prismaClient';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import logger from '../config/logger';

export interface CreateCompanyData {
  name: string;
  contactEmail?: string;
  contactNumber?: string;
  websiteUrl?: string;
  address?: string;
}

export interface UpdateCompanyData {
  name?: string;
  contactEmail?: string;
  contactNumber?: string;
  websiteUrl?: string;
  address?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export const createCompany = async (data: CreateCompanyData) => {
  logger.info('Creating insurance company', { name: data.name });
  
  // Check if company name already exists
  const existingCompany = await prisma.insuranceCompany.findFirst({
    where: {
      name: data.name,
      status: 'ACTIVE',
    },
  });

  if (existingCompany) {
    throw new ConflictError('Company with this name already exists');
  }

  // Validate email if provided
  if (data.contactEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.contactEmail)) {
      throw new ValidationError('Invalid email format');
    }
  }

  // Validate URL if provided
  if (data.websiteUrl) {
    try {
      new URL(data.websiteUrl);
    } catch {
      throw new ValidationError('Invalid website URL format');
    }
  }

  const company = await prisma.insuranceCompany.create({
    data: {
      name: data.name,
      contact_email: data.contactEmail || null,
      contact_number: data.contactNumber || null,
      website_url: data.websiteUrl || null,
      address: data.address || null,
      status: 'ACTIVE',
    },
  });

  return {
    id: company.id.toString(),
    name: company.name,
    contactEmail: company.contact_email,
    contactNumber: company.contact_number,
    websiteUrl: company.website_url,
    address: company.address,
    status: company.status,
    createdAt: company.created_at,
    updatedAt: company.updated_at,
  };
};

export const getAllCompanies = async (page: number = 1, limit: number = 20, status?: 'ACTIVE' | 'INACTIVE', search?: string) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (search && search.trim()) {
    const searchTerm = search.trim();
    where.OR = [
      { name: { contains: searchTerm } },
      { contact_email: { contains: searchTerm } },
      { contact_number: { contains: searchTerm } },
      { website_url: { contains: searchTerm } },
      { address: { contains: searchTerm } },
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.insuranceCompany.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: {
            policies: true,
          },
        },
      },
    }),
    prisma.insuranceCompany.count({ where }),
  ]);

  return {
    companies: companies.map((company) => ({
      id: company.id.toString(),
      name: company.name,
      contactEmail: company.contact_email,
      contactNumber: company.contact_number,
      websiteUrl: company.website_url,
      address: company.address,
      status: company.status,
      policiesCount: company._count.policies,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getCompanyById = async (companyId: string) => {
  const company = await prisma.insuranceCompany.findUnique({
    where: { id: BigInt(companyId) },
    include: {
      policies: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        take: 10,
        orderBy: { uploaded_at: 'desc' },
      },
      _count: {
        select: {
          policies: true,
        },
      },
    },
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  return {
    id: company.id.toString(),
    name: company.name,
    contactEmail: company.contact_email,
    contactNumber: company.contact_number,
    websiteUrl: company.website_url,
    address: company.address,
    status: company.status,
    policiesCount: company._count.policies,
    createdAt: company.created_at,
    updatedAt: company.updated_at,
    recentPolicies: company.policies.map((policy) => ({
      id: policy.id.toString(),
      policyNumber: policy.policy_number,
      sumAssured: policy.sum_assured.toString(),
      status: policy.status,
      user: {
        id: policy.user.id.toString(),
        name: policy.user.name,
        email: policy.user.email,
      },
      uploadedAt: policy.uploaded_at,
    })),
  };
};

export const updateCompany = async (companyId: string, data: UpdateCompanyData) => {
  const company = await prisma.insuranceCompany.findUnique({
    where: { id: BigInt(companyId) },
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  // Check if name is being changed and if it's already taken
  if (data.name && data.name !== company.name) {
    const existingCompany = await prisma.insuranceCompany.findFirst({
      where: {
        name: data.name,
        id: { not: BigInt(companyId) },
        status: 'ACTIVE',
      },
    });

    if (existingCompany) {
      throw new ConflictError('Company with this name already exists');
    }
  }

  // Validate email if being updated
  if (data.contactEmail !== undefined) {
    if (data.contactEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.contactEmail)) {
        throw new ValidationError('Invalid email format');
      }
    }
  }

  // Validate URL if being updated
  if (data.websiteUrl !== undefined && data.websiteUrl) {
    try {
      new URL(data.websiteUrl);
    } catch {
      throw new ValidationError('Invalid website URL format');
    }
  }

  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.contactEmail !== undefined) updateData.contact_email = data.contactEmail || null;
  if (data.contactNumber !== undefined) updateData.contact_number = data.contactNumber || null;
  if (data.websiteUrl !== undefined) updateData.website_url = data.websiteUrl || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.status) updateData.status = data.status;

  const updatedCompany = await prisma.insuranceCompany.update({
    where: { id: BigInt(companyId) },
    data: updateData,
  });

  return {
    id: updatedCompany.id.toString(),
    name: updatedCompany.name,
    contactEmail: updatedCompany.contact_email,
    contactNumber: updatedCompany.contact_number,
    websiteUrl: updatedCompany.website_url,
    address: updatedCompany.address,
    status: updatedCompany.status,
    createdAt: updatedCompany.created_at,
    updatedAt: updatedCompany.updated_at,
  };
};

export const deleteCompany = async (companyId: string) => {
  const company = await prisma.insuranceCompany.findUnique({
    where: { id: BigInt(companyId) },
    include: {
      _count: {
        select: {
          policies: true,
        },
      },
    },
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  if (company._count.policies > 0) {
    throw new ValidationError('Cannot delete company with existing policies. Deactivate instead.');
  }

  await prisma.insuranceCompany.delete({
    where: { id: BigInt(companyId) },
  });

  return { message: 'Company deleted successfully' };
};

