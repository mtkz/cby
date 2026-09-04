import { create } from 'zustand'
import type { Profile } from '../types/profile'

interface DetailState {
  profile: Profile | null
  openProfile: (profile: Profile) => void
  closeProfile: () => void
}

export const useDetailStore = create<DetailState>()((set) => ({
  profile: null,
  openProfile: (profile) => set({ profile }),
  closeProfile: () => set({ profile: null }),
}))