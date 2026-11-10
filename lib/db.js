import pg from 'pg';

let connection;

export function db() {
  connection ??= process.env.DATABASE_URL
    ? Promise.resolve(new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 }))
    : import('@electric-sql/pglite').then(({ PGlite }) => new PGlite('.local/talentmatch'));
  return connection;
}

export async function rows(sql, values = []) {
  return (await (await db()).query(sql, values)).rows;
}

export async function transaction(callback) {
  const database = await db();
  if (typeof database.transaction === 'function') return database.transaction(callback);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function close() {
  const database = await db();
  if (database.end) await database.end();
  else await database.close();
}
