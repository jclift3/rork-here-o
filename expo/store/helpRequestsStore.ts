import { create } from 'zustand';
import { HelpRequestType } from '@/types';

interface HelpRequestsState {
  requests: HelpRequestType[];
  activeRequest: HelpRequestType | null;
  addRequest: (request: HelpRequestType) => void;
  updateRequest: (id: string, updates: Partial<HelpRequestType>) => void;
  deleteRequest: (id: string) => void;
  setActiveRequest: (request: HelpRequestType | null) => void;
  getRequestsByVisibility: (visibility: 'here-o' | 'her-o') => HelpRequestType[];
}

export const useHelpRequestsStore = create<HelpRequestsState>((set, get) => ({
  requests: [],
  activeRequest: null,
  addRequest: (request) => 
    set((state) => ({ 
      requests: [request, ...state.requests] 
    })),
  updateRequest: (id, updates) => 
    set((state) => ({ 
      requests: state.requests.map(req => 
        req.id === id ? { ...req, ...updates } : req
      ) 
    })),
  deleteRequest: (id) => 
    set((state) => ({ 
      requests: state.requests.filter(req => req.id !== id) 
    })),
  setActiveRequest: (request) => set({ activeRequest: request }),
  getRequestsByVisibility: (visibility) => {
    return get().requests.filter(req => req.visibility === visibility);
  },
}));