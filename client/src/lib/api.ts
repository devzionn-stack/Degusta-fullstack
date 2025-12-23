// API helper functions that include tenant context for super admin

export function buildApiUrl(baseUrl: string, tenantId: string | null): string {
  if (!tenantId) return baseUrl;
  
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}tenantId=${tenantId}`;
}

export async function fetchWithTenant(
  url: string, 
  tenantId: string | null, 
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = buildApiUrl(url, tenantId);
  
  return fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
    },
  });
}
