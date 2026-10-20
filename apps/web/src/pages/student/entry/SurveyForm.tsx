import { SurveyCategorySections } from './SurveyCategorySections';
import type { Member, MemberSurveyData, ProfessionalYear, SurveyStatus } from './types';

export interface SurveyFormProps {
    member: Member | null;
    surveyData: MemberSurveyData | null;
    onChangeSurveyData: (updater: (prev: MemberSurveyData) => MemberSurveyData) => void;
    currentYear: ProfessionalYear;
    status: SurveyStatus;
    saving: 'save' | 'next' | 'submit' | null;
    onSaveDraft: () => void;
    onSubmitRecord: () => void;
    onNextMember: () => void;
    hasNextMember: boolean;
}

export function SurveyFormView({
    member,
    surveyData,
    onChangeSurveyData,
    currentYear,
    status,
    saving,
    onSaveDraft,
    onSubmitRecord,
    onNextMember,
    hasNextMember,
}: SurveyFormProps) {
    if (!member || !surveyData) {
        return (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>
                    Please select a family member above to enter or view clinical survey data.
                </p>
            </div>
        );
    }

    return (
        <form id="memberSurveyForm" onSubmit={(e) => e.preventDefault()}>
            {/* Status indicator bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0.65rem 1rem', background: '#faf8ff', border: '1px solid #ede9fe', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Record Status:</span>
                    <span className={`badge ${status === 'submitted' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {status === 'submitted' ? '✓ Submitted' : '✎ Draft'}
                    </span>
                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{currentYear}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    All fields optional • Fast controls enabled
                </div>
            </div>

            {/* Categorized Clinical Sections */}
            <SurveyCategorySections
                data={surveyData}
                onChange={onChangeSurveyData}
                currentYear={currentYear}
            />

            {/* Sticky Action Footer */}
            <div
                style={{
                    position: 'sticky',
                    bottom: '1rem',
                    zIndex: 10,
                    marginTop: '2rem',
                    padding: '0.85rem 1.25rem',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                }}
            >
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    Active Member: <strong style={{ color: 'var(--text-primary)' }}>{member.name}</strong>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onSaveDraft}
                        disabled={saving !== null}
                        style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                    >
                        {saving === 'save' ? 'Saving Draft…' : '💾 Save Draft'}
                    </button>

                    {hasNextMember && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onNextMember}
                            disabled={saving !== null}
                            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                        >
                            {saving === 'next' ? 'Loading Next…' : 'Save & Next Member →'}
                        </button>
                    )}

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onSubmitRecord}
                        disabled={saving !== null}
                        style={{ fontSize: '0.85rem', padding: '0.45rem 1.25rem' }}
                    >
                        {saving === 'submit' ? 'Submitting…' : '✓ Submit Survey'}
                    </button>
                </div>
            </div>
        </form>
    );
}
