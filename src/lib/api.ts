import { toast } from "sonner";

// API Configuration
// Use VITE_API_URL from .env, fallback to 8000, and force IPv4 for Node v17+ compatibility.
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('localhost', '127.0.0.1');

// Helper function for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  // Attach tenant id from localStorage for tenant-specific DB isolation
  let tenantId: string | null = null;
  try {
    const raw = localStorage.getItem('ajms.auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      tenantId = parsed?.tenantId ?? null;
    }
  } catch {}

  const extraHeaders: Record<string, string> = {};
  if (tenantId) extraHeaders['x-tenant-id'] = tenantId;

  // Ensure the final URL is correctly formed, especially if VITE_API_URL is just a base domain.
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`[Frontend API Request] ${options.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body as string) : '');
  
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
        ...options.headers,
      },
      ...options,
    });
  } catch (err: any) {
    console.error(`[Frontend API Network Error] ${url}:`, err);
    throw new Error(`Network Error: Cannot connect to the backend server. Is it running?`);
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    const errorData = isJson ? await response.json() : await response.text();
    const errorPayload = isJson ? errorData : { message: errorData };
    console.error(`[Frontend API Error] ${url} ${response.status} ${response.statusText}:`, errorPayload);
    const errorMessage = isJson
      ? (errorData.error || errorData.message || JSON.stringify(errorData))
      : `API Error: Endpoint may not exist (${response.status})`;
    toast.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!isJson) {
    throw new Error(`API Error: Expected JSON but received HTML. The backend endpoint ${endpoint} likely does not exist yet.`);
  }

  const data = await response.json();
  console.log(`[Frontend API Response] ${url}:`, data);
  return data;
};

// Customer API
export const customerAPI = {
  getAll: () => apiCall('/customers'),
  getById: (id: string) => apiCall(`/customers/${id}`),
  create: (data: any) => apiCall('/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/customers/${id}`, { method: 'DELETE' }),
};

// Supplier API
export const supplierAPI = {
  getAll: () => apiCall('/suppliers'),
  getById: (id: string) => apiCall(`/suppliers/${id}`),
  create: (data: any) => apiCall('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/suppliers/${id}`, { method: 'DELETE' }),
};

// Inventory API
export const inventoryAPI = {
  getAll: () => apiCall('/inventory'),
  getById: (id: string) => apiCall(`/inventory/${id}`),
  create: (data: any) => apiCall('/inventory', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/inventory/${id}`, { method: 'DELETE' }),
};

// Sales API
export const salesAPI = {
  getAll: () => apiCall('/sales'),
  getById: (id: string) => apiCall(`/sales/${id}`),
  create: (data: any) => apiCall('/sales', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/sales/${id}`, { method: 'DELETE' }),
};

// Purchases API
export const purchasesAPI = {
  getAll: () => apiCall('/purchases'),
  getById: (id: string) => apiCall(`/purchases/${id}`),
  create: (data: any) => apiCall('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/purchases/${id}`, { method: 'DELETE' }),
};

// Expenses API
export const expensesAPI = {
  getAll: () => apiCall('/expenses'),
  getById: (id: string) => apiCall(`/expenses/${id}`),
  create: (data: any) => apiCall('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/expenses/${id}`, { method: 'DELETE' }),
};

// Karigars API
export const karigarsAPI = {
  getAll: () => apiCall('/karigars'),
  getById: (id: string) => apiCall(`/karigars/${id}`),
  create: (data: any) => apiCall('/karigars', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/karigars/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/karigars/${id}`, { method: 'DELETE' }),
};

// Jobwork API
export const jobworkAPI = {
  getAll: () => apiCall('/jobwork'),
  getById: (id: string) => apiCall(`/jobwork/${id}`),
  create: (data: any) => apiCall('/jobwork', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/jobwork/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/jobwork/${id}`, { method: 'DELETE' }),
};

// Repairs API
export const repairsAPI = {
  getAll: () => apiCall('/repairs'),
  getById: (id: string) => apiCall(`/repairs/${id}`),
  create: (data: any) => apiCall('/repairs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/repairs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/repairs/${id}`, { method: 'DELETE' }),
};
// Invoices API
export const invoicesAPI = {
  getAll: () => apiCall('/invoices'),
  getById: (id: string) => apiCall(`/invoices/${id}`),
  create: (data: any) => apiCall('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/invoices/${id}`, { method: 'DELETE' }),
};
// Gold Rates API
export const goldRatesAPI = {
  getAll: () => apiCall('/gold-rates'),
  getById: (id: string) => apiCall(`/gold-rates/${id}`),
  create: (data: any) =>
    apiCall('/gold-rates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiCall(`/gold-rates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/gold-rates/${id}`, { method: 'DELETE' }),
};

// Schemes API
export const schemesAPI = {
  getAll: () => apiCall('/schemes'),
  getById: (id: string) => apiCall(`/schemes/${id}`),
  create: (data: any) => apiCall('/schemes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/schemes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/schemes/${id}`, { method: 'DELETE' }),
};

// Advances API
export const advancesAPI = {
  getAll: () => apiCall('/advances'),
  getById: (id: string) => apiCall(`/advances/${id}`),
  create: (data: any) => apiCall('/advances', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/advances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/advances/${id}`, { method: 'DELETE' }),
};

// Girvi API
export const girviAPI = {
  getAll: () => apiCall('/girvi'),
  getById: (id: string) => apiCall(`/girvi/${id}`),
  create: (data: any) => {
    const payload = { ...data };
    delete payload.id;
    delete payload._id;
    return apiCall('/girvi', { method: 'POST', body: JSON.stringify(payload) });
  },
  update: (id: string, data: any) => {
    const payload = { ...data };
    delete payload.id;
    delete payload._id;
    return apiCall(`/girvi/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  delete: (id: string) => apiCall(`/girvi/${id}`, { method: 'DELETE' }),
};

// Orders API
export const ordersAPI = {
  getAll: () => apiCall('/orders'),
  getById: (id: string) => apiCall(`/orders/${id}`),
  create: (data: any) => {
    const payload = { ...data };
    delete payload.id;
    delete payload._id;
    return apiCall('/orders', { method: 'POST', body: JSON.stringify(payload) });
  },
  update: (id: string, data: any) => {
    const payload = { ...data };
    delete payload.id;
    delete payload._id;
    return apiCall(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  delete: (id: string) => apiCall(`/orders/${id}`, { method: 'DELETE' }),
};

// Employees API
export const employeesAPI = {
  getAll: () => apiCall('/employees'),
  getById: (id: string) => apiCall(`/employees/${id}`),
  create: (data: any) => apiCall('/employees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/employees/${id}`, { method: 'DELETE' }),
};
