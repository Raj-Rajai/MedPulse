/**
 * Option datasets and field helpers for the Family Study Journal data entry.
 * Implements the standard Select component with MedPulse styling.
 */

import type { CSSProperties, JSX } from 'react';
import { Select, type Option } from '../common/Select';
import type { FamilyStudyData } from './studyTypes';

const o = (...labels: string[]): Option[] => labels.map((l) => [l, l] as const);

export const STUDY_OPT = {
    familyType: [['Nuclear', 'Nuclear'], ['Joint', 'Joint'], ['Three generation', 'Three generation']] as Option[],
    yn: [['Y', 'Yes (Y)'], ['N', 'No (N)']] as Option[],
    yesNo: [['Yes', 'Yes'], ['No', 'No']] as Option[],
    prasadClass: [
        ['Class I (Upper Class)', 'Class I: Upper Class (≥ ₹9,769)'],
        ['Class II (Upper Middle Class)', 'Class II: Upper Middle Class (₹4,885 – ₹9,768)'],
        ['Class III (Middle Class)', 'Class III: Middle Class (₹2,931 – ₹4,884)'],
        ['Class IV (Lower Middle Class)', 'Class IV: Lower Middle Class (₹1,465 – ₹2,930)'],
        ['Class V (Lower Class)', 'Class V: Lower Class (< ₹1,465)'],
    ] as Option[],
    houseOwnership: [['Own', 'Own'], ['Rented', 'Rented']] as Option[],
    locality: [['Urban', 'Urban'], ['Urban slum', 'Urban slum'], ['Rural', 'Rural']] as Option[],
    houseType: [['Kutcha', 'Kutcha'], ['Semi pucca', 'Semi pucca'], ['Pucca', 'Pucca']] as Option[],
    roof: [['Thatched', 'Thatched (Theched)'], ['Tiled', 'Tiled'], ['Concrete', 'Concrete']] as Option[],
    floor: [['Mud', 'Mud'], ['Concrete', 'Concrete']] as Option[],
    wall: [['Mud', 'Mud'], ['Brick', 'Brick'], ['Stone', 'Stone']] as Option[],
    presentAbsent: [['Present', 'Present'], ['Absent', 'Absent']] as Option[],
    adequate: [['Adequate', 'Adequate'], ['Inadequate', 'Inadequate']] as Option[],
    kitchenSep: [['Separate', 'Separate'], ['Not separate', 'Not separate']] as Option[],
    cookingFuel: [['Gas', 'Gas (LPG / PNG)'], ['Kerosene', 'Kerosene'], ['Wood', 'Wood'], ['Coal', 'Coal'], ['Other', 'Other']] as Option[],
    waterFreq: [['Intermittent', 'Intermittent'], ['Continuous', 'Continuous']] as Option[],
    waterSource: [
        ['Municipal supply', 'Municipal supply'],
        ['Pipe', 'Piped water connection'],
        ['Hand pump', 'Hand pump'],
        ['Tank', 'Tank / Tanker'],
        ['Well (Sanitary)', 'Well (Sanitary)'],
        ['Well (Insanitary)', 'Well (Insanitary)'],
        ['Open well (Pucca)', 'Open well (Pucca)'],
        ['Open well (Kuchcha)', 'Open well (Kuchcha)'],
        ['Other', 'Other'],
    ] as Option[],
    storedWaterCover: [['Covered', 'Covered'], ['Uncovered', 'Uncovered']] as Option[],
    matkaTap: [['With tap', 'With tap'], ['Without tap', 'Without tap'], ['NA', 'NA / No Matka']] as Option[],
    waterDrawing: [['Doya', 'Doya (Ladle with handle)'], ['Glass', 'Glass (Direct dip)'], ['Direct tap', 'Direct tap'], ['Other', 'Other']] as Option[],
    bathing: [['Bathroom', 'Bathroom'], ['Open space', 'Open space']] as Option[],
    latrineFacility: [['Separate', 'Separate (Private)'], ['Common', 'Common (Shared)'], ['Open field', 'Open field']] as Option[],
    latrineType: [['RCA', 'RCA'], ['Other', 'Other'], ['NA', 'NA / No Latrine']] as Option[],
    latrineWaterSupply: [['Adequate', 'Adequate'], ['Non adequate', 'Non adequate']] as Option[],
    refuseDisposal: [
        ['Municipality', 'Municipality collection'],
        ['Dumping', 'Dumping'],
        ['Composting', 'Composting'],
        ['Burning', 'Burning'],
        ['Indiscriminate throwing', 'Indiscriminate throwing'],
        ['Land fill', 'Land fill'],
    ] as Option[],
    wasteWaterDisposal: [
        ['Pipe drainage system', 'Pipe drainage system'],
        ['Soak pit', 'Soak pit'],
        ['Open', 'Open drainage'],
    ] as Option[],
    animalType: [['Domestic', 'Domestic (Cattle/Milch)'], ['Pet', 'Pet'], ['None', 'None'], ['Others', 'Others (specify)']] as Option[],
    stableCowshed: [['Absent', 'Absent'], ['Present (separated)', 'Present (Separated)'], ['Present (not separated)', 'Present (Not separated)']] as Option[],
    indoorPestsList: o('Mosquito', 'Fly', 'Cockroach', 'Rat flea', 'Louse', 'Rat', 'None'),
    // Requirement: Psychosocial environment option-wise: Good / Bad
    psychosocial: [['Good', 'Good'], ['Bad', 'Bad']] as Option[],
    healthFacilityType: [
        ['Govt. (Allopathy)', 'Govt. (Allopathy)'],
        ['Govt. (AYUSH)', 'Govt. (AYUSH)'],
        ['Non govt. (Allopathy)', 'Non govt. (Allopathy)'],
        ['Non govt. (AYUSH)', 'Non govt. (AYUSH)'],
    ] as Option[],
} as const;

/** Normalizes any legacy Prasad values (e.g. from previous drafts) to the new classification */
export function normalizePrasadClass(val: string): string {
    if (!val) return 'Class III (Middle Class)';
    if (val.includes('Class I')) return 'Class I (Upper Class)';
    if (val.includes('Class II')) return 'Class II (Upper Middle Class)';
    if (val.includes('Class III')) return 'Class III (Middle Class)';
    if (val.includes('Class IV')) return 'Class IV (Lower Middle Class)';
    if (val.includes('Class V')) return 'Class V (Lower Class)';
    return val;
}

/** Determines Modified Prasad Classification from Per Capita Monthly Income */
export function getModifiedPrasadClass(perCapita: number): string {
    if (perCapita >= 9769) return 'Class I (Upper Class)';
    if (perCapita >= 4885) return 'Class II (Upper Middle Class)';
    if (perCapita >= 2931) return 'Class III (Middle Class)';
    if (perCapita >= 1465) return 'Class IV (Lower Middle Class)';
    return 'Class V (Lower Class)';
}

export interface StudyKit {
    inp: (
        key: keyof FamilyStudyData,
        label: string,
        placeholder?: string,
        readOnly?: boolean,
        type?: string,
        required?: boolean,
        style?: CSSProperties,
        className?: string
    ) => JSX.Element;
    sel: (
        key: keyof FamilyStudyData,
        label: string,
        options: readonly Option[],
        onChangeVal?: (v: string) => void,
        style?: CSSProperties,
        className?: string
    ) => JSX.Element;
}

export function createStudyKit(
    data: FamilyStudyData,
    _setData: (updater: (prev: FamilyStudyData) => FamilyStudyData) => void,
    setField: (key: keyof FamilyStudyData, value: string) => void
): StudyKit {
    return {
        inp: (key, label, placeholder = '', readOnly = false, type = 'text', required = false, style, className) => (
            <div className={`form-group ${className || ''}`.trim()} style={style}>
                <label htmlFor={`study_${String(key)}`}>{label}</label>
                <input
                    type={type}
                    id={`study_${String(key)}`}
                    value={data[key] ?? ''}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    required={required}
                    style={readOnly ? { background: '#faf7ff', borderColor: '#ede9fe', color: '#7c3aed', fontWeight: 600, cursor: 'default' } : undefined}
                    onChange={(e) => setField(key, e.target.value)}
                />
            </div>
        ),
        sel: (key, label, options, onChangeVal, style, className) => {
            const rawVal = data[key] ?? '';
            const val = key === 'modified_prasad_class' && rawVal ? normalizePrasadClass(rawVal) : rawVal;
            return (
                <div className={`form-group ${className || ''}`.trim()} style={style}>
                    <label htmlFor={`study_${String(key)}`}>{label}</label>
                    <Select
                        id={`study_${String(key)}`}
                        options={options}
                        value={val}
                        onValue={(newVal) => {
                            setField(key, newVal);
                            if (onChangeVal) onChangeVal(newVal);
                        }}
                    />
                </div>
            );
        },
    };
}
