/**
 * Shared list + pagination shape for HTTP APIs.
 */
export interface PaginationInfo {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ListResponse<T> {
  total: number;
  data: T[];
  paginationInfo: PaginationInfo;
}

export function buildListResponse<T>(
  data: T[],
  total: number,
  pageIndex: number,
  pageSize: number,
): ListResponse<T> {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  return {
    total,
    data,
    paginationInfo: {
      pageIndex,
      pageSize: safeSize,
      totalItems: total,
      totalPages,
    },
  };
}

/** All items as a single page (no server-side slice). */
export function buildFullListResponse<T>(data: T[]): ListResponse<T> {
  const total = data.length;
  const pageSize = total > 0 ? total : 1;
  return buildListResponse(data, total, 0, pageSize);
}
