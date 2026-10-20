/** The member survey <form> of entry.html (sections cleared for new structure). */
import type { ReactNode } from 'react';
import type { MuacStatus, SurveyForm, Whr } from './survey';

export interface SurveyFormProps {
    f: SurveyForm;
    onField: (id: string, value: string) => void;
    sections: { adult: boolean; female: boolean; male: boolean; pediatric: boolean };
    bmi: ReactNode;
    whr: Whr | null;
    femaleAlert: Whr | null;
    maleAlert: Whr | null;
    muac: MuacStatus;
    actionTarget: string;
    saving: 'save' | 'next' | null;
    onSave: (next: boolean) => void;
    onReset: () => void;
}

export function SurveyFormView(_p: SurveyFormProps) {
    return (
        <form id="memberSurveyForm" onSubmit={(e) => e.preventDefault()}>
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>
                    Survey form sections cleared. Ready for new form structure.
                </p>
            </div>
        </form>
    );
}

