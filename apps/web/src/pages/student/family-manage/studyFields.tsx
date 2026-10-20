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
        ['Class I (Upper High)', 'Class I (Upper High - ≥ ₹8,540)'],
        ['Class II (High)', 'Class II (High - ₹4,270 - ₹8,539)'],
        ['Class III (Upper Middle)', 'Class III (Upper Middle - ₹2,562 - ₹4,269)'],
        ['Class IV (Lower Middle)', 'Class IV (Lower Middle - ₹1,281 - ₹2,561)'],
        ['Class V (Poor/Lower)', 'Class V (Poor / Lower - < ₹1,281)'],
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

export interface StudyKit {
    inp: (key: keyof FamilyStudyData, label: string, placeholder?: string, readOnly?: boolean, type?: string, required?: boolean, style?: CSSProperties) => JSX.Element;
    sel: (key: keyof FamilyStudyData, label: string, options: readonly Option[], onChangeVal?: (v: string) => void) => JSX.Element;
}

export function createStudyKit(
    data: FamilyStudyData,
    _setData: (updater: (prev: FamilyStudyData) => FamilyStudyData) => void,
    setField: (key: keyof FamilyStudyData, value: string) => void
): StudyKit {
    return {
        inp: (key, label, placeholder = '', readOnly = false, type = 'text', required = false, style) => (
            <div className="form-group" style={style}>
                <label htmlFor={`study_${String(key)}`}>{label}</label>
                <input
                    type={type}
                    id={`study_${String(key)}`}
                    value={data[key] ?? ''}
                    placeholder={placeholder}
                    readOnly={readOnly}
                    required={required}
                    style={readOnly ? { background: 'rgba(109, 40, 217, 0.05)', color: 'var(--accent)', fontWeight: 650, cursor: 'not-allowed' } : undefined}
                    onChange={(e) => setField(key, e.target.value)}
                />
            </div>
        ),
        sel: (key, label, options, onChangeVal) => (
            <div className="form-group">
                <label htmlFor={`study_${String(key)}`}>{label}</label>
                <Select
                    id={`study_${String(key)}`}
                    options={options}
                    value={data[key] ?? ''}
                    onValue={(val) => {
                        setField(key, val);
                        if (onChangeVal) onChangeVal(val);
                    }}
                />
            </div>
        ),
    };
}
