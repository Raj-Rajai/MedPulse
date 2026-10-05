// End-to-end UI regression: a disposable database, real API, and two isolated browser sessions.
// RSSI is provided by the test fixture, not by production browser code or real hardware.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'medpulse-attendance-ui-'));
    const file = path.join(dir,'test.db');
    process.env.MEDPULSE_DB_PATH = file;
    const { createApp } = require('../../api/dist/main');
    const { DatabaseService } = require('../../api/dist/database/database.service');
    let app, browser;
    try {
        app = await createApp();
        const db = app.get(DatabaseService).db;
        db.exec(`INSERT OR IGNORE INTO colleges (id,name,code) VALUES(1,'Test College','TST');
            INSERT INTO admins (id,username,name,university_id,role) VALUES(99001,'attendance-ui-test','Dr. Meera Shah',1,'University Admin');
            INSERT INTO students (id,name,roll_number,college_id,batch_year) VALUES
                (99001,'Aarav Patel','99001',1,'3rd Year MBBS'), (99002,'Ananya Shah','99002',1,'3rd Year MBBS');
            INSERT INTO academic_lectures (id,college_id,lecture_date,lecture_no,subject_code,subject_name,room_no,faculty_name,topic)
                VALUES(99001,1,'2000-01-01',1,'ATT-TEST','Clinical Skills','Lecture Theatre 1','Dr. Meera Shah','Clinical Skills Attendance');`);
        await app.listen(0,'127.0.0.1');
        const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
        browser = await chromium.launch({ headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
        const faculty = await browser.newContext({ viewport:{width:1440,height:1000} });
        const student = await browser.newContext({ viewport:{width:390,height:844} });
        await faculty.addInitScript(() => localStorage.setItem('medpulse_admin',JSON.stringify({id:99001,username:'attendance-ui-test',name:'Dr. Meera Shah',role:'University Admin',university_id:1})));
        await student.addInitScript(() => localStorage.setItem('medpulse_user',JSON.stringify({id:99001,roll_number:'99001',name:'Aarav Patel',college_id:1,batch_year:'3rd Year MBBS'})));
        const facultyPage = await faculty.newPage(), studentPage = await student.newPage();
        const pageErrors = [];
        facultyPage.on('pageerror',error=>pageErrors.push(error.message));
        studentPage.on('pageerror',error=>pageErrors.push(error.message));
        await studentPage.goto(base+'/student/profile.html');
        await studentPage.getByRole('button',{name:/View waiting room/}).click();
        await studentPage.getByRole('heading',{name:'Waiting for faculty',exact:true}).waitFor();
        console.log('Student no-session waiting state verified.');
        assert.equal(await studentPage.getByRole('button',{name:'Submit attendance',exact:true}).count(),0);
        await facultyPage.goto(base+'/admin/admin.html');
        await facultyPage.getByText('Academic Schedule',{exact:true}).click();
        await facultyPage.getByRole('button',{name:'Take attendance',exact:true}).first().click();
        await facultyPage.getByRole('heading',{name:'Prepare your attendance room'}).waitFor();
        await facultyPage.getByText('Aarav Patel',{exact:true}).last().waitFor();
        assert.equal(await facultyPage.getByLabel('Radius (metres)',{exact:true}).inputValue(),'1');
        // Select only our two students in case the baseline seeds other cohorts.
        const selectAll = facultyPage.getByLabel('Select visible students',{exact:true});
        if(await selectAll.isChecked()) await selectAll.uncheck();
        await facultyPage.getByLabel(/Aarav Patel/).check();
        await facultyPage.getByLabel(/Ananya Shah/).check();
        const out = path.resolve(__dirname,'../../../artifacts/attendance');
        fs.mkdirSync(out,{recursive:true});
        await facultyPage.locator('dialog.mp-attendance').screenshot({path:path.join(out,'faculty-setup.png')});
        await facultyPage.getByRole('button',{name:'Open waiting room',exact:true}).click();
        await facultyPage.getByRole('heading',{name:'Attendance waiting room',exact:true}).waitFor();
        console.log('Faculty opened a live session.');
        await studentPage.getByRole('button',{name:/Attendance is open.*Clinical Skills/}).click();
        await studentPage.getByRole('button',{name:'Join waiting room',exact:true}).click();
        await studentPage.getByRole('heading',{name:'You’re in the waiting room',exact:true}).waitFor();
        assert.equal(await studentPage.getByRole('button',{name:'Awaiting verification',exact:true}).isDisabled(),true);
        await facultyPage.getByText('Awaiting proximity',{exact:true}).waitFor();
        await facultyPage.locator('dialog.mp-attendance').screenshot({path:path.join(out,'faculty-live.png')});
        await studentPage.locator('dialog.mp-attendance').screenshot({path:path.join(out,'student-waiting-mobile.png')});
        assert.equal(await studentPage.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
        await facultyPage.getByRole('button',{name:'Back to schedule',exact:true}).click();
        await facultyPage.getByRole('button',{name:'Open waiting room',exact:true}).first().click();
        await facultyPage.getByRole('heading',{name:'Attendance waiting room',exact:true}).waitFor();
        const cluster = db.prepare('SELECT id FROM attendance_clusters WHERE lecture_id=99001').get();
        assert.ok(cluster);
        const request = async (route,body,headers) => {
            const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
            const payload=await response.json(); return {status:response.status,...payload};
        };
        assert.equal((await request('/api/academic/attendance/fill',{cluster_id:cluster.id},{'X-Student-Id':'99001'})).status,403);
        const challenge=await request(`/api/academic/attendance/clusters/${cluster.id}/challenge`,{},{'X-Student-Id':'99001'});
        assert.equal(challenge.status,200);
        await new Promise(resolve=>setTimeout(resolve,1600));
        const token = await facultyPage.evaluate(id=>sessionStorage.getItem(`medpulse:attendance-anchor:${id}`),cluster.id);
        const now=Date.now();
        const observed=await request(`/api/admin/academic/attendance/clusters/${cluster.id}/observations`,{
            student_id:99001,challenge:challenge.challenge,
            samples:Array.from({length:5},(_,i)=>({rssi:-55,observed_at:now-1300+i*300})),
        },{'X-Admin-Id':'99001','X-Attendance-Anchor-Token':token});
        assert.equal(observed.allowed,true);
        await studentPage.getByRole('button',{name:'Submit attendance',exact:true}).click();
        await studentPage.getByRole('heading',{name:'You’re marked present',exact:true}).waitFor();
        console.log('Verified student submitted attendance.');
        await studentPage.locator('dialog.mp-attendance').screenshot({path:path.join(out,'student-success-mobile.png')});
        await facultyPage.getByRole('button',{name:'End session',exact:true}).click();
        await facultyPage.getByRole('button',{name:'Confirm end session',exact:true}).click();
        await facultyPage.getByRole('heading',{name:'Attendance complete',exact:true}).waitFor();
        await facultyPage.getByText('Absent',{exact:true}).last().waitFor();
        assert.equal(db.prepare('SELECT status FROM academic_attendance WHERE student_id=99001 AND lecture_id=99001').get().status,'Present');
        assert.equal(db.prepare('SELECT status FROM academic_attendance WHERE student_id=99002 AND lecture_id=99001').get().status,'Absent');
        await facultyPage.setViewportSize({width:390,height:844});
        await facultyPage.locator('dialog.mp-attendance').screenshot({path:path.join(out,'faculty-closed-mobile.png')});
        assert.equal(await facultyPage.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
        assert.deepEqual(pageErrors,[]);
        console.log('PASS: faculty setup, live roster, student waiting, gated submit, present, room resume, early close, absence, and mobile layouts.');
        console.log('Screenshots: '+out);
    } catch (error) {
        if (browser) {
            const out = path.resolve(__dirname,'../../../artifacts/attendance');
            fs.mkdirSync(out,{recursive:true});
            for (const [index, context] of browser.contexts().entries()) {
                const page = context.pages()[0];
                if (page) { await page.screenshot({path:path.join(out,`failure-${index}.png`)}).catch(()=>{}); console.log('Failure page:',page.url(),(await page.locator('body').innerText()).slice(-1800)); }
            }
        }
        throw error;
    } finally {
        if(browser) await browser.close();
        if(app) { await app.close(); app.get(DatabaseService).db.close(); }
        for(const suffix of ['','-wal','-shm','-journal']) if(fs.existsSync(file+suffix)) fs.unlinkSync(file+suffix);
        fs.rmdirSync(dir);
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
