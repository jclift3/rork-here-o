import { MentorType } from '@/types';

export const mockMentors: MentorType[] = [
  {
    id: '1',
    name: 'Sarah M.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
    category: 'career',
    expertise: 'Career Coaching',
  },
  {
    id: '2',
    name: 'Emily L.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
    category: 'personal',
    expertise: 'Personal Development',
  },
  {
    id: '3',
    name: 'Jessica R.',
    avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
    category: 'health',
    expertise: 'Health & Wellness',
  },
];

export const mockSkillSharing: SkillShareType[] = [
  {
    id: '1',
    userId: '1',
    user: {
      id: '1',
      name: 'Sarah M.',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
      gender: 'female',
      isVerified: true,
      joinedDate: '2021-01-15',
    },
    title: 'Resume Review',
    category: 'career',
    description: 'I can help review and improve your resume for job applications.',
  },
  {
    id: '2',
    userId: '2',
    user: {
      id: '2',
      name: 'Emily L.',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
      gender: 'female',
      isVerified: true,
      joinedDate: '2021-02-20',
    },
    title: 'Mindfulness Techniques',
    category: 'personal',
    description: 'Learn mindfulness techniques for stress reduction and better focus.',
  },
  {
    id: '3',
    userId: '3',
    user: {
      id: '3',
      name: 'Jessica R.',
      avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
      gender: 'female',
      isVerified: true,
      joinedDate: '2020-11-10',
    },
    title: 'Nutrition Advice',
    category: 'health',
    description: 'Get personalized nutrition advice for your health goals.',
  },
];