export type UserType = {
  id: string;
  name: string;
  avatar: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  bio?: string;
  joinedDate: string;
  gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  isVerified: boolean;
  verificationLevel?: 'pending' | 'basic' | 'trusted' | 'certified';
  stats?: {
    assists: number;
    reports: number;
    communityEvents: number;
    contributions: number;
    posts: number;
    comments: number;
    reactions: number;
  };
  socialMedia?: {
    instagram?: string;
    twitter?: string;
  };
};

export type HelpRequestType = {
  id: string;
  userId: string;
  user: UserType;
  type: 'groceries' | 'ride' | 'emergency' | 'unsafe' | 'medical' | 'assistance' | 'other';
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: string;
  status: 'active' | 'in-progress' | 'completed' | 'cancelled';
  visibility: 'here-o' | 'her-o';
  isEmergency: boolean;
};

export type TrustedContactType = {
  id: string;
  name: string;
  avatar: string;
  relationship: 'friend' | 'family' | 'neighbor' | 'other';
  phoneNumber?: string;
};

export type SafePlaceType = {
  id: string;
  name: string;
  type: 'community-center' | 'shelter' | 'support-group' | 'business' | 'other';
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  rating: number;
  reviews: number;
  image: string;
};

export type SupportGroupType = {
  id: string;
  name: string;
  description: string;
  category: 'career' | 'family' | 'mental-health' | 'parenting' | 'financial' | 'other';
  members: number;
  image: string;
};

export type MentorType = {
  id: string;
  name: string;
  avatar: string;
  category: 'career' | 'personal' | 'health' | 'other';
  expertise: string;
};

export type SkillShareType = {
  id: string;
  userId: string;
  user: UserType;
  title: string;
  category: 'career' | 'personal' | 'health' | 'other';
  description: string;
};

export type VerificationDocumentType = {
  id: string;
  userId: string;
  type: 'id' | 'address' | 'background-check' | 'reference' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  documentUrl?: string;
};