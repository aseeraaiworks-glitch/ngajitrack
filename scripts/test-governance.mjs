import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {schedulerLab} from './scheduler-lab.mjs';
import {root} from './local-sandbox.mjs';
import {makeFixture} from '../tests/fixture.mjs';
import {setTimeout} from 'node:timers/promises';
import {captureUpgrade,verifyUpgrade} from './upgrade-snapshot.mjs';
const s=await schedulerLab();let f,passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const apply=async file=>{await s.query('begin');try{await s.query(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));await s.query('commit');}catch(e){await s.query('rollback');throw e;}};
async function as(who,sql,args=[]){const c=await s.connect();try{await c.query('set session authorization authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[f.users[who]]);return await c.query(sql,args);}finally{await c.end();}}
const deny=(who,sql,args=[],code='42501')=>assert.rejects(as(who,sql,args),e=>e.code===code);
const value=async(who,sql,args)=>(await as(who,sql,args)).rows[0].v;
async function invite(who,recipient,role,programs=null,caseId=null,expiry=null){return value(who,'select public.invite_leadership($1,$2,$3,$4,$5,$6) v',[f.institutions.A,f.profiles[recipient],role,programs,caseId,expiry]);}
const accept=(who,i)=>value(who,'select public.accept_provisioning_invitation($1) v',[i.token]);
try{
 for(const file of ['20260925000800_expiry_scheduler.sql','20260925000900_enrollment_approvals.sql','20260925001000_verified_provisioning.sql'])await apply(file);
 f=await makeFixture(s);await s.query('update auth.users set email_confirmed_at=now()');
 const oldInvite=(await s.query('select public.issue_verified_invitation($1,$2,$3,$4,$5) v',[f.institutions.B,f.profiles.guardian,'TEACHER',f.profiles.adminB,'Synthetic v10 verified recipient'])).rows[0].v;
 const before=(await s.query('select row_to_json(e) j from public.institution_enrollments e order by id')).rows;
 const allBefore=await captureUpgrade(s);
 await apply('20260926001100_academic_governance.sql');
 await check('all existing public/private/Auth rows retain original values across 10 to 11',()=>verifyUpgrade(s,allBefore));
 await check('upgrade preserves existing enrollment and leaves group levels null',async()=>{assert.deepEqual((await s.query('select row_to_json(e) j from public.institution_enrollments e order by id')).rows,before);assert.equal((await s.query('select count(*)::int n from public.groups where program_level_id is not null')).rows[0].n,0);assert.equal((await s.query('select count(*)::int n from public.program_learning_types')).rows[0].n,3);});
 await check('v10 invitation remains redeemable after native upgrade',async()=>{assert.equal((await accept('guardian',oldInvite)).role_code,'TEACHER');});
 const types=(await s.query('select id,code from public.program_types')).rows;const tahfiz=types.find(x=>x.code==='TAHFIZ').id,reading=types.find(x=>x.code==='QURAN_READING').id;
 await check('program supports multiple learning types without changing legacy primary',async()=>{await as('adminA','insert into public.program_learning_types(institution_id,program_id,learning_type_id) values($1,$2,$3)',[f.institutions.A,f.programs.a.id,reading]);assert.equal((await s.query('select count(*)::int n from public.program_learning_types where program_id=$1',[f.programs.a.id])).rows[0].n,2);await deny('adminA','update public.program_learning_types set is_active=false where program_id=$1 and learning_type_id=$2',[f.programs.a.id,tahfiz],'23514');});
 const level=(await as('adminA',"insert into public.institution_levels(institution_id,code,name) values($1,'MI','MI') returning id",[f.institutions.A])).rows[0].id;
 const pl=(await as('adminA','insert into public.program_levels(institution_id,program_id,level_id) values($1,$2,$3) returning id',[f.institutions.A,f.programs.a.id,level])).rows[0].id;
 await check('academic updates work without allowing tenant/context reassignment',async()=>{await as('adminA',"update public.institution_levels set name='MI/MIT' where id=$1",[level]);await as('adminA','update public.program_levels set is_active=false where id=$1',[pl]);await as('adminA','update public.program_levels set is_active=true where id=$1',[pl]);await deny('adminA','update public.program_levels set program_id=$1 where id=$2',[f.programs.aOther.id,pl],'23514');});
 await check('level reused across programs; cross-tenant relation rejected',async()=>{await as('adminA','insert into public.program_levels(institution_id,program_id,level_id) values($1,$2,$3)',[f.institutions.A,f.programs.aOther.id,level]);await deny('adminB','insert into public.program_levels(institution_id,program_id,level_id) values($1,$2,$3)',[f.institutions.B,f.programs.b.id,level],'23503');});
 await check('class history cannot be relabeled; new class may reference program level',async()=>{await deny('adminA','update public.groups set program_level_id=$1 where id=$2',[pl,f.groups.a1.id],'23514');await as('adminA',"insert into public.groups(institution_id,program_id,name,status,program_level_id) values($1,$2,'New MI','ACTIVE',$3)",[f.institutions.A,f.programs.a.id,pl]);});
 await check('first placement and class-level edit serialize without rewriting history',async()=>{
  const group=(await as('adminA',"insert into public.groups(institution_id,program_id,name,status) values($1,$2,'Concurrent class','ACTIVE') returning id",[f.institutions.A,f.programs.a.id])).rows[0].id;
  const a=await s.connect(),b=await s.connect();let pending;
  try{
   await a.query('begin');await a.query("insert into public.group_memberships(institution_id,program_enrollment_id,student_id,program_id,group_id,status) values($1,$2,$3,$4,$5,'COMPLETED')",[f.institutions.A,f.pe.a1.id,f.students.a1.id,f.programs.a.id,group]);
   await b.query('set session authorization authenticated');await b.query("select set_config('request.jwt.claim.sub',$1,false)",[f.users.adminA]);
   pending=b.query('update public.groups set program_level_id=$1 where id=$2',[pl,group]).then(()=>null,e=>e.code);
   let blocked=false;for(let n=0;n<200;n++){if((await s.query('select wait_event_type from pg_stat_activity where pid=$1',[b.processID])).rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await setTimeout(25);}
   assert.ok(blocked);await a.query('commit');assert.equal(await pending,'23514');
   assert.equal((await s.query('select program_level_id from public.groups where id=$1',[group])).rows[0].program_level_id,null);
  }finally{await a.query('rollback');if(pending)await pending;await a.end();await b.end();}
 });
 await check('admin cannot self-promote, use generic invitation or forge scope',async()=>{await deny('adminA',"insert into public.institution_members(institution_id,profile_id,role_id,status) select $1,$2,id,'ACTIVE' from public.roles where code='MUDIR'",[f.institutions.A,f.profiles.adminA]);await deny('adminA','insert into private.membership_scopes(institution_id) values($1)',[f.institutions.A]);await deny('adminA',"select public.invite_leadership($1,$2,'MUDIR')",[f.institutions.A,f.profiles.adminA]);});
 const onboarding=await value('adminA',"select public.request_mudir_case($1,$2,'ONBOARDING','Verified institutional onboarding') v",[f.institutions.A,f.profiles.outsider]);
 await check('onboarding needs verified case; admin cannot verify it',async()=>{await assert.rejects(invite('adminA','outsider','MUDIR',null,onboarding),e=>e.code==='42501');await deny('adminA','select public.verify_mudir_case($1,$2)',[onboarding,'evidence-1']);await as('super','select public.verify_mudir_case($1,$2)',[onboarding,'evidence-1']);});
 const initial=await invite('adminA','outsider','MUDIR',null,onboarding);
 await check('recipient-bound single-use leadership invitation',async()=>{await assert.rejects(accept('adminA',initial),e=>e.code==='42501');await accept('outsider',initial);await assert.rejects(accept('outsider',initial),e=>e.code==='42501');});
 await check('Mudir sees institution programs but cannot manage operational data',async()=>{const rows=(await as('outsider','select id from public.programs')).rows;assert.equal(rows.length,2);assert.equal((await as('outsider',"update public.programs set name='bad' where id=$1",[f.programs.a.id])).rowCount,0);await deny('outsider',"select public.set_enrollment_approval_policy($1,'NONE')",[f.institutions.A]);});
 await check('one ACTIVE Mudir; direct leadership mutation blocked including soft delete',async()=>{const m=(await s.query("select m.id from public.institution_members m join public.roles r on r.id=m.role_id where r.code='MUDIR' and m.status='ACTIVE'")).rows[0].id;await deny('adminA',"update public.institution_members set status='INACTIVE' where id=$1",[m]);await deny('adminA',"select public.soft_delete_record('institution_members',$1)",[m]);assert.equal((await s.query("select count(*)::int n from public.institution_members m join public.roles r on r.id=m.role_id where r.code='MUDIR' and m.status='ACTIVE'")).rows[0].n,1);});
 const deputy=await invite('outsider','guardian','WAKIL_MUDIR',[f.programs.a.id]);await accept('guardian',deputy);
 await check('program-scoped deputy plus guardian cannot monitor other program',async()=>{assert.equal((await as('guardian','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.a.id])).rows.length,2);assert.equal((await as('guardian','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.aOther.id])).rows.length,0);assert.equal((await as('guardian','select * from public.monitor_students($1,$2)',[f.institutions.B,f.programs.b.id])).rows.length,0);});
 await check('multiple scopes union only their programs; revoked scope disappears',async()=>{await accept('guardian',await invite('outsider','guardian','WAKIL_MUDIR',[f.programs.aOther.id]));assert.equal((await as('guardian','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.aOther.id])).rows.length,1);const scopes=(await as('guardian','select * from public.my_leadership_scopes()')).rows;await as('outsider','select public.revoke_leadership_scope($1)',[scopes.find(x=>x.program_id===f.programs.aOther.id).scope_id]);assert.equal((await as('guardian','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.aOther.id])).rows.length,0);});
 await check('institution deputy may monitor all programs but cannot delegate',async()=>{await accept('unassigned',await invite('outsider','unassigned','WAKIL_MUDIR'));assert.equal((await as('unassigned','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.aOther.id])).rows.length,1);await assert.rejects(invite('unassigned','student','WAKIL_MUDIR'),e=>e.code==='42501');});
 await check('no/expired scopes confer no leadership monitoring',async()=>{const scopes=(await as('unassigned','select * from public.my_leadership_scopes()')).rows;await s.query("update private.membership_scopes set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[scopes[0].scope_id]);assert.equal((await as('unassigned','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.aOther.id])).rows.length,0);await as('outsider','select public.revoke_leadership_scope($1)',[scopes[0].scope_id]);assert.equal((await as('unassigned','select * from public.my_leadership_scopes()')).rows.length,0);});
 await check('cross-tenant scope and invitation snapshot tampering denied',async()=>{await assert.rejects(invite('outsider','student','WAKIL_MUDIR',[f.programs.b.id]),e=>e.code==='42501');await deny('guardian',"update private.provisioning_invitations set role_code='MUDIR' where id=$1",[deputy.invitation_id]);});
 await s.query("insert into private.learning_setting_definitions values('synthetic_target','number'),('synthetic_stages','array')");
 const publish=(scope,settings,l=null,p=null,plid=null)=>value('adminA','select public.publish_learning_config($1,$2,$3,$4,$5,$6,$7) v',[f.institutions.A,tahfiz,scope,settings,l,p,plid]);
 const effective=()=>value('outsider','select public.effective_learning_config($1,$2,$3,$4) v',[f.institutions.A,f.programs.a.id,tahfiz,pl]);
 await check('configuration inheritance is deterministic and retains version provenance',async()=>{await publish('INSTITUTION',{synthetic_target:1,synthetic_stages:['a']});assert.equal((await effective()).settings.synthetic_target,1);await publish('LEVEL',{synthetic_target:2},level);assert.equal((await effective()).settings.synthetic_target,2);await publish('PROGRAM',{synthetic_target:3,synthetic_stages:['b']},null,f.programs.a.id);assert.equal((await effective()).settings.synthetic_target,3);const id=await publish('PROGRAM_LEVEL',{synthetic_target:4},null,f.programs.a.id,pl);const result=await effective();assert.equal(result.settings.synthetic_target,4);assert.deepEqual(result.settings.synthetic_stages,['b']);assert.equal(result.sources.synthetic_target,id);await publish('PROGRAM_LEVEL',{synthetic_target:5},null,f.programs.a.id,pl);assert.equal((await s.query('select settings from private.learning_config_versions where id=$1',[id])).rows[0].settings.synthetic_target,4);});
 await check('configuration rejects permission metadata and leadership writes',async()=>{await assert.rejects(publish('INSTITUTION',{is_admin:true}),e=>e.code==='22023');await deny('outsider',"select public.publish_learning_config($1,$2,'INSTITUTION','{}')",[f.institutions.A,tahfiz]);});
 const replacement=await value('outsider',"select public.request_mudir_case($1,$2,'REPLACEMENT','Institutional succession') v",[f.institutions.A,f.profiles.adminA]);
 const ri=await invite('outsider','adminA','MUDIR',null,replacement);
 await check('replacement atomically retires previous Mudir and preserves other roles',async()=>{await accept('adminA',ri);assert.equal((await as('outsider','select * from public.my_leadership_scopes()')).rows.length,0);assert.equal((await as('adminA','select * from public.my_leadership_scopes()')).rows.length,1);assert.equal((await s.query("select count(*)::int n from public.institution_members m join public.roles r on r.id=m.role_id where r.code='MUDIR' and m.status='ACTIVE'")).rows[0].n,1);});
 const recovery=await value('adminA',"select public.request_mudir_case($1,$2,'RECOVERY','Lost access requiring institutional evidence') v",[f.institutions.A,f.profiles.student]);
 await check('recovery cannot grant before verified evidence; platform does not create cases freely',async()=>{await assert.rejects(invite('adminA','student','MUDIR',null,recovery),e=>e.code==='42501');await deny('super',"select public.request_mudir_case($1,$2,'ONBOARDING','arbitrary')",[f.institutions.A,f.profiles.super]);await as('super','select public.verify_mudir_case($1,$2)',[recovery,'case-evidence-2']);await accept('student',await invite('adminA','student','MUDIR',null,recovery));});
 await check('leadership does not take over WALI or source-admin approval',async()=>{assert.equal((await s.query('select private.profile_has_role($1,$2,$3) v',[f.profiles.student,f.institutions.A,'INSTITUTION_ADMIN'])).rows[0].v,false);await deny('student',"select public.set_enrollment_approval_policy($1,'NONE')",[f.institutions.A]);});
 await check('representative submits request only; evidence verification remains mandatory',async()=>{
  const c=await value('outsider','select public.request_representative_recovery($1,$2,$3,$4) v',[f.institutions.A,f.profiles.outsider,'Official representative requests access recovery','request-document-reference']);
  await assert.rejects(invite('outsider','outsider','MUDIR',null,c),e=>e.code==='42501');
  await deny('outsider','select public.verify_mudir_case($1,$2)',[c,'self-attestation']);
  assert.equal((await as('outsider','select * from public.monitor_students($1,$2)',[f.institutions.A,f.programs.a.id])).rows.length,0);
  const self=await value('super','select public.request_representative_recovery($1,$2,$3,$4) v',[f.institutions.A,f.profiles.super,'Claim requiring independent verification','self-claim-reference']);
  await deny('super','select public.verify_mudir_case($1,$2)',[self,'self-attestation']);
 });
 await check('concurrent replacement redeems once and cannot create two active Mudir',async()=>{
  const c=await value('student',"select public.request_mudir_case($1,$2,'REPLACEMENT','Concurrent succession') v",[f.institutions.A,f.profiles.outsider]);
  const i=await invite('student','outsider','MUDIR',null,c);
  await s.query('begin');await s.query('select id from public.institutions where id=$1 for update',[f.institutions.A]);
  const calls=[accept('outsider',i),accept('outsider',i)];const results=Promise.allSettled(calls);
  try{let blocked=false;for(let n=0;n<200;n++){await s.query('select pg_stat_clear_snapshot()');const rows=(await s.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like 'select public.accept_provisioning_invitation%'" )).rows;if(rows[0].n===2){blocked=true;break;}await setTimeout(25);}assert.ok(blocked,'Both independent connections must wait on the institution lock');}
  finally{await s.query('commit');}
  const r=await results;assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected'&&x.reason.code==='42501').length,1);
  assert.equal((await s.query("select count(*)::int n from public.institution_members m join public.roles r on r.id=m.role_id where r.code='MUDIR' and m.status='ACTIVE'")).rows[0].n,1);
 });
 await check('stale invitations and cases remain invalid after same Mudir returns',async()=>{
  const staleDeputy=await invite('outsider','student2','WAKIL_MUDIR');
  const staleCase=await value('outsider',"select public.request_mudir_case($1,$2,'REPLACEMENT','Old succession request') v",[f.institutions.A,f.profiles.adminA]);
  const staleLeader=await invite('outsider','adminA','MUDIR',null,staleCase);
  for(const [actor,recipient] of [['outsider','student'],['student','outsider']]){const c=await value(actor,"select public.request_mudir_case($1,$2,'REPLACEMENT','New succession request') v",[f.institutions.A,f.profiles[recipient]]);await accept(recipient,await invite(actor,recipient,'MUDIR',null,c));}
  await assert.rejects(accept('student2',staleDeputy),e=>e.code==='42501');await assert.rejects(accept('adminA',staleLeader),e=>e.code==='42501');
 });
 await check('expired deputy scope can be reissued without resurrecting old scope',async()=>{
  await accept('unassigned',await invite('outsider','unassigned','WAKIL_MUDIR',[f.programs.a.id],null,new Date(Date.now()+3600000).toISOString()));
  const old=(await as('unassigned','select * from public.my_leadership_scopes()')).rows[0];
  await s.query("update private.membership_scopes set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[old.scope_id]);
  await accept('unassigned',await invite('outsider','unassigned','WAKIL_MUDIR',[f.programs.a.id]));
  const fresh=(await as('unassigned','select * from public.my_leadership_scopes()')).rows;assert.equal(fresh.length,1);assert.notEqual(fresh[0].scope_id,old.scope_id);
  assert.ok((await s.query('select revoked_at from private.membership_scopes where id=$1',[old.scope_id])).rows[0].revoked_at);
 });
 await check('leadership audit has permission and scope; history cannot be hard deleted',async()=>{
  await assert.rejects(s.query("select private.write_leadership_member($1,$2,'MUDIR',true)",[f.institutions.A,f.profiles.student2]),e=>e.code==='23505');
  assert.equal((await s.query("select count(*)::int n from public.audit_logs where entity_type='leadership_governance' and (permission_code is null or authorization_scope is null)")).rows[0].n,0);
  const m=(await as('outsider','select * from public.my_leadership_scopes()')).rows[0].membership_id;
  await assert.rejects(s.query('delete from public.institution_members where id=$1',[m]),e=>e.code==='42501');
  await assert.rejects(s.query("insert into private.membership_scopes(institution_id,membership_id,scope_type,program_id,granted_by) values($1,$2,'PROGRAM',$3,$4)",[f.institutions.A,m,f.programs.a.id,f.profiles.outsider]),e=>e.code==='23514');
 });
 await check('scheduler and client ACL remain least privilege',async()=>{
  assert.deepEqual((await s.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('ngt_expiry_scheduler',p.oid,'EXECUTE')")).rows,[{proname:'expire_institution_enrollments'}]);
  for(const r of ['anon','authenticated','service_role'])assert.deepEqual((await s.query("select tablename from pg_tables where schemaname='private' and has_table_privilege($1,format('%I.%I',schemaname,tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')",[r])).rows,[]);
  await deny('outsider','select private.write_leadership_member($1,$2,$3,true)',[f.institutions.A,f.profiles.outsider,'MUDIR']);
 });
 console.log(`${passed}/${passed} Migration 11 checks passed`);
}finally{await s.close();}
