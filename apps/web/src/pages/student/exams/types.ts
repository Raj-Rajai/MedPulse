export interface Score { obtained: number; max?: number; percentage: number; passed?: boolean }
export interface Exam {
    exam_type?: string;
    exam_name?: string;
    exam_code?: string;
    exam_date?: string;
    term?: string;
    academic_year?: string;
    subject?: string;
    subject_code?: string;
    status?: string;
    grade?: string;
    is_two_paper?: boolean;
    paper1?: Score;
    paper2?: Score;
    theory: Score;
    practical: Score;
    total: Score;
    faculty_remarks?: string;
}

export const termBadgeClassOf = (t?: string) =>
    t === 'IA-2' ? 'badge-ia2' : t === 'Preliminary' ? 'badge-prelim' : t === 'University' ? 'badge-univ' : 'badge-ia1';

export const isDistinctionOf = (ex: Exam) => ex.status === 'Distinction' || !!(ex.grade && ex.grade.toLowerCase().includes('distinction'));
