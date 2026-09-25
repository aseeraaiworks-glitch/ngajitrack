import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
export const root = new URL('../',import.meta.url);
export async function createDatabase({embedded=false,through=null}={}) {
  if (!embedded && process.env.NGAJITRACK_TEST_DATABASE_URL) {
    const url=new URL(process.env.NGAJITRACK_TEST_DATABASE_URL);
    if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw new Error('Native tests only allow a local disposable Supabase database');
    const client=new pg.Client({connectionString:url.toString()});
    await client.connect();
    try {
      const state=await client.query('select (select count(*) from public.profiles) profiles,(select count(*) from public.institutions) institutions');
      if (Number(state.rows[0].profiles)!==0 || Number(state.rows[0].institutions)!==0) throw new Error('Native tests require an empty, freshly migrated local database');
    } catch(error) {await client.end();throw error;}
    return {
      async query(sql,params=[]) {const r=await client.query(sql,params);return {...r,affectedRows:r.rowCount};},
      async exec(sql) {return client.query(sql);},
      async close() {try {await client.query('rollback');} finally {await client.end();}}
    };
  }
  const db = new PGlite();
  await db.exec(await readFile(new URL('tests/bootstrap.sql',root),'utf8'));
  // PGlite cannot load pg_cron; migration 8 is tested on a real isolated cluster.
  const migrations = (await readdir(new URL('supabase/migrations/',root))).filter(x=>x.endsWith('.sql') && x.slice(0,14)<='20260924000700' && (!through || x.slice(0,14)<=through)).sort();
  try {
    for (const file of migrations) {
      await db.exec('begin');
      try { await db.exec(await readFile(new URL(`supabase/migrations/${file}`,root),'utf8')); await db.exec('commit'); }
      catch(error) { await db.exec('rollback'); throw new Error(`Migration ${file}: ${error.message}`,{cause:error}); }
    }
  } catch(error) { await db.close(); throw error; }
  return db;
}
