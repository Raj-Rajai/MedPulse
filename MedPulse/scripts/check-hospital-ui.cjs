const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
// Isolated in-memory database: this suite never writes to the project's records.
const db = new Database(':memory:');
db.exec(fs.readFileSync(path.join(__dirname,'../database/schema.sql'),'utf8'));
require.cache[require.resolve('../backend/config/db')]={exports:{db,initDatabase(){}}};
db.exec(`INSERT INTO colleges(id,name,code) VALUES(1,'Test Medical College','TEST'),(2,'Other College','OTHER');
 INSERT INTO students(id,roll_number,name,college_id) VALUES(1,'235','Test Student',1),(2,'999','Other Student',2);
 INSERT INTO hospitals(id,name,code) VALUES(1,'Test FAP Hospital','H1'),(2,'Other Hospital','H2');
 INSERT INTO hospital_admins(id,hospital_id,username,name) VALUES(1,1,'test-admin','Test Hospital Admin'),(2,2,'other-admin','Other Admin');
 INSERT INTO families(id,student_id,family_code,family_no,head_of_family,village_ward) VALUES(1,1,'FAM-TEST',1,'Test Family Head','Test Village'),(2,2,'FAM-OTHER',1,'Other Family','Other Village');
 INSERT INTO family_members(id,family_id,name,age_years,gender) VALUES(1,2,'Other Hospital Patient',44,'M');
 INSERT INTO patients(id,patient_uid,name,phone,family_member_id,hospital_id,student_id,model_type) VALUES(1,'PAT-OTHER','Other Hospital Patient','9000000001',1,2,2,'Dependent');`);
const app=require('../backend/server');
(async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function request(url,{hospital=1,student,method='GET',body}={}){
  const headers={'Content-Type':'application/json'};
  if(student)headers['X-Student-Id']=String(student);else if(hospital)headers['X-Hospital-Admin-Id']=String(hospital);
  const response=await fetch(base+'/api/'+url,{headers,method,body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};
 }
 try{
  assert.equal((await request('hospital/fap/patients',{hospital:null})).status,401);
  const created=await request('families/1/members',{student:1,method:'POST',body:{name:'FAP Search Patient',age_years:36,gender:'F',contact_number:'9000000002',has_dm:'Y',rbs:175,diagnosis:'Recorded diabetes'}});
  assert.equal(created.status,201,JSON.stringify(created.data));
  let result=await request('hospital/fap/patients?search=FAP%20Search');assert.equal(result.data.total,1);const id=result.data.patients[0].id;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM patients WHERE family_member_id=?').get(id).n,0,'No patient account required');
  for(const term of ['Test Village','FAM-TEST','Test Family Head','Test Student','235','9000000002','Recorded diabetes',`FAP-${id}`])assert.equal((await request('hospital/fap/patients?search='+encodeURIComponent(term))).data.total,1,term);
  assert.equal((await request('hospital/fap/patients?condition=DM&student_id=1&university_id=1')).data.total,1);
  assert.equal((await request('hospital/fap/patients?student_id=2')).data.total,0);
  assert.equal((await request('hospital/fap/patients?search=%25')).data.total,0,'Literal wildcard search');
  assert.equal((await request('hospital/fap/patients?limit=-1')).status,400);
  assert.equal((await request('hospital/fap/patients?offset=abc')).status,400);
  assert.equal((await request('hospital/fap/patients?condition=invalid')).status,400);
  assert.equal((await request('hospital/fap/patients/1')).status,404,'Other hospital member scoped out');
  assert.equal((await request('hospital/patients/1')).status,404,'Legacy dossier also scoped');
  assert.equal((await request(`hospital/fap/patients/${id}`,{hospital:2})).status,404,'Default survey not leaked to hospital 2');
  assert.equal((await request('hospital/fap/options')).data.students.length,1);
  assert.equal((await request('hospital/fap/patients',{hospital:2})).data.total,1);
  let updated=await request(`members/${id}`,{student:1,method:'PUT',body:{name:'Updated FAP Patient',rbs:160}});assert.equal(updated.status,200,JSON.stringify(updated.data));
  assert.equal((await request('hospital/fap/patients?search=Updated')).data.total,1);
  const follow=await request(`members/${id}/follow-ups`,{student:1,method:'POST',body:{visit_date:'2026-09-23',rbs:150,clinical_notes:'Student follow-up integration check',health_progress:'Stable'}});assert.equal(follow.status,201,JSON.stringify(follow.data));
  const dossier=(await request(`hospital/fap/patients/${id}`)).data;assert.equal(dossier.vitals.rbs,160);assert.equal(dossier.follow_ups[0].rbs,150);assert.equal(dossier.follow_ups[0].student_roll,'235');assert(!JSON.stringify(dossier).includes('"pin"'));
  // Enough accessible members to verify pagination and complete database search.
  const insert=db.prepare('INSERT INTO family_members(family_id,name,member_order,age_years,gender) VALUES(1,?,?,25,\'M\')');for(let i=0;i<30;i++)insert.run('Pagination Member '+i,i+2);
  const first=(await request('hospital/fap/patients?limit=25')).data;const second=(await request('hospital/fap/patients?limit=25&offset=25')).data;assert.equal(first.total,31);assert.equal(first.patients.length,25);assert.equal(second.patients.length,6);
  assert.equal((await request('hospital/fap/patients?search=Updated')).data.total,1,'Search extends beyond first page');
  const summary=(await request('hospital/fap/summary')).data;assert.equal(summary.totals.patients,31);assert.equal(summary.totals.follow_ups,1);
  console.log('PASS: student create/update/follow-up → hospital search & dossier, account-free records, search fields, filters, pagination, validation, authentication and cross-hospital scoping.');
  if(process.env.FAP_BROWSER==='1'){
   const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
   const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
   try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('medpulse_hospital_admin',JSON.stringify({id:1,name:'Test Hospital Admin'})));
    await page.goto(base+'/hospital/');await page.locator('#patientTable tbody tr').first().waitFor();
    assert.equal(await page.locator('#patientTable tbody tr').count(),25);
    await page.locator('#nextPage').click();await page.waitForFunction(()=>document.getElementById('pageInfo').textContent.startsWith('26–31'));
    await page.locator('#patientSearch').fill('Updated');await page.waitForFunction(()=>document.getElementById('patientCount').textContent==='1 matching records');
    await page.locator('[data-patient]').click();await page.waitForFunction(()=>document.getElementById('modalBody').textContent.includes('Student follow-up integration check'));
    assert.match(await page.locator('#modalBody').textContent(),/160/);await page.keyboard.press('Escape');
    await page.locator('#patientSearch').fill('no-such-patient');await page.waitForFunction(()=>document.getElementById('patientTable').textContent.includes('No matching'));
    await page.locator('#clearFilters').click();await page.waitForFunction(()=>document.getElementById('patientCount').textContent==='31 matching records');
    await page.locator('[data-condition="NoFollowUp"]').click();await page.waitForFunction(()=>document.getElementById('patientCount').textContent==='30 matching records');
    await page.locator('[data-view="network"]').click();await page.locator('[data-student="1"]').click();await page.waitForFunction(()=>document.getElementById('patientCount').textContent==='31 matching records');
    await page.locator('[data-view="overview"]').click();
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../artifacts/fap-desktop.png'),fullPage:true});
    for(const width of [390,768,1024]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390){await page.screenshot({path:path.join(__dirname,'../artifacts/fap-mobile.png'),fullPage:true});await page.locator('#menuButton').click();await page.locator('[data-view="patients"]').click();assert.equal(await page.locator('#menuButton').getAttribute('aria-expanded'),'false');}}
    await page.route('**/api/hospital/fap/patients?**',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Test connection failure"}'}));
    await page.locator('#patientSearch').fill('failure');await page.locator('#loadError').waitFor({state:'visible'});assert.match(await page.locator('#patientTable').textContent(),/could not be loaded/);
    await page.unroute('**/api/hospital/fap/patients?**');await page.locator('#clearFilters').click();await page.locator('#retryButton').click();await page.waitForFunction(()=>document.getElementById('patientCount').textContent==='31 matching records');
    assert.deepEqual(errors,[]);const anonymous=await browser.newPage();await anonymous.goto(base+'/hospital/');await anonymous.waitForURL(/login/);await anonymous.close();
    console.log('PASS: browser FAP search, detail/follow-ups, pagination, filters, student navigation, responsive layouts, failed-request recovery, auth redirect and zero JS errors.');
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


