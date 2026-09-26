// Local upgrade evidence: only column names, row IDs, counts and hashes escape queries.
import assert from 'node:assert/strict';
const quote=s=>'"'+s.replaceAll('"','""')+'"';
async function digest(db,t){
 const table=quote(t.schema)+'.'+quote(t.table);
 const projection=t.columns.map(quote).join(',');
 const where=t.append?' where id=any($1::uuid[])':'';
 return (await db.query(`select count(*)::int n,md5(coalesce(string_agg(to_jsonb(x)::text,E'\n' order by to_jsonb(x)::text),'')) hash from (select ${projection} from ${table}${where}) x`,t.append?[t.ids]:[])).rows[0];
}
export async function captureUpgrade(db){
 const tables=(await db.query("select schemaname schema,tablename \"table\" from pg_tables where schemaname in ('public','private') or (schemaname='auth' and tablename='users') order by 1,2")).rows;
 for(const t of tables){
  t.columns=(await db.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position',[t.schema,t.table])).rows.map(x=>x.column_name);
  t.append=t.schema==='public'&&['roles','audit_logs'].includes(t.table);
  if(t.append)t.ids=(await db.query(`select id from ${quote(t.schema)}.${quote(t.table)} order by id`)).rows.map(x=>x.id);
  t.digest=await digest(db,t);
 }
 return tables;
}
export async function verifyUpgrade(db,before){for(const t of before)assert.deepEqual(await digest(db,t),t.digest,`Existing ${t.schema}.${t.table} data changed`);}
