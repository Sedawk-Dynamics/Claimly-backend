import prisma from '../config/prismaClient';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

export interface LinkNomineeToPolicyData {
  nomineeId: string;
  sharePercentage: string;
}

export const linkNomineeToPolicy = async (
  userId: string,
  policyId: string,
  data: LinkNomineeToPolicyData
) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Verify nominee exists and belongs to user
  const nominee = await prisma.nominee.findFirst({
    where: {
      id: BigInt(data.nomineeId),
      user_id: BigInt(userId),
    },
  });

  if (!nominee) {
    throw new NotFoundError('Nominee not found');
  }

  // Check if nominee is already linked to this policy
  const existingLink = await prisma.policyNominee.findFirst({
    where: {
      policy_id: BigInt(policyId),
      nominee_id: BigInt(data.nomineeId),
    },
  });

  if (existingLink) {
    throw new ConflictError('Nominee is already linked to this policy');
  }

  // Validate share percentage
  const sharePercentage = parseFloat(data.sharePercentage);
  if (isNaN(sharePercentage) || sharePercentage <= 0 || sharePercentage > 100) {
    throw new ValidationError('Share percentage must be between 0 and 100');
  }

  // Check total share percentage for this policy
  const existingLinks = await prisma.policyNominee.findMany({
    where: { policy_id: BigInt(policyId) },
  });

  const totalShare = existingLinks.reduce((sum, link) => {
    return sum + parseFloat(link.share_percentage.toString());
  }, 0);

  if (totalShare + sharePercentage > 100) {
    throw new ValidationError(
      `Total share percentage cannot exceed 100%. Current total: ${totalShare}%, adding: ${sharePercentage}%`
    );
  }

  const link = await prisma.policyNominee.create({
    data: {
      policy_id: BigInt(policyId),
      nominee_id: BigInt(data.nomineeId),
      share_percentage: sharePercentage,
    },
    include: {
      nominee: {
        select: {
          id: true,
          name: true,
          relationship: true,
          mobile_number: true,
          email: true,
        },
      },
      policy: {
        select: {
          id: true,
          policy_number: true,
          sum_assured: true,
        },
      },
    },
  });

  return {
    id: link.id.toString(),
    policy: {
      id: link.policy.id.toString(),
      policyNumber: link.policy.policy_number,
      sumAssured: link.policy.sum_assured.toString(),
    },
    nominee: {
      id: link.nominee.id.toString(),
      name: link.nominee.name,
      relationship: link.nominee.relationship,
      mobileNumber: link.nominee.mobile_number,
      email: link.nominee.email,
    },
    sharePercentage: link.share_percentage.toString(),
    createdAt: link.created_at,
  };
};

export const updateNomineeShare = async (
  userId: string,
  policyId: string,
  nomineeId: string,
  sharePercentage: string
) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Verify link exists
  const link = await prisma.policyNominee.findFirst({
    where: {
      policy_id: BigInt(policyId),
      nominee_id: BigInt(nomineeId),
    },
  });

  if (!link) {
    throw new NotFoundError('Nominee is not linked to this policy');
  }

  // Validate share percentage
  const newShare = parseFloat(sharePercentage);
  if (isNaN(newShare) || newShare <= 0 || newShare > 100) {
    throw new ValidationError('Share percentage must be between 0 and 100');
  }

  // Check total share percentage for this policy (excluding current link)
  const existingLinks = await prisma.policyNominee.findMany({
    where: {
      policy_id: BigInt(policyId),
      nominee_id: { not: BigInt(nomineeId) },
    },
  });

  const totalShare = existingLinks.reduce((sum, existingLink) => {
    return sum + parseFloat(existingLink.share_percentage.toString());
  }, 0);

  if (totalShare + newShare > 100) {
    throw new ValidationError(
      `Total share percentage cannot exceed 100%. Current total: ${totalShare}%, new share: ${newShare}%`
    );
  }

  const updatedLink = await prisma.policyNominee.update({
    where: { id: link.id },
    data: { share_percentage: newShare },
    include: {
      nominee: {
        select: {
          id: true,
          name: true,
          relationship: true,
        },
      },
    },
  });

  return {
    id: updatedLink.id.toString(),
    nominee: {
      id: updatedLink.nominee.id.toString(),
      name: updatedLink.nominee.name,
      relationship: updatedLink.nominee.relationship,
    },
    sharePercentage: updatedLink.share_percentage.toString(),
    createdAt: updatedLink.created_at,
  };
};

export const unlinkNomineeFromPolicy = async (
  userId: string,
  policyId: string,
  nomineeId: string
) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  // Verify link exists
  const link = await prisma.policyNominee.findFirst({
    where: {
      policy_id: BigInt(policyId),
      nominee_id: BigInt(nomineeId),
    },
  });

  if (!link) {
    throw new NotFoundError('Nominee is not linked to this policy');
  }

  await prisma.policyNominee.delete({
    where: { id: link.id },
  });

  return { message: 'Nominee unlinked from policy successfully' };
};

export const getPolicyNominees = async (userId: string, policyId: string) => {
  // Verify policy exists and belongs to user
  const policy = await prisma.policy.findFirst({
    where: {
      id: BigInt(policyId),
      user_id: BigInt(userId),
    },
  });

  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  const links = await prisma.policyNominee.findMany({
    where: { policy_id: BigInt(policyId) },
    include: {
      nominee: {
        select: {
          id: true,
          name: true,
          relationship: true,
          mobile_number: true,
          email: true,
          address: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const totalShare = links.reduce((sum, link) => {
    return sum + parseFloat(link.share_percentage.toString());
  }, 0);

  return {
    policyId: policy.id.toString(),
    policyNumber: policy.policy_number,
    totalSharePercentage: totalShare.toFixed(2),
    nominees: links.map((link) => ({
      id: link.id.toString(),
      nominee: {
        id: link.nominee.id.toString(),
        name: link.nominee.name,
        relationship: link.nominee.relationship,
        mobileNumber: link.nominee.mobile_number,
        email: link.nominee.email,
        address: link.nominee.address,
      },
      sharePercentage: link.share_percentage.toString(),
      createdAt: link.created_at,
    })),
  };
};

