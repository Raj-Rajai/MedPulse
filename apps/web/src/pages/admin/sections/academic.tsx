/** Option lists shared by the Attendance and Exam consoles (same values and labels as the original selects). */
export interface Option { value: string; label: string }

export const SUBJECTS: Option[] = [
    { value: 'PA-301', label: 'PA-301 – Department of Pathology' },
    { value: '2010043342', label: '2010043342 – Community Medicine (PSM)' },
    { value: '2010043410', label: '2010043410 – Ophthalmology' },
    { value: '2010043425', label: '2010043425 – ENT (Otorhinolaryngology)' },
    { value: '2010043320', label: '2010043320 – Forensic Medicine (FMT)' },
    { value: '2010043375', label: '2010043375 – General Surgery' },
    { value: '2010043350', label: '2010043350 – General Medicine' },
    { value: '2010043360', label: '2010043360 – Obstetrics & Gynaecology' },
    { value: '2010043380', label: '2010043380 – Paediatrics' },
];

export const labelOf = (opts: Option[], value: string): string | undefined => opts.find((o) => o.value === value)?.label;

export function Options({ list }: { list: Option[] }) {
    return <>{list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</>;
}
