import { create } from "zustand";

interface SOSStore {
  showQuickModal: boolean;
  openQuickModal: () => void;
  closeQuickModal: () => void;
}

export const useSOSStore = create<SOSStore>((set) => ({
  showQuickModal: false,
  openQuickModal: () => set({ showQuickModal: true }),
  closeQuickModal: () => set({ showQuickModal: false }),
}));
