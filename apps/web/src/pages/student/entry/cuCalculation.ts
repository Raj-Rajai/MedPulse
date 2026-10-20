/**
 * Calculation of Coefficient / Consumption Unit (CU)
 * Strictly adheres to Master Prompt Sections 40, 41, 42, 43 and calculate-ai.pdf (p. 44).
 */

export type WorkType = 'Sedentary' | 'Moderate' | 'Heavy';
export type PhysiologicalStatus = 'None' | 'Pregnancy' | 'Lactation';

export function calculateMemberCU(
    ageYears: number,
    gender: string | null | undefined,
    workType: WorkType | string = 'Moderate',
    physiologicalStatus: PhysiologicalStatus | string = 'None'
): number {
    const age = Number(ageYears) || 0;
    const isFemale = (gender || '').toUpperCase() === 'F';
    const isMale = (gender || '').toUpperCase() === 'M';

    let baseCu = 1.0;

    // Age / Category mapping (Master Prompt Section 40)
    if (age < 1) {
        baseCu = 0.0;
    } else if (age >= 1 && age < 3) {
        baseCu = 0.4;
    } else if (age >= 3 && age < 5) {
        baseCu = 0.5;
    } else if (age >= 5 && age < 7) {
        baseCu = 0.6;
    } else if (age >= 7 && age < 9) {
        baseCu = 0.7;
    } else if (age >= 9 && age < 12) {
        baseCu = 0.8;
    } else if (age >= 12 && age < 21) {
        baseCu = 1.0;
    } else {
        // Adult (age >= 21)
        const wt = String(workType || 'Moderate').toLowerCase();
        if (isFemale) {
            if (wt.startsWith('s')) baseCu = 0.8;
            else if (wt.startsWith('h')) baseCu = 1.2;
            else baseCu = 0.9; // Moderate
        } else if (isMale) {
            if (wt.startsWith('s')) baseCu = 1.0;
            else if (wt.startsWith('h')) baseCu = 1.6;
            else baseCu = 1.2; // Moderate
        } else {
            // General adult default
            if (wt.startsWith('s')) baseCu = 0.9;
            else if (wt.startsWith('h')) baseCu = 1.4;
            else baseCu = 1.1;
        }
    }

    // Physiological status additions (Females only, Section 40)
    let addition = 0;
    if (isFemale) {
        const phys = String(physiologicalStatus || '').toLowerCase();
        if (phys.includes('preg')) addition = 1.4;
        else if (phys.includes('lact')) addition = 2.5;
    }

    return parseFloat((baseCu + addition).toFixed(2));
}

/**
 * Calculates the total Consumption Units of a family.
 * Strictly ignores empty/invalid entries and rounds to 2 decimal places.
 */
export function calculateFamilyTotalCU(memberCUs: number[]): number {
    const sum = memberCUs.reduce((acc, cu) => acc + (Number(cu) || 0), 0);
    return parseFloat(sum.toFixed(2));
}
