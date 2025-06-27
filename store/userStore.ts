import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserType, TrustedContactType, VerificationDocumentType } from '@/types';

interface UserState {
  user: UserType | null;
  isLoggedIn: boolean;
  trustedContacts: TrustedContactType[];
  verificationDocuments: VerificationDocumentType[];
  setUser: (user: UserType | null) => void;
  login: (userData: UserType) => void;
  logout: () => void;
  addTrustedContact: (contact: TrustedContactType) => void;
  removeTrustedContact: (contactId: string) => void;
  updateVerificationLevel: (level: 'pending' | 'basic' | 'trusted' | 'certified') => void;
  addVerificationDocument: (document: VerificationDocumentType) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      trustedContacts: [],
      verificationDocuments: [],
      setUser: (user) => set({ user }),
      login: (userData) => set({ user: userData, isLoggedIn: true }),
      logout: () => set({ user: null, isLoggedIn: false }),
      addTrustedContact: (contact) => 
        set((state) => ({ 
          trustedContacts: [...state.trustedContacts, contact] 
        })),
      removeTrustedContact: (contactId) => 
        set((state) => ({ 
          trustedContacts: state.trustedContacts.filter(c => c.id !== contactId) 
        })),
      updateVerificationLevel: (level) =>
        set((state) => ({
          user: state.user ? { ...state.user, verificationLevel: level } : null
        })),
      addVerificationDocument: (document) =>
        set((state) => ({
          verificationDocuments: [...state.verificationDocuments, document]
        })),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);