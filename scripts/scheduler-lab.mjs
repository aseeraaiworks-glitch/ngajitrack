import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import {root,localRuntime,fingerprint} from './local-sandbox.mjs';
export async function schedulerLab(){
 const source=new pg.Client({connectionString:localRuntime().toString()});await source.connect();const before=await fingerprint(source);
 const name='ngt-scheduler-test-'+randomBytes(6).toString('hex');let id,db;
 const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024,...options});
 try{
  const image=docker(['inspect','supabase_db_ngajitrack','--format','{{.Config.Image}}']).trim();
  const boot=`initdb -D /tmp/ngt/data --auth-local=trust --auth-host=scram-sha-256 >/tmp/ngt/init.log && printf 'local all all trust\nhost postgres ngt_expiry_scheduler 127.0.0.1/32 trust\nhost all all 0.0.0.0/0 scram-sha-256\n' > /tmp/ngt/data/pg_hba.conf && exec postgres -D /tmp/ngt/data -c shared_preload_libraries=pg_cron -c cron.database_name=postgres -c cron.use_background_workers=off -c cron.host=127.0.0.1 -c listen_addresses='*'`;
  id=docker(['run','--detach','--name',name,'--user','postgres','--tmpfs','/tmp/ngt:rw,mode=1777','-p','127.0.0.1::5432','--entrypoint','bash',image,'-c',boot]).trim();
  const sql=text=>docker(['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:text});
  let ready=false;for(let i=0;i<90;i++){try{sql('select 1');ready=true;break;}catch{await setTimeout(500);}}if(!ready)throw Error('Isolated PostgreSQL did not start');
  const password=randomBytes(32).toString('hex');sql(`alter role postgres password '${password}'; create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin noinherit;`);
  const port=JSON.parse(docker(['inspect',name]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
  const config={host:'127.0.0.1',port:Number(port),database:'postgres',user:'postgres',password,connectionTimeoutMillis:3000};
  db=new pg.Client(config);await db.connect();
  let auth=docker(['exec','supabase_db_ngajitrack','pg_dump','-U','postgres','-d','postgres','--schema=auth','--schema-only','--no-owner','--no-privileges']);auth=auth.replace(/^CREATE TRIGGER on_auth_user_created[^\r\n]*[\r\n]*/m,'');sql(auth);
  const files=(await readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')&&f.slice(0,14)<='20260924000700').sort();for(const f of files)await db.query(await readFile(new URL('supabase/migrations/'+f,root),'utf8'));
  return {name,db,query:(s,p)=>db.query(s,p),exec:s=>db.query(s),config,async connect(){const c=new pg.Client(config);await c.connect();return c;},async close(){await db.end();docker(['rm','--force','--volumes',id]);const after=await fingerprint(source);await source.end();if(before!==after)throw Error('Primary fixture changed');console.log('Primary fixture unchanged; isolated container removed');}};
 }catch(e){if(db)await db.end();if(id)docker(['rm','--force','--volumes',id]);await source.end();throw e;}
}
