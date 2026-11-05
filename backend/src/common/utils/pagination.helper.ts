// src/common/utils/pagination.helper.ts

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export type PaginateOptions = {
  /** Kata kunci pencarian (opsional) */
  search?: string;
  /** Field string yang dicari; dukung relasi via dot-path, mis. 'category.name' */
  searchFields?: string[];
};

/** Bangun filter Prisma contains dari dot-path "a.b.c" */
function buildContains(path: string, keyword: string) {
  const parts = path.split('.');
  let node: unknown = { contains: keyword, mode: 'insensitive' as const };
  for (let i = parts.length - 1; i >= 0; i--) node = { [parts[i]]: node };
  return node as object;
}

type ItemOf<P> = P extends Promise<(infer U)[]> ? U : never;

/**
 * paginate(delegate, args, page, limit, opts?)
 * - delegate: prisma.<model> (punya findMany & count)
 * - args    : argumen findMany (where/orderBy/select/include/...)
 * - page    : 1-based
 * - limit   : items per page
 * - opts    : { search, searchFields }
 */
export async function paginate<
  TDelegate extends {
    findMany: (args: any) => Promise<any[]>;
    count: (args: any) => Promise<number>;
  },
  TArgs extends Parameters<TDelegate['findMany']>[0],
  TItem = ItemOf<ReturnType<TDelegate['findMany']>>,
>(
  delegate: TDelegate,
  args: TArgs,
  page: number,
  limit: number,
  opts?: PaginateOptions,
): Promise<PaginationResult<TItem>> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 10);
  const skip = (safePage - 1) * safeLimit;

  // base where dari args (jika ada)
  const baseWhere = (args as { where?: unknown })?.where;

  // where untuk pencarian
  let combinedWhere = baseWhere;
  if (opts?.search && opts.searchFields?.length) {
    const OR = opts.searchFields.map((f) => buildContains(f, opts.search!));
    const searchWhere = { OR } as unknown;
    combinedWhere = baseWhere
      ? ({ AND: [baseWhere, searchWhere] } as unknown)
      : searchWhere;
  }

  // Guard opsional: Prisma melarang select & include bersamaan
  if (
    (args as any)?.select !== undefined &&
    (args as any)?.include !== undefined
  ) {
    throw new Error(
      'Cannot use both `select` and `include` in the same query.',
    );
  }

  const [data, total] = await Promise.all([
    delegate.findMany({
      ...(args as object),
      where: combinedWhere,
      skip,
      take: safeLimit,
    }),
    delegate.count(
      combinedWhere ? ({ where: combinedWhere } as any) : ({} as any),
    ),
  ]);

  return {
    data: data as TItem[],
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      hasNext: skip + (data?.length ?? 0) < total,
    },
  };
}
