import {describe,it,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from './database.mjs';
import {makeFixture} from './fixture.mjs';

describe('NgajiTrack PostgreSQL backend foundation',{concurrency:false},()=>{
  let db,f;
  const q=(sql,args=[])=>db.query(sql,args);
  const rows=async(sql,args=[])=> (await q(sql,args)).rows;
  async function actor(name,role='authenticated') {
    await db.exec('reset role');
    await q("select set_config('request.jwt.claim.sub',$1,true)",[name?f.users[name]:'']);
    await db.exec(`set local role ${role}`);
  }
  const owner=()=>actor(null,'postgres');
  async function denied(sql,args=[],code='42501') {
    await db.exec('savepoint expected_denial');
    try { await assert.rejects(q(sql,args),e=>[code].flat().includes(e.code)); }
    finally { await db.exec('rollback to savepoint expected_denial'); await db.exec('release savepoint expected_denial'); }
  }
  const ids=async(table)=> (await rows(`select id from public.${table}`)).map(r=>r.id).sort();
  before(async()=>{ db=await createDatabase(); await db.exec('begin'); f=await makeFixture(db); });
  after(async()=>{if(db){await db.exec('rollback');await db.close();}});
  beforeEach(async()=>{await db.exec('savepoint test_case');});
  afterEach(async()=>{await db.exec('rollback to savepoint test_case');await db.exec('release savepoint test_case');await db.exec('reset role');});

  it('replays migrations on a second clean embedded database',async()=>{const fresh=await createDatabase({embedded:true});assert.equal((await fresh.query("select count(*)::int n from pg_tables where schemaname='public' and rowsecurity")).rows[0].n,18);await fresh.close();});
  it('has only foundation tables, RLS on all tables, and three program type seeds',async()=>{
    const tables=await rows("select tablename,rowsecurity from pg_tables where schemaname='public'");
    assert.equal(tables.length,process.env.NGAJITRACK_TEST_SCHEMA_VERSION==='11'?21:18);assert.ok(tables.every(t=>t.rowsecurity));
    assert.deepEqual((await rows('select code from public.program_types order by code')).map(x=>x.code),['CUSTOM','QURAN_READING','TAHFIZ']);
  });
  it('auth trigger creates one profile and ignores role metadata',async()=>{
    assert.equal((await rows('select count(*)::int n from public.profiles'))[0].n,9);
    assert.equal((await rows('select count(*)::int n from public.platform_roles'))[0].n,1);
  });
  it('fixture reuses pre-provisioned Auth IDs without creating duplicate users (embedded only)',async()=>{
    const fresh=await createDatabase({embedded:true});
    try {
      for(const [name,id] of Object.entries(f.users)) await fresh.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({full_name:`Existing ${name}`})]);
      const linked=await makeFixture(fresh,{authUsers:f.users});
      assert.deepEqual(linked.users,f.users);
      assert.equal((await fresh.query('select count(*)::int n from auth.users')).rows[0].n,9);
      assert.equal((await fresh.query('select count(*)::int n from public.profiles')).rows[0].n,9);
    } finally {await fresh.close();}
  });
  it('global reference changes are server-only and audited',async()=>{
    await actor('adminA');await denied("update public.program_types set name='Bad'");await denied("insert into public.roles(code,name) values('SUPER_ADMIN','Bad')");
    await owner();const [{id}]=await rows("insert into public.program_types(code,name) values('TEST_REFERENCE','Reference test') returning id");
    assert.equal((await rows("select count(*)::int n from public.audit_logs where entity_id=$1 and entity_type='program_types' and institution_id is null",[id]))[0].n,1);
  });
  it('creates institution plus admin membership atomically using platform role',async()=>{
    await actor('super');const [{id}]=await rows("select public.create_institution('NEW_TEST','Uji baru','TPQ',$1) id",[f.profiles.adminA]);
    await owner();assert.equal((await rows('select count(*)::int n from public.institution_members where institution_id=$1',[id]))[0].n,1);
    assert.equal((await rows("select count(*)::int n from public.audit_logs where institution_id=$1 and action='INSERT'",[id]))[0].n,2);
  });
  it('rejects ordinary-user institution creation',async()=>{await actor('adminA');await denied("select public.create_institution('BAD','Bad','TPQ',$1)",[f.profiles.adminA]);});
  it('allows multiple roles in one institution and contexts across institutions',async()=>{
    await actor('adminA');assert.equal((await rows('select * from public.institution_members where profile_id=$1',[f.profiles.adminA])).length,2);
    await actor('teacher');assert.equal((await rows('select * from public.my_institutions()')).length,2);
  });
  it('does not require Super Admin memberships or grant broad student access',async()=>{
    await actor('super');assert.equal((await rows('select * from public.institutions')).length,2);
    assert.deepEqual(await ids('student_profiles'),[]);
    assert.equal((await rows('select * from public.institution_members where profile_id=$1',[f.profiles.super])).length,0);
  });
  it('rejects SUPER_ADMIN as an institution role even for server writes',async()=>{
    await denied("insert into public.institution_members(institution_id,profile_id,role_id,status) select $1,$2,id,'ACTIVE' from public.roles where code='SUPER_ADMIN'",[f.institutions.A,f.profiles.outsider],'23514');
  });
  it('admin can read only own tenant across every tenant-scoped table',async()=>{
    await actor('adminA');
    for(const table of ['institution_members','student_profiles','teacher_profiles','guardian_profiles','guardian_students','programs','groups','institution_enrollments','program_enrollments','group_memberships','teacher_assignments','audit_logs']){
      const found=await rows(`select institution_id from public.${table}`);assert.ok(found.length>0,table);assert.ok(found.every(r=>r.institution_id===f.institutions.A),table);
    }
  });
  it('admin CRUD cannot insert/update/read/delete another tenant',async()=>{
    await actor('adminA');await denied("insert into public.student_profiles(institution_id,display_name,status) values($1,'Bad','ACTIVE')",[f.institutions.B]);
    assert.equal((await q("update public.student_profiles set display_name='Bad' where id=$1",[f.students.b1.id])).affectedRows,0);
    assert.deepEqual(await rows('select * from public.student_profiles where id=$1',[f.students.b1.id]),[]);
    await denied('delete from public.student_profiles where id=$1',[f.students.b1.id]);
  });
  it('admin creates local student and guardian without a login account',async()=>{
    await actor('adminA');
    assert.equal((await rows("insert into public.student_profiles(institution_id,display_name,status) values($1,'Baru','ACTIVE') returning display_name",[f.institutions.A]))[0].display_name,'Baru');
    assert.equal((await rows("insert into public.guardian_profiles(institution_id,guardian_public_id) values($1,'NO-LOGIN-2') returning profile_id",[f.institutions.A]))[0].profile_id,null);
  });
  it('admin creates a program and class using seeded type',async()=>{
    await actor('adminA');const [{id}]=await rows("insert into public.programs(institution_id,name,program_type_id) values($1,'Program baru',$2) returning id",[f.institutions.A,f.programs.a.program_type_id]);
    assert.equal((await rows("insert into public.groups(institution_id,program_id,name,status) values($1,$2,'Kelas baru','ACTIVE') returning program_id",[f.institutions.A,id]))[0].program_id,id);
  });
  it('admin creates teacher profile after server provisions the verified membership',async()=>{
    await f.member('outsider','A','TEACHER');await actor('adminA');
    const [t]=await rows("insert into public.teacher_profiles(institution_id,profile_id,teacher_public_id,status) values($1,$2,'TEACHER-NEW','ACTIVE') returning profile_id",[f.institutions.A,f.profiles.outsider]);assert.equal(t.profile_id,f.profiles.outsider);
  });
  it('active teacher cannot be created without a matching role membership',async()=>{
    await actor('adminA');await denied("insert into public.teacher_profiles(institution_id,profile_id,teacher_public_id,status) values($1,$2,'TEACHER-BAD','ACTIVE')",[f.institutions.A,f.profiles.outsider],'23514');
  });
  it('self profile edit cannot alter another account and is audited',async()=>{
    await actor('student');assert.equal((await q("update public.profiles set preferred_name='Mine' where id=$1",[f.profiles.student])).affectedRows,1);
    assert.equal((await q("update public.profiles set preferred_name='Bad' where id=$1",[f.profiles.student2])).affectedRows,0);
    await owner();assert.equal((await rows("select count(*)::int n from public.audit_logs where entity_id=$1 and action='UPDATE'",[f.profiles.student]))[0].n,1);
  });
  it('teacher sees assigned students plus own linked child in another role only',async()=>{
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.b2.id].sort());
    assert.deepEqual(await ids('groups'),[f.groups.a1.id,f.groups.b.id].sort());
  });
  it('teacher cannot expand access to another program of the same assigned student',async()=>{
    await actor('teacher');assert.deepEqual(await ids('program_enrollments'),[f.pe.a1.id,f.pe.b2.id].sort());
    assert.deepEqual(await ids('programs'),[f.programs.a.id,f.programs.b.id].sort());
    assert.deepEqual(await ids('group_memberships'),[f.gm.a1.id,f.gm.b2.id].sort());
  });
  it('unassigned teacher sees no student roster',async()=>{await actor('unassigned');assert.deepEqual(await ids('student_profiles'),[]);assert.deepEqual(await ids('programs'),[]);});
  it('teacher cannot change structure or assign themselves',async()=>{
    await actor('teacher');await denied('insert into public.teacher_assignments(institution_id,teacher_id,program_id,group_id) values($1,$2,$3,$4)',[f.institutions.A,f.teachers.teacher.id,f.programs.a.id,f.groups.a2.id]);
    assert.equal((await q("update public.groups set name='Bad' where id=$1",[f.groups.a1.id])).affectedRows,0);
    await denied('select public.move_student_group($1,$2)',[f.pe.a1.id,f.groups.a2.id]);
  });
  it('guardian sees VERIFIED child only, not PENDING child or another tenant copy',async()=>{await actor('guardian');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id]);assert.deepEqual(await ids('institution_enrollments'),[f.ie.a1.id]);});
  it('REVOKED link immediately removes child access',async()=>{
    await actor('adminA');await q("update public.guardian_students set status='REVOKED' where id=$1",[f.links.verified.id]);
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[]);
  });
  it('can_view_progress=false removes child access',async()=>{
    await actor('adminA');await q('update public.guardian_students set can_view_progress=false where id=$1',[f.links.verified.id]);
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[]);
  });
  it('admin verification stamps actual actor and grants the linked child',async()=>{
    await actor('adminA');await q("update public.guardian_students set status='VERIFIED',verified_by=$2 where id=$1",[f.links.pending.id,f.profiles.adminB]);
    const [link]=await rows('select verified_by from public.guardian_students where id=$1',[f.links.pending.id]);assert.equal(link.verified_by,f.profiles.adminA);
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.a2.id].sort());
  });
  it('guardian cannot verify their own pending relationship',async()=>{
    await actor('guardian');assert.equal((await q("update public.guardian_students set status='VERIFIED' where id=$1",[f.links.pending.id])).affectedRows,0);
  });
  it('student sees own local records across authorized contexts, never peers',async()=>{
    await actor('student');assert.deepEqual(await ids('student_profiles'),[f.students.a1.id,f.students.b1.id].sort());
    assert.deepEqual(await ids('student_identities'),[f.identities.student.id]);
  });
  it('client cannot claim global identity, change login binding or escalate roles',async()=>{
    await actor('adminA');await denied('update public.student_profiles set student_identity_id=$1 where id=$2',[f.identities.student2.id,f.students.a1.id]);
    await denied('insert into public.platform_roles(profile_id,role_code) values($1,\'SUPER_ADMIN\')',[f.profiles.adminA]);
    await denied("insert into public.institution_members(institution_id,profile_id,role_id,status) select $1,$2,id,'ACTIVE' from public.roles where code='INSTITUTION_ADMIN'",[f.institutions.A,f.profiles.outsider]);
    await denied('update public.profiles set auth_user_id=$1 where id=$2',[f.users.outsider,f.profiles.adminA]);
    await denied('update public.profiles set is_active=true where id=$1',[f.profiles.adminA]);
  });
  it('global profiles/identities do not expose a tenant-searchable directory',async()=>{
    await actor('adminA');assert.deepEqual(await ids('profiles'),[f.profiles.adminA]);assert.deepEqual(await ids('student_identities'),[]);
  });
  it('outsider has no tenant access',async()=>{await actor('outsider');assert.deepEqual(await ids('student_profiles'),[]);assert.deepEqual(await ids('institutions'),[]);assert.deepEqual(await rows('select * from public.my_institutions()'),[]);});
  it('anonymous cannot read any foundation table or call exposed commands',async()=>{
    const tables=await rows("select tablename from pg_tables where schemaname='public'");await actor(null,'anon');
    for(const {tablename} of tables) await denied(`select * from public.${tablename}`);
    await denied('select * from public.my_institutions()');await denied('select public.move_student_group($1,$2)',[f.pe.a1.id,f.groups.a2.id]);
  });
  it('disabled login profile removes all personal and tenant permissions',async()=>{
    await q('update public.profiles set is_active=false where id=$1',[f.profiles.teacher]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[]);assert.deepEqual(await ids('profiles'),[]);assert.deepEqual(await rows('select * from public.my_institutions()'),[]);
  });
  it('inactive membership removes teacher access even when assignment remains',async()=>{
    await q("update public.institution_members set status='INACTIVE' where profile_id=$1 and institution_id=$2",[f.profiles.teacher,f.institutions.A]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
  });
  it('expired and future assignments do not authorize a roster',async()=>{
    await q("update public.teacher_assignments set end_date=current_date-1 where id=$1",[f.assignments.teacher.id]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
    await owner();await q('update public.teacher_assignments set end_date=null,start_date=current_date+1 where id=$1',[f.assignments.teacher.id]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
  });
  it('institution suspension denies operational access without deleting history',async()=>{
    await q("update public.institutions set status='SUSPENDED' where id=$1",[f.institutions.A]);await actor('adminA');assert.deepEqual(await ids('student_profiles'),[]);
    await owner();assert.equal((await rows('select count(*)::int n from public.student_profiles where institution_id=$1',[f.institutions.A]))[0].n,2);
  });
  it('composite foreign keys reject cross-tenant guardian/student relationships',async()=>{
    await actor('adminA');await denied('insert into public.guardian_students(institution_id,guardian_id,student_id) values($1,$2,$3)',[f.institutions.A,f.guardians.A.id,f.students.b1.id],'23503');
  });
  it('enrollment hierarchy rejects mismatched student and institution enrollment',async()=>{
    await actor('adminA');await denied('insert into public.program_enrollments(institution_id,institution_enrollment_id,program_id,student_id) values($1,$2,$3,$4)',[f.institutions.A,f.ie.a1.id,f.programs.a.id,f.students.a2.id],'23503');
  });
  it('group membership and assignment reject mismatched program/class',async()=>{
    await actor('adminA');await denied('insert into public.group_memberships(institution_id,program_enrollment_id,student_id,program_id,group_id) values($1,$2,$3,$4,$5)',[f.institutions.A,f.pe.a1.id,f.students.a1.id,f.programs.a.id,f.groups.aOther.id],'23503');
    await denied('insert into public.teacher_assignments(institution_id,teacher_id,program_id,group_id) values($1,$2,$3,$4)',[f.institutions.A,f.teachers.teacher.id,f.programs.a.id,f.groups.aOther.id],'23503');
  });
  it('duplicate active enrollment is rejected',async()=>{
    await actor('adminA');await denied("insert into public.institution_enrollments(institution_id,student_id,status) values($1,$2,'ACTIVE')",[f.institutions.A,f.students.a1.id],'23505');
  });
  it('moving class closes old membership and creates a new one; retry is idempotent',async()=>{
    await actor('adminA');const [{id}]=await rows('select public.move_student_group($1,$2) id',[f.pe.a1.id,f.groups.a2.id]);
    assert.notEqual(id,f.gm.a1.id);assert.equal((await rows('select status,ended_at from public.group_memberships where id=$1',[f.gm.a1.id]))[0].status,'COMPLETED');
    assert.equal((await rows('select public.move_student_group($1,$2) id',[f.pe.a1.id,f.groups.a2.id]))[0].id,id);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
  });
  it('invalid move leaves old membership unchanged',async()=>{
    await actor('adminA');await denied('select public.move_student_group($1,$2)',[f.pe.a1.id,f.groups.b.id],'23514');
    assert.equal((await rows('select status from public.group_memberships where id=$1',[f.gm.a1.id]))[0].status,'ACTIVE');
  });
  it('historical enrollment is read-only; another tenant enrollment remains independent',async()=>{
    await actor('adminA');await q("update public.institution_enrollments set status='TRANSFERRED',ended_at=current_date where id=$1",[f.ie.a1.id]);
    await denied("update public.institution_enrollments set status='ACTIVE',ended_at=null where id=$1",[f.ie.a1.id],'23514');
    await actor('student');assert.equal((await rows('select status from public.institution_enrollments where id=$1',[f.ie.a1.id]))[0].status,'TRANSFERRED');
    assert.equal((await rows('select status from public.institution_enrollments where id=$1',[f.ie.b1.id]))[0].status,'ACTIVE');
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
  });
  it('cannot rewrite enrollment ownership even using privileged SQL',async()=>{
    await denied('update public.student_profiles set institution_id=$1 where id=$2',[f.institutions.B,f.students.a1.id],'23514');
    await denied('update public.group_memberships set group_id=$1 where id=$2',[f.groups.a2.id,f.gm.a1.id],'23514');
  });
  it('soft delete hides a student and blocks new activity against that parent',async()=>{
    await actor('adminA');await q("select public.soft_delete_record('student_profiles',$1)",[f.students.a1.id]);
    assert.ok(!(await ids('student_profiles')).includes(f.students.a1.id));
    await denied('insert into public.institution_enrollments(institution_id,student_id) values($1,$2)',[f.institutions.A,f.students.a1.id],'23514');
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[]);
  });
  it('soft-deleted guardian and group revoke access paths',async()=>{
    await q('update public.guardian_profiles set deleted_at=now() where id=$1',[f.guardians.A.id]);
    await q('update public.groups set deleted_at=now() where id=$1',[f.groups.a1.id]);
    await actor('guardian');assert.deepEqual(await ids('student_profiles'),[]);
    await actor('teacher');assert.deepEqual(await ids('student_profiles'),[f.students.b2.id]);
  });
  it('soft-delete command rejects cross-tenant, ordinary-role, and table injection requests',async()=>{
    await actor('adminA');await denied("select public.soft_delete_record('student_profiles',$1)",[f.students.b1.id]);
    await denied("select public.soft_delete_record('audit_logs',$1)",[f.students.a1.id]);
    await denied("select public.soft_delete_record('student_profiles; drop table profiles',$1)",[f.students.a1.id]);
    await actor('teacher');await denied("select public.soft_delete_record('student_profiles',$1)",[f.students.a1.id]);
  });
  it('soft-delete command is idempotent and records the deleting actor once',async()=>{
    await actor('adminA');await q("select public.soft_delete_record('student_profiles',$1)",[f.students.a2.id]);
    await q("select public.soft_delete_record('student_profiles',$1)",[f.students.a2.id]);
    const logs=await rows("select * from public.audit_logs where entity_id=$1 and action='SOFT_DELETE'",[f.students.a2.id]);
    assert.equal(logs.length,1);assert.equal(logs[0].new_value.deleted_by,f.profiles.adminA);
  });
  it('only platform administrator can suspend an institution using command',async()=>{
    await actor('adminA');await denied("select public.set_institution_status($1,'SUSPENDED')",[f.institutions.A]);
    await actor('super');await q("select public.set_institution_status($1,'SUSPENDED')",[f.institutions.A]);
    await actor('adminA');assert.deepEqual(await ids('student_profiles'),[]);
  });
  it('audit captures actual actor/tenant and before-after values atomically',async()=>{
    await actor('adminA');await q("update public.student_profiles set display_name='Nama diperbarui' where id=$1",[f.students.a1.id]);
    const [audit]=await rows("select * from public.audit_logs where entity_id=$1 and action='UPDATE'",[f.students.a1.id]);
    assert.equal(audit.actor_profile_id,f.profiles.adminA);assert.equal(audit.institution_id,f.institutions.A);
    assert.equal(audit.old_value.display_name,'Santri a1');assert.equal(audit.new_value.display_name,'Nama diperbarui');
  });
  it('clients cannot forge, update, delete, or truncate audit; server cannot alter history',async()=>{
    await actor('adminA');await denied("insert into public.audit_logs(action,entity_type) values('FAKE','fake')");await denied("update public.audit_logs set action='FAKE'");await denied('delete from public.audit_logs');await denied('truncate public.audit_logs');
    await owner();await denied("update public.audit_logs set action='FAKE'",[],'23514');
  });
  it('ordinary roles cannot read audit logs',async()=>{
    for(const name of ['teacher','guardian','student','outsider']) {await actor(name);assert.deepEqual(await ids('audit_logs'),[]);}
  });
  it('hard delete cannot cascade into educational history',async()=>{
    await denied('delete from public.student_profiles where id=$1',[f.students.a1.id],['23503','23001']);
    assert.deepEqual(await rows("select conname from pg_constraint where contype='f' and confdeltype='c' and connamespace='public'::regnamespace"),[]);
  });
  it('privileged functions use a fixed search path and are not PUBLIC executable',async()=>{
    const funcs=await rows("select p.proname,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef");
    assert.ok(funcs.length>0);for(const fn of funcs){assert.ok(fn.proconfig?.some(c=>c.startsWith('search_path=')),fn.proname);assert.equal(fn.anon,false,fn.proname);}
  });
});
