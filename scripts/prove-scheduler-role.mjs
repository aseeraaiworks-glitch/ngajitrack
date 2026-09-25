import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
import {schedulerLab} from './scheduler-lab.mjs';
import {makeFixture} from '../tests/fixture.mjs';
const s=await schedulerLab();
try{
 const f=await makeFixture(s);
 await s.query(`create extension pg_cron; create role ngt_expiry_scheduler login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;
 grant usage on schema public to ngt_expiry_scheduler;
 grant execute on function public.expire_institution_enrollments(integer) to ngt_expiry_scheduler;
 select cron.schedule_in_database('ngt-role-proof','1 second','select public.expire_institution_enrollments(500)',current_database(),'ngt_expiry_scheduler');
 revoke all on schema cron from public,anon,authenticated,authenticator,ngt_expiry_scheduler;
 revoke all on all functions in schema cron from public,anon,authenticated,authenticator,ngt_expiry_scheduler;`);
 await s.query("update public.institution_enrollments set enrollment_type='HOLIDAY',scheduled_end_at=current_date-1 where id=$1",[f.ie.a1.id]);
 let done=false;for(let i=0;i<30;i++){if((await s.query('select status from public.institution_enrollments where id=$1',[f.ie.a1.id])).rows[0].status==='ENDED'){done=true;break;}await setTimeout(1000);}assert.ok(done,'Dedicated cron role must execute worker');
 const role=(await s.query("select rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls from pg_roles where rolname='ngt_expiry_scheduler'")).rows[0];assert.ok(Object.values(role).every(v=>v===false));
 assert.equal((await s.query("select count(*)::int n from pg_tables where schemaname='public' and has_table_privilege('ngt_expiry_scheduler',format('%I.%I',schemaname,tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')")).rows[0].n,0);
 const c=await s.connect();try{await c.query('set session authorization ngt_expiry_scheduler');await assert.rejects(c.query('select * from public.institution_enrollments'),e=>e.code==='42501');await assert.rejects(c.query("select cron.schedule('illegal','1 second','select 1')"),e=>e.code==='42501');await assert.rejects(c.query('set role service_role'),e=>e.code==='42501');}finally{await c.end();}
 console.log('PASS dedicated-role mechanism: real periodic expiry, no table privileges, no cron administration');
}finally{await s.close();}
