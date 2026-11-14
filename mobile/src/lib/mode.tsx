import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { HelpMode } from './types';

const KEY = 'hereo.mode';

/**
 * Here-O routes a request to any nearby guardian; Her-O routes it only to
 * verified women guardians. The choice is remembered on this device.
 */
const ModeContext = createContext<{ mode: HelpMode; setMode: (m: HelpMode) => void }>({
  mode: 'here_o',
  setMode: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<HelpMode>('here_o');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'her_o' || v === 'here_o') setModeState(v);
    });
  }, []);
  const setMode = (m: HelpMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
