// Read-only primary-instance verification. Baseline captures hashes, never data/secrets.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {localRuntime} from './local-sandbox.mjs';
import {captureUpgrade,verifyUpgrade} from './upgrade-snapshot.mjs';
const c=new pg.Client({connectionString:localRuntime().toString()});await c.connect();
const baselineFile='reports/governance-primary-before.json';let passed=0;
const policies=async()=>(await c.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
const job=async()=>(await c.query("select jobid,schedule,command,username,active from cron.job where jobname='ngajitrack-expire-enrollments'")).rows;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
try{
 await c.query('begin read only');
 if(process.argv.includes('--baseline')){
  const versions=(await c.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version);
  assert.equal(versions.length,10,'Expected existing migrations 1-10');
  await writeFile(baselineFile,JSON.stringify({snapshot:await captureUpgrade(c),policies:await policies(),job:await job(),versions},null,2));console.log('Primary pre-apply baseline saved (hashes only)');
 }else{
  const baseline=JSON.parse(await readFile(baselineFile,'utf8'));
  await check('all pre-existing public/private/Auth data preserved',()=>verifyUpgrade(c,baseline.snapshot));
  await check('all eleven migrations recorded',async()=>assert.deepEqual((await c.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version),(await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort().map(x=>x.split('_')[0])));
  await check('existing RLS policies retained and scheduler unchanged',async()=>{const current=await policies();for(const policy of baseline.policies)assert.ok(current.some(p=>JSON.stringify(p)===JSON.stringify(policy)));assert.deepEqual(await job(),baseline.job);});
  await check('scheduler retains only expiry execution and no private table privileges',async()=>{assert.deepEqual((await c.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('ngt_expiry_scheduler',p.oid,'EXECUTE')")).rows,[{proname:'expire_institution_enrollments'}]);assert.equal((await c.query("select count(*)::int n from pg_tables where schemaname in ('public','private') and has_table_privilege('ngt_expiry_scheduler',format('%I.%I',schemaname,tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')")).rows[0].n,0);});
  await check('private workflow tables use RLS and deny direct client/server CRUD',async()=>{for(const role of ['anon','authenticated','service_role']){const rows=(await c.query("select tablename from pg_tables where schemaname='private' and has_table_privilege($1,format('%I.%I',schemaname,tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')",[role])).rows;assert.deepEqual(rows,[]);}assert.equal((await c.query("select count(*)::int n from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='private' and t.relkind='r' and not t.relrowsecurity")).rows[0].n,0);});
  await check('client cannot issue verified invitations or bind identities',async()=>{for(const role of ['anon','authenticated'])for(const signature of ['public.issue_verified_invitation(uuid,uuid,text,uuid,text,uuid,uuid,uuid,integer)','public.link_verified_student_identity(uuid,uuid,text)'])assert.equal((await c.query("select has_function_privilege($1,$2,'EXECUTE') ok",[role,signature])).rows[0].ok,false);});
  await check('actual authenticated role obeys tenant RLS on primary fixture',async()=>{
   const admin=(await c.query("select p.auth_user_id,m.institution_id from public.institution_members m join public.roles r on r.id=m.role_id join public.profiles p on p.id=m.profile_id where r.code='INSTITUTION_ADMIN' and m.status='ACTIVE' order by m.institution_id limit 1")).rows[0];assert.ok(admin);
   await c.query("select set_config('request.jwt.claim.sub',$1,true)",[admin.auth_user_id]);await c.query('set local role authenticated');
   try{const rows=(await c.query('select distinct institution_id from public.institution_enrollments')).rows;assert.deepEqual(rows,[{institution_id:admin.institution_id}]);}finally{await c.query('reset role');}
  });
  await check('primary Auth health and anonymous PostgREST denial',async()=>{
   const runtime=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
   const api=new URL(runtime.API_URL);assert.ok(['127.0.0.1','localhost'].includes(api.hostname));assert.equal(api.port,'54321');
   assert.equal((await fetch(new URL('/auth/v1/health',api),{headers:{apikey:runtime.ANON_KEY}})).status,200);
   assert.equal((await fetch(new URL('/rest/v1/institution_enrollments',api),{headers:{apikey:runtime.ANON_KEY}})).status,401);
  });
  await check('academic backfill complete; no guessed levels or leadership appointments',async()=>{
   assert.equal((await c.query("select count(*)::int n from public.programs p where not exists(select 1 from public.program_learning_types t where t.program_id=p.id and t.learning_type_id=p.program_type_id and t.is_active)")).rows[0].n,0);
   assert.equal((await c.query('select count(*)::int n from public.groups where program_level_id is not null')).rows[0].n,0);
   assert.equal((await c.query('select count(*)::int n from private.membership_scopes')).rows[0].n,0);
   assert.equal((await c.query("select count(*)::int n from pg_indexes where indexname='one_active_mudir'")).rows[0].n,1);
  });
  console.log(passed+'/'+passed+' primary governance checks passed');
 }
}finally{await c.query('rollback');await c.end();}
