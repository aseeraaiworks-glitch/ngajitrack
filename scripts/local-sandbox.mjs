import {execFileSync,spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
export const root=new URL('../',import.meta.url);
export function localRuntime(){
 const s=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const u=new URL(s.DB_URL);if(!['127.0.0.1','localhost'].includes(u.hostname)||u.port!=='54322'||u.pathname!=='/postgres')throw Error('Expected project local database');return u;
}
export async function fingerprint(client){
 const tables=(await client.query("select schemaname,tablename from pg_tables where schemaname='public' or (schemaname='auth' and tablename='users') order by 1,2")).rows;
 const hash=createHash('sha256');for(const t of tables){const name=`"${t.schemaname}"."${t.tablename}"`;const r=await client.query(`select md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) hash from ${name} t`);hash.update(name+r.rows[0].hash);}return hash.digest('hex');
}
export async function sandbox({through=null}={}){
 const base=localRuntime(),admin=new pg.Client({connectionString:base.toString()});await admin.connect();
 const before=await fingerprint(admin),name='ngt_test_'+randomUUID().replaceAll('-','');let db;
 try{
  await admin.query(`create database "${name}" template template0`);
  let auth=execFileSync('docker',['exec','supabase_db_ngajitrack','pg_dump','-U','postgres','-d','postgres','--schema=auth','--schema-only','--no-owner','--no-privileges'],{encoding:'utf8',maxBuffer:8*1024*1024});
  auth=auth.replace(/^CREATE TRIGGER on_auth_user_created[^\r\n]*[\r\n]*/m,'');
  execFileSync('docker',['exec','-i','supabase_db_ngajitrack','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d',name],{input:auth,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024});
  const url=new URL(base);url.pathname='/'+name;db=new pg.Client({connectionString:url.toString()});await db.connect();
  const files=(await readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')&&(!through||f.slice(0,14)<=through)).sort();
  for(const file of files){await db.query('begin');try{await db.query(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));await db.query('commit');}catch(e){await db.query('rollback');throw e;}}
  return {name,url,db,query:(s,p)=>db.query(s,p),exec:s=>db.query(s),async connect(){const c=new pg.Client({connectionString:url.toString()});await c.connect();await c.query("set statement_timeout='10s'");return c;},async close(){await db.end();await admin.query(`drop database "${name}"`);const after=await fingerprint(admin);await admin.end();if(after!==before)throw Error('Primary fixture fingerprint changed');console.log('Primary fixture fingerprint unchanged');}};
 }catch(e){if(db)await db.end();await admin.query(`drop database if exists "${name}"`);await admin.end();throw e;}
}
export async function runNode(args,env={}){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,...env}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Test process failed: '+code)));});}
