export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

export const getSocketUrl = (): string => {
  return API_BASE_URL || window.location.origin;
};
