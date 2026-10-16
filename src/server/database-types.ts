export interface SqlConnection {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

export interface SqlDatabase extends SqlConnection {
  transaction<T>(work: (tx: SqlConnection) => Promise<T>): Promise<T>;
}
