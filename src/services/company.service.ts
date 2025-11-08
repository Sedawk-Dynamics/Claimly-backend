import prisma from '../config/prismaClient';

export interface PublicCompany {
  id: string;
  name: string;
  contactEmail: string | null;
  contactNumber: string | null;
  websiteUrl: string | null;
  address: string | null;
}

export const getActiveCompanies = async (): Promise<PublicCompany[]> => {
  const companies = await prisma.insuranceCompany.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      contact_email: true,
      contact_number: true,
      website_url: true,
      address: true,
    },
  });

  return companies.map((company) => ({
    id: company.id.toString(),
    name: company.name,
    contactEmail: company.contact_email,
    contactNumber: company.contact_number,
    websiteUrl: company.website_url,
    address: company.address,
  }));
};


