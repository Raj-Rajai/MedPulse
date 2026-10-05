/** Form-field builders for the family-manage forms (label + control inside .form-group, ids kept). */
import type { CSSProperties, InputHTMLAttributes, JSX } from 'react';
import { Select, type Option } from '../common/Select';
import type { ValidatedField } from '../../../shared/validation';
import type { FormValues } from './types';

const o = (...labels: string[]): Option[] => labels.map((l) => [l, l] as const);

export const OPT = {
    relation: o('Head of Family', 'Wife', 'Husband', 'Son', 'Daughter', 'Mother', 'Father', 'Daughter-in-law', 'Grandson', 'Granddaughter', 'Brother', 'Sister', 'Other'),
    gender: [['M', 'Male (M)'], ['F', 'Female (F)'], ['Other', 'Other']] as Option[],
    marital: o('Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'NA'),
    education: [['Illiterate', 'Illiterate'], ['Primary', 'Primary School'], ['Secondary', 'Secondary School'], ['Higher Secondary', 'Higher Secondary'], ['Graduate', 'Graduate'], ['Post Graduate', 'Post Graduate'], ['NA', 'NA / Child']] as Option[],
    work: [['Sedentary', 'Sedentary'], ['Moderate', 'Moderate'], ['Heavy', 'Heavy'], ['NA', 'NA / Child']] as Option[],
    calStatus: [['Normal', 'Normal'], ['Deficient', 'Deficient (D)'], ['Excess', 'Excess (E)']] as Option[],
    advice: [['N', 'No (N)'], ['Y', 'Yes (Y)']] as Option[],
    condCategory: [['Cardiovascular', 'Cardiovascular'], ['Endocrine/Metabolic', 'Endocrine / Metabolic'], ['Respiratory', 'Respiratory'], ['Gastrointestinal', 'Gastrointestinal'], ['Neurological', 'Neurological'], ['Musculoskeletal', 'Musculoskeletal'], ['Infectious Disease', 'Infectious Disease'], ['Renal/Genitourinary', 'Renal / Genitourinary'], ['Mental Health', 'Mental Health'], ['Oncology', 'Oncology'], ['Other', 'Other']] as Option[],
    condStatus: o('Active', 'Controlled', 'In Remission', 'Resolved'),
    severity3: o('Mild', 'Moderate', 'Severe'),
    medFreq: o('OD (Once daily)', 'BD (Twice daily)', 'TDS (Thrice daily)', 'QID (4 times daily)', 'PRN (As needed)', 'Weekly'),
    medRoute: o('Oral', 'Inhalation', 'Topical', 'Injection', 'Other'),
    medAdherence: [['Good', 'Good (Regular)'], ['Irregular', 'Irregular (Misses doses)'], ['Discontinued', 'Discontinued']] as Option[],
    algType: o('Drug', 'Food', 'Environmental', 'Other'),
    algSeverity: o('Mild', 'Moderate', 'Severe', 'Life-threatening'),
    histType: o('Surgery', 'Hospitalization', 'Major Illness', 'Trauma / Accident', 'Other'),
    smoking: [['Never', 'Never'], ['Former', 'Former (Quit)'], ['Current', 'Current Smoker / Chewer'], ['Occasional', 'Occasional']] as Option[],
    alcohol: [['Never', 'Never'], ['Occasional', 'Occasional'], ['Regular', 'Regular'], ['Former', 'Former (Quit)']] as Option[],
    diet: o('Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'),
    physical: o('Sedentary', 'Moderate', 'Active', 'Very Active'),
    salt: [['Normal', 'Normal'], ['High', 'High (Extra salt added)'], ['Restricted', 'Restricted (Low sodium)']] as Option[],
    compliance: [['Good', 'Good (Regular medicine/diet)'], ['Irregular', 'Irregular (Misses doses)'], ['Not Taking', 'Not Taking (Discontinued)'], ['NA', 'NA / No Medication']] as Option[],
    progress: o('Improved', 'Stable', 'Deteriorated'),
} as const;

type InputAttrs = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>;

export interface FieldKit {
    inp: (id: string, label: string, attrs?: InputAttrs, groupStyle?: CSSProperties) => JSX.Element;
    phone: (id: string, label: string, field: ValidatedField, attrs?: InputAttrs) => JSX.Element;
    sel: (id: string, label: string, options: readonly Option[], onValue?: (v: string) => void) => JSX.Element;
    area: (id: string, label: string, attrs: { rows: number; placeholder: string; required?: boolean }, groupStyle?: CSSProperties) => JSX.Element;
}

/** Builders bound to one form's values; `set(id, value)` updates a single field. */
export function fieldKit(form: FormValues, set: (id: string, v: string) => void): FieldKit {
    return {
        inp: (id, label, attrs = {}, groupStyle) => (
            <div className="form-group" style={groupStyle}>
                <label htmlFor={id}>{label}</label>
                <input type="text" {...attrs} id={id} value={form[id] ?? ''} onChange={(e) => set(id, e.target.value)} />
            </div>
        ),
        phone: (id, label, field, attrs = {}) => (
            <div className="form-group">
                <label htmlFor={id}>{label}</label>
                <input
                    type="tel" {...attrs} {...field.inputProps} id={id} className={field.className} value={form[id] ?? ''}
                    onChange={(e) => { set(id, e.target.value); field.onInput(e.target.value); }} onBlur={(e) => field.onInput(e.target.value)}
                />
                {field.hints}
            </div>
        ),
        sel: (id, label, options, onValue) => (
            <div className="form-group">
                <label htmlFor={id}>{label}</label>
                <Select id={id} options={options} value={form[id] ?? ''} onValue={onValue || ((v) => set(id, v))} />
            </div>
        ),
        area: (id, label, attrs, groupStyle) => (
            <div className="form-group" style={groupStyle}>
                <label htmlFor={id}>{label}</label>
                <textarea {...attrs} id={id} value={form[id] ?? ''} onChange={(e) => set(id, e.target.value)} />
            </div>
        ),
    };
}
