const { db } = require('../config/db');
// Student-created patient accounts currently use hospital 1. Survey-only members
// follow that same default until an explicit patient hospital link exists.
const FROM = `FROM family_members fm JOIN families f ON f.id = fm.family_id
 JOIN students s ON s.id = f.student_id LEFT JOIN colleges c ON c.id = s.college_id`;
const SCOPE = `(EXISTS (SELECT 1 FROM patients p WHERE p.family_member_id = fm.id AND p.hospital_id = ?)
 OR (? = 1 AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.family_member_id = fm.id)))`;
const conditionSQL = {
 HTN: `(fm.has_htn = 'Y' OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND mc.condition_name LIKE '%hypertension%'))`,
 DM: `(fm.has_dm = 'Y' OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND mc.condition_name LIKE '%diabetes%'))`,
 Anaemia: `(fm.has_anaemia = 'Y' OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND (mc.condition_name LIKE '%anaemia%' OR mc.condition_name LIKE '%anemia%')))`,
 Pediatric: `(fm.age_years <= 5)`,
 NoFollowUp: `NOT EXISTS (SELECT 1 FROM follow_ups fu WHERE fu.member_id=fm.id)`
};
function where(hospitalId, filters = {}) {
 let sql = SCOPE; const args = [hospitalId, hospitalId];
 for (const [key,column] of [['student_id','s.id'],['university_id','c.id']]) {
  if(filters[key]) { sql += ` AND ${column} = ?`;args.push(filters[key]); }
 }
 if(filters.condition && conditionSQL[filters.condition]) sql += ` AND ${conditionSQL[filters.condition]}`;
 if(filters.search?.trim()) {
  const term = `%${filters.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const fields=['fm.name','fm.contact_number','f.contact_number','f.family_code','f.head_of_family','f.village_ward','f.village','f.address','s.name','s.roll_number','c.name','fm.diagnosis',"('FAP-' || fm.id)"];
  sql += ` AND (${fields.map(x=>`${x} LIKE ? ESCAPE '\\'`).join(' OR ')}
   OR EXISTS (SELECT 1 FROM member_conditions mc WHERE mc.member_id=fm.id AND mc.condition_name LIKE ? ESCAPE '\\')
   OR EXISTS (SELECT 1 FROM patients p WHERE p.family_member_id=fm.id AND p.hospital_id=? AND (p.patient_uid LIKE ? ESCAPE '\\' OR p.phone LIKE ? ESCAPE '\\')))`;
  args.push(...fields.map(()=>term),term,hospitalId,term,term);
 }
 return {sql,args};
}
const selection = `fm.id, fm.name, fm.age_years, fm.age_months, fm.gender, fm.contact_number,
 fm.has_htn, fm.sbp, fm.dbp, fm.has_dm, fm.rbs, fm.has_anaemia, fm.hb, fm.bmi, fm.diagnosis,
 f.id AS family_id, f.family_code, f.head_of_family, COALESCE(NULLIF(f.village_ward,''), f.village) AS village,
 f.survey_date, s.id AS student_id, s.name AS student_name, s.roll_number AS student_roll,
 c.id AS university_id, c.name AS university_name,
 (SELECT GROUP_CONCAT(mc.condition_name, ', ') FROM member_conditions mc WHERE mc.member_id=fm.id) AS conditions_summary,
 (SELECT COUNT(*) FROM follow_ups fu WHERE fu.member_id=fm.id) AS follow_up_count,
 (SELECT MAX(fu.visit_date) FROM follow_ups fu WHERE fu.member_id=fm.id) AS last_visit`;
module.exports = {
 list(hospitalId, filters) {
  const {sql,args}=where(hospitalId,filters);
  const total=db.prepare(`SELECT COUNT(*) AS total ${FROM} WHERE ${sql}`).get(...args).total;
  const patients=db.prepare(`SELECT ${selection} ${FROM} WHERE ${sql} ORDER BY fm.id DESC LIMIT ? OFFSET ?`).all(...args,filters.limit,filters.offset);
  return {patients,total,limit:filters.limit,offset:filters.offset};
 },
 summary(hospitalId) {
  const {sql,args}=where(hospitalId);
  const totals=db.prepare(`SELECT COUNT(*) AS patients, COUNT(DISTINCT f.id) AS families,
   COUNT(DISTINCT s.id) AS students, COALESCE(SUM((SELECT COUNT(*) FROM follow_ups fu WHERE fu.member_id=fm.id)),0) AS follow_ups
   ${FROM} WHERE ${sql}`).get(...args);
  const conditions=Object.entries(conditionSQL).map(([key,expression])=>({key,count:db.prepare(`SELECT COUNT(*) AS n ${FROM} WHERE ${sql} AND ${expression}`).get(...args).n}));
  const universities=db.prepare(`SELECT c.id, c.name, COUNT(*) AS patient_count ${FROM} WHERE ${sql} GROUP BY c.id,c.name ORDER BY patient_count DESC`).all(...args);
  return {totals,conditions,universities};
 },
 options(hospitalId) {
  const {sql,args}=where(hospitalId);
  return {
   students:db.prepare(`SELECT DISTINCT s.id,s.name,s.roll_number,s.college_id ${FROM} WHERE ${sql} ORDER BY s.name`).all(...args),
   universities:db.prepare(`SELECT DISTINCT c.id,c.name ${FROM} WHERE ${sql} AND c.id IS NOT NULL ORDER BY c.name`).all(...args)
  };
 },
 dossier(hospitalId,id) {
  const {sql,args}=where(hospitalId);
  const member=db.prepare(`SELECT ${selection} ${FROM} WHERE ${sql} AND fm.id=?`).get(...args,id);
  if(!member)return null;
  const vitals=db.prepare('SELECT * FROM family_members WHERE id=?').get(id);
  const family=db.prepare('SELECT * FROM families WHERE id=?').get(member.family_id);
  const records={};
  for(const [key,table] of [['conditions','member_conditions'],['medications','member_medications'],['allergies','member_allergies'],['history','member_medical_history']]) records[key]=db.prepare(`SELECT * FROM ${table} WHERE member_id=? ORDER BY id DESC`).all(id);
  records.lifestyle=db.prepare('SELECT * FROM member_lifestyle WHERE member_id=?').get(id)||null;
  records.follow_ups=db.prepare(`SELECT fu.*,s.name AS student_name,s.roll_number AS student_roll FROM follow_ups fu LEFT JOIN students s ON s.id=fu.student_id WHERE fu.member_id=? ORDER BY fu.visit_date DESC,fu.id DESC`).all(id);
  return {member,vitals,family,...records};
 }
};
