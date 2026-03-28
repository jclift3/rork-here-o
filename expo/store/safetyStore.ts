import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafePlaceType } from '@/types';

interface SafetyState {
  safetyCheckInActive: boolean;
  safetyCheckInEndTime: number | null;
  followMeActive: boolean;
  emergencyExitScheduled: boolean;
  emergencyExitTime: number | null;
  safePlaces: SafePlaceType[];
  codeWord: string;
  
  startSafetyCheckIn: (durationMinutes: number) => void;
  endSafetyCheckIn: () => void;
  startFollowMe: () => void;
  endFollowMe: () => void;
  scheduleEmergencyExit: (timeMs: number) => void;
  cancelEmergencyExit: () => void;
  setCodeWord: (word: string) => void;
  addSafePlace: (place: SafePlaceType) => void;
  removeSafePlace: (placeId: string) => void;
}

export const useSafetyStore = create<SafetyState>()(
  persist(
    (set) => ({
      safetyCheckInActive: false,
      safetyCheckInEndTime: null,
      followMeActive: false,
      emergencyExitScheduled: false,
      emergencyExitTime: null,
      safePlaces: [],
      codeWord: '',
      
      startSafetyCheckIn: (durationMinutes) => set({
        safetyCheckInActive: true,
        safetyCheckInEndTime: Date.now() + durationMinutes * 60 * 1000,
      }),
      
      endSafetyCheckIn: () => set({
        safetyCheckInActive: false,
        safetyCheckInEndTime: null,
      }),
      
      startFollowMe: () => set({ followMeActive: true }),
      
      endFollowMe: () => set({ followMeActive: false }),
      
      scheduleEmergencyExit: (timeMs) => set({
        emergencyExitScheduled: true,
        emergencyExitTime: timeMs,
      }),
      
      cancelEmergencyExit: () => set({
        emergencyExitScheduled: false,
        emergencyExitTime: null,
      }),
      
      setCodeWord: (word) => set({ codeWord: word }),
      
      addSafePlace: (place) => set((state) => ({
        safePlaces: [...state.safePlaces, place]
      })),
      
      removeSafePlace: (placeId) => set((state) => ({
        safePlaces: state.safePlaces.filter(place => place.id !== placeId)
      })),
    }),
    {
      name: 'safety-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);