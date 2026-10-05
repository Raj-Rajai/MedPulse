export type Scalar = string | number | null | undefined;

/** GET /api/families row (fields the page reads). */
export interface FamilySummary {
    id: number;
    family_code?: string | null;
    family_no: number;
    head_of_family: string;
    village_ward?: string | null;
    member_count?: number;
}

/** A member as returned inside GET /api/families/:id (survey columns read by key). */
export interface Member {
    id: number;
    name?: string;
    member_order?: Scalar;
    relation_to_hof?: string | null;
    age_years?: Scalar;
    age_months?: Scalar;
    gender?: string | null;
    occupation?: string | null;
    [key: string]: Scalar;
}

/** GET /api/families/:id */
export interface FamilyDetail {
    family_code?: string | null;
    family_no?: Scalar;
    head_of_family?: string;
    village_ward?: string | null;
    total_cu?: Scalar;
    calorie_intake_per_cu?: Scalar;
    calorie_status?: string | null;
    dietary_advice_given?: string | null;
    members?: Member[];
}

export const familyCode = (f: { family_code?: string | null; family_no?: Scalar }) => f.family_code || `FAM-${String(f.family_no).padStart(4, '0')}`;

export const isSurveyDone = (m: Member) => Number(m.sbp) > 0 || Number(m.hb) > 0 || Number(m.height_m) > 0 || Number(m.muac_cm) > 0;
