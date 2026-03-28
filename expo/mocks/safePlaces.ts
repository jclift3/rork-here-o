import { SafePlaceType } from '@/types';

export const mockSafePlaces: SafePlaceType[] = [
  {
    id: '1',
    name: 'Community Center',
    type: 'community-center',
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Market St, San Francisco, CA',
    },
    rating: 4.8,
    reviews: 125,
    image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
  },
  {
    id: '2',
    name: "Women's Shelter",
    type: 'shelter',
    location: {
      latitude: 37.7739,
      longitude: -122.4312,
      address: '456 Oak St, San Francisco, CA',
    },
    rating: 4.9,
    reviews: 210,
    image: 'https://images.unsplash.com/photo-1486304873000-235643847519?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
  },
  {
    id: '3',
    name: 'Support Group Meeting Point',
    type: 'support-group',
    location: {
      latitude: 37.7833,
      longitude: -122.4167,
      address: '789 Pine St, San Francisco, CA',
    },
    rating: 4.7,
    reviews: 85,
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
  },
];