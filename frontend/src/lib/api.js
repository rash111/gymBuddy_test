import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("gb_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;

export const setToken = (t) => { if (t) localStorage.setItem("gb_token", t); };
export const clearToken = () => localStorage.removeItem("gb_token");
export const getToken = () => localStorage.getItem("gb_token");
