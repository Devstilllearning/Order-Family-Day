export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://ais-pre-rso3aurj5z4hvw4lzk3ghw-337459441300.asia-southeast1.run.app";
export const getSocketUrl = (): string => {
  return API_BASE_URL;
};
