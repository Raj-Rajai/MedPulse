import type { Db } from '../database/db.types';

export function seedAcademicSchedule(db: Db): void {
    const lectureCount = db.prepare('SELECT COUNT(*) as count FROM academic_lectures').get() as { count: number };
    if (lectureCount && lectureCount.count > 0) return;

    console.log('🌱 Seeding NMC CBME Academic & Teaching Schedule for College 1...');

    const sessions = [
        {
            college_id: 1,
            lecture_date: '2026-10-02',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Theory',
            time_slot: '09:00 - 10:00 AM',
            room_no: 'Lecture Theatre 1 (LT-1)',
            faculty_name: 'Dr. Ramesh Mehta (Prof & HOD)',
            topic: 'PA 12.1: Etiopathogenesis and laboratory diagnosis of Iron Deficiency Anaemia & Megaloblastic Anaemia',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-02',
            lecture_no: 2,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Practical',
            time_slot: '11:00 AM - 01:00 PM',
            room_no: 'Pathology Practical Lab 2',
            faculty_name: 'Dr. Anjali Verma (Assoc. Prof)',
            topic: 'PA 12.3: DOAP: Peripheral blood smear examination - Identification of Microcytic Hypochromic & Macrocytic red cells',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-03',
            lecture_no: 1,
            subject_code: '2010043342',
            subject_name: 'Community Medicine',
            session_type: 'Theory',
            time_slot: '09:00 - 10:00 AM',
            room_no: 'LT-2',
            faculty_name: 'DRASHTI R SONI',
            topic: 'CM 5.1: Principles of epidemiology: Epidemiological triad, disease transmission dynamics and surveillance indices',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-05',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Theory',
            time_slot: '09:00 - 10:00 AM',
            room_no: 'Lecture Theatre 1 (LT-1)',
            faculty_name: 'Dr. Ramesh Mehta (Prof & HOD)',
            topic: 'PA 4.2: Acute Inflammation: Cellular events, chemotaxis, phagocytosis and chemical mediators',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-06',
            lecture_no: 1,
            subject_code: '2010043342',
            subject_name: 'Community Medicine',
            session_type: 'Theory',
            time_slot: '10:00 - 11:00 AM',
            room_no: 'LT-2',
            faculty_name: 'DRASHTI R SONI',
            topic: 'CM 8.2: National Health Programmes: Maternal and child health (RMNCH+A) and immunization schedules',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-07',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Practical',
            time_slot: '02:00 - 04:00 PM',
            room_no: 'Pathology Histopathology Lab',
            faculty_name: 'Dr. Anjali Verma (Assoc. Prof)',
            topic: 'PA 16.3: DOAP: Gross and microscopic examination of Atherosclerosis, Chronic Venous Congestion of Liver and Spleen',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-08',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Theory',
            time_slot: '09:00 - 10:00 AM',
            room_no: 'Lecture Theatre 1 (LT-1)',
            faculty_name: 'Dr. Ramesh Mehta (Prof & HOD)',
            topic: 'PA 20.2: Neoplasia: Molecular biology of cancer, proto-oncogenes, tumor suppressor genes and multistep carcinogenesis',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-09',
            lecture_no: 1,
            subject_code: '2010043342',
            subject_name: 'Community Medicine',
            session_type: 'Practical',
            time_slot: '11:00 AM - 01:00 PM',
            room_no: 'RHTC Field Training Centre - Ward 4',
            faculty_name: 'DRASHTI R SONI',
            topic: 'CM 12.3: DOAP: Family Health Survey Assessment - Calculation of consumption units, calorie deficiency and dietary counseling',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-12',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Theory',
            time_slot: '09:00 - 10:00 AM',
            room_no: 'Lecture Theatre 1 (LT-1)',
            faculty_name: 'Dr. Ramesh Mehta (Prof & HOD)',
            topic: 'PA 14.1: Haemostasis and Thrombosis: Normal haemostasis, pathogenesis of thrombosis, Virchow triad and embolism',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-13',
            lecture_no: 1,
            subject_code: '2010043342',
            subject_name: 'Community Medicine',
            session_type: 'Theory',
            time_slot: '10:00 - 11:00 AM',
            room_no: 'LT-2',
            faculty_name: 'DRASHTI R SONI',
            topic: 'CM 14.1: Occupational Health: Pneumoconiosis, lead poisoning, ergonomic hazards and Occupational Safety Legislation',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-14',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Practical',
            time_slot: '02:00 - 04:00 PM',
            room_no: 'Blood Bank / Haematology Lab',
            faculty_name: 'Dr. Anjali Verma (Assoc. Prof)',
            topic: 'PA 25.1: DOAP: Blood banking principles, donor selection, blood component preparation and screening for transfusion transmitted infections',
        },
        {
            college_id: 1,
            lecture_date: '2026-10-16',
            lecture_no: 1,
            subject_code: 'PA-301',
            subject_name: 'Department of Pathology',
            session_type: 'Theory',
            time_slot: '09:00 - 10:00 AM',
            room_no: 'Lecture Theatre 1 (LT-1)',
            faculty_name: 'Dr. Ramesh Mehta (Prof & HOD)',
            topic: 'PA 18.2: Granulomatous Inflammation: Tuberculosis, Leprosy, Sarcoidosis and Syphilis morphology',
        },
    ];

    const insert = db.prepare(`
        INSERT OR IGNORE INTO academic_lectures (college_id, lecture_date, lecture_no, subject_code, subject_name, session_type, time_slot, room_no, faculty_name, topic)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of sessions) {
        insert.run(
            s.college_id,
            s.lecture_date,
            s.lecture_no,
            s.subject_code,
            s.subject_name,
            s.session_type,
            s.time_slot,
            s.room_no,
            s.faculty_name,
            s.topic
        );
    }

    console.log(`✅ Seeded ${sessions.length} academic teaching schedule sessions.`);
}
