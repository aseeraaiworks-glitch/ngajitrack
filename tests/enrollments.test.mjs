import {describe,it,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatabase,root} from './database.mjs';
import {makeFixture} from './fixture.mjs';

describe('Migration 7: concurrent roles and bounded enrollments',{concurrency:false},()=>{
  let db,f;
  const q=(sql,args=[])=>db.query(sql,args);
  const rows=async(sql,args=[])=>(await q(sql,args)).rows;
  async function actor(name,role='authenticated') {
    await db.exec('reset role');
    await q("select set_config('request.jwt.claim.sub',$1,true)",[name?f.users[name]:'']);
    await db.exec(`set local role ${role}`);
  }
  const owner=()=>actor(null,'postgres');
  async function denied(sql,args=[],code='23514') {
    await db.exec('savepoint denial');
    try {await assert.rejects(q(sql,args),e=>e.code===code);}
    finally {await db.exec('rollback to savepoint denial');await db.exec('release savepoint denial');}
  }
  const ids=async(table)=>(await rows(`select id from public.${table}`)).map(x=>x.id).sort();
  async function schedule(key,days=10,type='HOLIDAY') {
    await q(`update public.institution_enrollments set enrollment_type=$2,
      scheduled_end_at=private.institution_today(institution_id)+$3::int where id=$1`,[f.ie[key].id,type,days]);
  }
  async function guardian(name,tenant,student) {
    await f.member(name,tenant,'GUARDIAN');
    const gp=await f.insert('guardian_profiles',{institution_id:f.institutions[tenant],profile_id:f.profiles[name],guardian_public_id:`G-${name}-${tenant}`,status:'ACTIVE'});
    return f.insert('guardian_students',{institution_id:f.institutions[tenant],guardian_id:gp.id,student_id:f.students[student].id,status:'VERIFIED',verified_by:f.profiles[`admin${tenant}`]});
  }
  async function teacher(name,tenant,program,group) {
    await f.member(name,tenant,'TEACHER');
    const tp=await f.insert('teacher_profiles',{institution_id:f.institutions[tenant],profile_id:f.profiles[name],teacher_public_id:`T-${name}-${tenant}`,status:'ACTIVE'});
    return f.insert('teacher_assignments',{institution_id:f.institutions[tenant],teacher_id:tp.id,program_id:f.programs[program].id,group_id:f.groups[group].id});
  }
  before(async()=>{db=await createDatabase();await db.exec('begin');f=await makeFixture(db);});
  after(async()=>{if(db){await db.exec('rollback');await db.close();}});
  beforeEach(async()=>{await db.exec('savepoint test_case');});
  afterEach(async()=>{await db.exec('rollback to savepoint test_case');await db.exec('release savepoint test_case');await db.exec('reset role');});

  it('upgrades populated migration-6 database without rewriting existing history',async()=>{
    const old=await createDatabase({embedded:true,through:'20260923000600'});
    try {
      const fixture=await makeFixture(old);
      await old.query("update public.institution_enrollments set status='COMPLETED',ended_at=current_date where id=$1",[fixture.ie.a1.id]);
      const before=(await old.query('select * from public.institution_enrollments order by id')).rows;
      const auditCount=(await old.query('select count(*) n from public.audit_logs')).rows[0].n;
      await old.exec('begin');
      await old.exec(await readFile(new URL('supabase/migrations/20260924000700_temporary_enrollments.sql',root),'utf8'));
      await old.exec('commit');
      const after=(await old.query('select * from public.institution_enrollments order by id')).rows;
      assert.deepEqual(after.map(({enrollment_type,scheduled_end_at,reason,...legacy})=>legacy),before);
      assert.ok(after.every(e=>e.enrollment_type==='REGULAR' && e.scheduled_end_at===null));
      assert.equal((await old.query('select count(*) n from public.audit_logs')).rows[0].n,auditCount);
    } finally {await old.close();}
  });
  it('uses only canonical date fields, with no second start/end pair',async()=>{
    const cols=await rows("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='institution_enrollments'");
    for(const name of ['started_at','scheduled_end_at','ended_at']) assert.equal(cols.find(c=>c.column_name===name).data_type,'date');
    assert.ok(!cols.some(c=>['start_at','end_at'].includes(c.column_name)));
  });
  it('keeps the same global identity active as a student in A and B',async()=>{
    await schedule('b1');await actor('student');
    assert.deepEqual(await ids('student_identities'),[f.identities.student.id]);
    assert.deepEqual((await rows("select id from public.institution_enrollments where status='ACTIVE' order by id")).map(x=>x.id),[f.ie.a1.id,f.ie.b1.id].sort());
  });
  it('combines guardian and teacher in the same institution without granting its entire roster',async()=>{
    const link=await guardian('teacher','A','a2');
    const outsider=await f.insert('student_profiles',{institution_id:f.institutions.A,display_name:'Unrelated',status:'ACTIVE'});
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.a2.id,f.students.b2.id].sort());
    assert.ok(!(await ids('student_profiles')).includes(outsider.id));
    await owner();await q("update public.guardian_students set status='REVOKED' where id=$1",[link.id]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.b2.id].sort());
  });
  it('combines guardian in A and teacher in B with separate access scopes',async()=>{
    await teacher('guardian','B','b','b');await actor('guardian');
    assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.b1.id,f.students.b2.id].sort());
    assert.deepEqual(await ids('student_identities'),[]);
  });
  it('combines student, guardian and teacher across contexts without extra accounts',async()=>{
    const count=(await rows('select count(*)::int n from public.profiles'))[0].n;
    await guardian('student','B','b2');await teacher('student','A','a','a2');
    assert.equal((await rows('select count(*)::int n from public.profiles'))[0].n,count);
    await actor('student');assert.deepEqual(await ids('student_profiles'),Object.values(f.students).map(s=>s.id).sort());
    assert.deepEqual(await ids('student_identities'),[f.identities.student.id]);
    await denied('select public.end_institution_enrollment($1)',[f.ie.b1.id],'42501');
    await denied("insert into public.institution_members(institution_id,profile_id,role_id) select $1,$2,id from public.roles where code='INSTITUTION_ADMIN'",[f.institutions.B,f.profiles.student],'42501');
  });
  it('requires a finite ordered period for TEMPORARY and HOLIDAY',async()=>{
    for(const type of ['TEMPORARY','HOLIDAY']) {
      await denied('update public.institution_enrollments set enrollment_type=$2 where id=$1',[f.ie.b1.id,type]);
      await denied('update public.institution_enrollments set enrollment_type=$2,scheduled_end_at=started_at where id=$1',[f.ie.b1.id,type]);
      await denied("update public.institution_enrollments set enrollment_type=$2,scheduled_end_at='infinity' where id=$1",[f.ie.b1.id,type]);
      await schedule('b1',10,type);
      await denied('update public.institution_enrollments set started_at=null where id=$1',[f.ie.b1.id]);
      await q("update public.institution_enrollments set enrollment_type='REGULAR',scheduled_end_at=null where id=$1",[f.ie.b1.id]);
    }
  });
  it('stops roster access at the exclusive end date even before scheduler processing',async()=>{
    await schedule('a1',0);
    assert.equal((await rows('select status from public.institution_enrollments where id=$1',[f.ie.a1.id]))[0].status,'ACTIVE');
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
    assert.deepEqual(await ids('program_enrollments'),[f.pe.b2.id]);
    assert.deepEqual(await ids('group_memberships'),[f.gm.b2.id]);
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id]);
  });
  it('rejects descendant writes and even an idempotent class move while scheduler is late',async()=>{
    await schedule('a1',-1);await actor('adminA');
    await denied('select public.move_student_group($1,$2)',[f.pe.a1.id,f.groups.a1.id]);
    await denied("update public.program_enrollments set enrolled_at=enrolled_at where id=$1",[f.pe.a1.id]);
    await denied("update public.group_memberships set assigned_by=$2 where id=$1",[f.gm.a1.id,f.profiles.adminA]);
    await denied('insert into public.program_enrollments(institution_id,student_id,program_id,institution_enrollment_id) values($1,$2,$3,$4)',[f.institutions.A,f.students.a1.id,f.programs.a.id,f.ie.a1.id]);
    await denied('insert into public.group_memberships(institution_id,student_id,program_id,program_enrollment_id,group_id) values($1,$2,$3,$4,$5)',[f.institutions.A,f.students.a1.id,f.programs.a.id,f.pe.a1.id,f.groups.a1.id]);
  });
  it('uses institution timezone even if the database session timezone differs',async()=>{
    await db.exec("set local timezone='UTC'");
    for(const [key,zone] of [['a1','Pacific/Kiritimati'],['a2','Etc/GMT+12']]) {
      await db.exec('savepoint timezone_case');
      await q('update public.institutions set timezone=$2 where id=$1',[f.institutions.A,zone]);
      await schedule(key,1);
      assert.equal((await rows('select private.enrollment_operational($1) ok',[f.ie[key].id]))[0].ok,true);
      await schedule(key,0);
      assert.equal((await rows('select private.institution_today($1) = (statement_timestamp() at time zone $2)::date ok',[f.institutions.A,zone]))[0].ok,true);
      assert.equal((await rows('select private.enrollment_operational($1) ok',[f.ie[key].id]))[0].ok,false);
      await db.exec('rollback to savepoint timezone_case');await db.exec('release savepoint timezone_case');
    }
  });
  it('rejects invalid timezone and changing timezone with an open scheduled enrollment',async()=>{
    await denied("update public.institutions set timezone='Invalid/Timezone' where id=$1",[f.institutions.A]);
    await schedule('a1');
    await actor('adminA');await denied("update public.institutions set timezone='Pacific/Kiritimati' where id=$1",[f.institutions.A]);
  });
  it('future enrollment cannot authorize operations before its start date',async()=>{
    await q("update public.institution_enrollments set started_at=private.institution_today(institution_id)+1,scheduled_end_at=private.institution_today(institution_id)+7,enrollment_type='TEMPORARY' where id=$1",[f.ie.a1.id]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
    await actor('adminA');await denied('select public.move_student_group($1,$2)',[f.pe.a1.id,f.groups.a2.id]);
  });
  it('scheduler also closes overdue PENDING enrollment, which cannot be activated',async()=>{
    const [e]=await rows("insert into public.institution_enrollments(institution_id,student_id,started_at,scheduled_end_at,enrollment_type,status) values($1,$2,'2020-01-01',private.institution_today($1),'HOLIDAY','PENDING') returning id",[f.institutions.B,f.students.b1.id]);
    await denied("update public.institution_enrollments set status='ACTIVE' where id=$1",[e.id]);
    await actor(null,'service_role');assert.equal((await rows('select public.expire_institution_enrollments() n'))[0].n,1);
    await owner();assert.equal((await rows('select status from public.institution_enrollments where id=$1',[e.id]))[0].status,'ENDED');
  });
  it('prevents extending or converting an expired enrollment to resurrect access',async()=>{
    await schedule('a1',-1);
    await denied('update public.institution_enrollments set scheduled_end_at=current_date+30 where id=$1',[f.ie.a1.id]);
    await denied("update public.institution_enrollments set enrollment_type='REGULAR',scheduled_end_at=null where id=$1",[f.ie.a1.id]);
  });
  it('ends early, stamps actual closure, closes descendants and preserves other roles',async()=>{
    await schedule('b1',10);const link=await guardian('student','B','b2');const assignment=await teacher('student','B','b','b');
    await actor('adminB');await q('select public.end_institution_enrollment($1,$2)',[f.ie.b1.id,'EARLY_RETURN']);
    await q('select public.end_institution_enrollment($1,$2)',[f.ie.b1.id,'retry']);
    const [e]=await rows('select status,ended_at < scheduled_end_at early,completion_reason from public.institution_enrollments where id=$1',[f.ie.b1.id]);
    assert.deepEqual(e,{status:'ENDED',early:true,completion_reason:'EARLY_RETURN'});
    await owner();
    for(const [table,id] of [['program_enrollments',f.pe.b1.id],['group_memberships',f.gm.b1.id]]) assert.equal((await rows(`select status from public.${table} where id=$1`,[id]))[0].status,'ENDED');
    assert.equal((await rows('select status from public.institution_enrollments where id=$1',[f.ie.a1.id]))[0].status,'ACTIVE');
    assert.equal((await rows('select is_active from public.teacher_assignments where id=$1',[assignment.id]))[0].is_active,true);
    assert.equal((await rows('select status from public.guardian_students where id=$1',[link.id]))[0].status,'VERIFIED');
    await actor('student');
    for(const role of ['STUDENT','TEACHER','GUARDIAN']) assert.equal((await rows('select private.has_role($1,$2) ok',[f.institutions.B,role]))[0].ok,true);
    assert.ok((await ids('student_profiles')).includes(f.students.b2.id));
    assert.ok((await ids('institution_enrollments')).includes(f.ie.b1.id));
  });
  it('ending the teacher assignment preserves valid guardian access',async()=>{
    const assignment=await teacher('guardian','B','b','b');await guardian('guardian','B','b2');
    await q('update public.teacher_assignments set is_active=false where id=$1',[assignment.id]);
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.b2.id].sort());
  });
  it('direct authorized ENDED update cannot bypass closure, timestamps or immutable history',async()=>{
    await actor('adminA');await q("update public.institution_enrollments set status='ENDED',ended_at='2001-01-01' where id=$1",[f.ie.a1.id]);
    await owner();
    assert.equal((await rows('select ended_at=private.institution_today(institution_id) ok from public.institution_enrollments where id=$1',[f.ie.a1.id]))[0].ok,true);
    for(const [table,id] of [['institution_enrollments',f.ie.a1.id],['program_enrollments',f.pe.a1.id],['group_memberships',f.gm.a1.id]]) {
      assert.equal((await rows(`select status from public.${table} where id=$1`,[id]))[0].status,'ENDED');
      await denied(`update public.${table} set status='ACTIVE' where id=$1`,[id]);
      await denied(`update public.${table} set deleted_at=now() where id=$1`,[id]);
    }
  });
  it('early closure can cancel future planned enrollment and placements with actual dates',async()=>{
    const [e]=await rows("insert into public.institution_enrollments(institution_id,student_id,enrollment_type,started_at,scheduled_end_at) values($1,$2,'HOLIDAY',current_date+3,current_date+10) returning id",[f.institutions.A,f.students.a1.id]);
    const gm=await f.insert('group_memberships',{institution_id:f.institutions.A,student_id:f.students.a1.id,program_id:f.programs.a.id,program_enrollment_id:f.pe.a1.id,group_id:f.groups.a2.id,status:'PENDING',started_at:'2099-01-01T00:00:00Z'});
    await actor('adminA');await q('select public.end_institution_enrollment($1)',[e.id]);
    assert.equal((await rows('select ended_at < started_at early from public.institution_enrollments where id=$1',[e.id]))[0].early,true);
    await q('select public.end_institution_enrollment($1)',[f.ie.a1.id]);
    assert.equal((await rows("select status='ENDED' and ended_at < started_at ok from public.group_memberships where id=$1",[gm.id]))[0].ok,true);
  });
  it('scheduler closes overdue rows with actual processing date and is idempotent',async()=>{
    const link=await guardian('student','A','a2');const assignment=await teacher('student','A','a','a2');
    await schedule('a1',-2);await schedule('b1',20);
    await actor(null,'service_role');assert.equal((await rows('select public.expire_institution_enrollments() n'))[0].n,1);
    assert.equal((await rows('select public.expire_institution_enrollments() n'))[0].n,0);
    await owner();const [e]=await rows("select status,ended_at>scheduled_end_at late,ended_at=private.institution_today(institution_id) actual from public.institution_enrollments where id=$1",[f.ie.a1.id]);
    assert.deepEqual(e,{status:'ENDED',late:true,actual:true});
    const logs=await rows("select * from public.audit_logs where entity_id=$1 and new_value->>'status'='ENDED'",[f.ie.a1.id]);
    assert.equal(logs.length,1);assert.equal(logs[0].actor_role_code,'SYSTEM');
    assert.equal((await rows('select status from public.institution_enrollments where id=$1',[f.ie.b1.id]))[0].status,'ACTIVE');
    assert.equal((await rows('select status from public.guardian_students where id=$1',[link.id]))[0].status,'VERIFIED');
    assert.equal((await rows('select is_active from public.teacher_assignments where id=$1',[assignment.id]))[0].is_active,true);
    await actor('student');
    for(const role of ['TEACHER','GUARDIAN']) assert.equal((await rows('select private.has_role($1,$2) ok',[f.institutions.A,role]))[0].ok,true);
    assert.ok((await ids('student_profiles')).includes(f.students.a2.id));
  });
  it('rolls back root closure and audit if any descendant closure fails',async()=>{
    await db.exec("create function private.test_reject_closure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic child failure'; end $$; create trigger test_reject before update on public.program_enrollments for each row execute function private.test_reject_closure();");
    await actor('adminA');await denied('select public.end_institution_enrollment($1)',[f.ie.a1.id],'P0001');
    for(const [table,id] of [['institution_enrollments',f.ie.a1.id],['program_enrollments',f.pe.a1.id],['group_memberships',f.gm.a1.id]]) assert.equal((await rows(`select status from public.${table} where id=$1`,[id]))[0].status,'ACTIVE');
    assert.equal((await rows("select count(*)::int n from public.audit_logs where new_value->>'status'='ENDED'"))[0].n,0);
  });
  it('bounds expiry batches and validates the scheduler input',async()=>{
    await schedule('a1',-1);await schedule('b1',-1);
    await actor(null,'service_role');
    await denied('select public.expire_institution_enrollments(0)',[],'22023');
    assert.equal((await rows('select public.expire_institution_enrollments(1) n'))[0].n,1);
    assert.equal((await rows('select public.expire_institution_enrollments(1) n'))[0].n,1);
    assert.equal((await rows('select public.expire_institution_enrollments(1) n'))[0].n,0);
  });
  it('next holiday creates a new enrollment with fresh descendants and same identity',async()=>{
    await schedule('b1');await actor('adminB');await q('select public.end_institution_enrollment($1)',[f.ie.b1.id]);
    const [e]=await rows("insert into public.institution_enrollments(institution_id,student_id,status,enrollment_type,started_at,scheduled_end_at) values($1,$2,'ACTIVE','HOLIDAY',current_date-1,current_date+7) returning id",[f.institutions.B,f.students.b1.id]);
    assert.notEqual(e.id,f.ie.b1.id);
    const pe=await f.insert('program_enrollments',{institution_id:f.institutions.B,institution_enrollment_id:e.id,student_id:f.students.b1.id,program_id:f.programs.b.id,status:'ACTIVE'});
    await f.insert('group_memberships',{institution_id:f.institutions.B,program_enrollment_id:pe.id,student_id:f.students.b1.id,program_id:f.programs.b.id,group_id:f.groups.b.id,status:'ACTIVE'});
    await actor('student');assert.equal((await rows('select * from public.institution_enrollments where institution_id=$1',[f.institutions.B])).length,2);
    assert.deepEqual(await ids('student_identities'),[f.identities.student.id]);
  });
  it('rejects cross-tenant closure, schedule writes, scheduler calls and anonymous commands',async()=>{
    await actor('adminA');await denied('select public.end_institution_enrollment($1)',[f.ie.b1.id],'42501');
    assert.equal((await q('update public.institution_enrollments set scheduled_end_at=current_date+10 where id=$1',[f.ie.b1.id])).affectedRows,0);
    assert.deepEqual(await rows('select * from public.institution_enrollments where id=$1',[f.ie.b1.id]),[]);
    for(const name of ['adminA','student','teacher','guardian','super']) {await actor(name);await denied('select public.expire_institution_enrollments()',[],'42501');}
    await actor(null,'anon');await denied('select public.end_institution_enrollment($1)',[f.ie.b1.id],'42501');await denied('select public.expire_institution_enrollments()',[],'42501');
  });
});
