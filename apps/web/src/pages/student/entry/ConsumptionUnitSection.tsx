import { AccordionSectionHeader, SegmentedControl } from './FastControls';
import { calculateFamilyTotalCU, calculateMemberCU, type PhysiologicalStatus, type WorkType } from './cuCalculation';
import type { FamilySurveyRecord, Member } from './types';

export interface ConsumptionUnitSectionProps {
    members: Member[];
    surveyRecord: FamilySurveyRecord;
    onChangeSurveyRecord: (updater: (prev: FamilySurveyRecord) => FamilySurveyRecord) => void;
}

export function ConsumptionUnitSection({ members, surveyRecord, onChangeSurveyRecord }: ConsumptionUnitSectionProps) {
    const handleMemberCuUpdate = (
        memberId: number,
        updates: { workType?: string; physiologicalStatus?: string }
    ) => {
        onChangeSurveyRecord((prev) => {
            const currentMs = prev.memberSurveys[memberId];
            if (!currentMs) return prev;

            const m = members.find((x) => x.id === memberId);
            const ageY = parseInt(currentMs.age_years || String(m?.age_years || '0'), 10) || 0;
            const gender = currentMs.gender || m?.gender || 'M';
            const nextWork = (updates.workType !== undefined ? updates.workType : currentMs.work_type) as WorkType;
            const nextPhys = (updates.physiologicalStatus !== undefined ? updates.physiologicalStatus : currentMs.physiological_status) as PhysiologicalStatus;

            const newCu = calculateMemberCU(ageY, gender, nextWork, nextPhys);

            const nextMs = {
                ...currentMs,
                work_type: nextWork,
                physiological_status: nextPhys,
                consumption_unit: String(newCu),
            };

            const updatedMemberSurveys = {
                ...prev.memberSurveys,
                [memberId]: nextMs,
            };

            // Recalculate family total CU
            const allCus = members.map((mem) => {
                const s = updatedMemberSurveys[mem.id];
                return parseFloat(s?.consumption_unit || '1.0');
            });
            const newTotalCu = calculateFamilyTotalCU(allCus);

            return {
                ...prev,
                memberSurveys: updatedMemberSurveys,
                totalCu: String(newTotalCu),
            };
        });
    };

    // Calculate current list of CUs
    const cus = members.map((m) => {
        const ms = surveyRecord.memberSurveys[m.id];
        return parseFloat(ms?.consumption_unit || '1.0');
    });
    const totalCU = calculateFamilyTotalCU(cus);

    return (
        <div className="card anim-fade-up" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.4rem' }}>
            <AccordionSectionHeader
                id="cu_section"
                title="Calculation of Coefficient / Consumption Unit (CU)"
                subtitle="Assessment of nutritional consumption units across all household members"
                badge={`Family Total: ${totalCU} CU`}
                isClosed={false}
                onToggle={() => {}}
            />

            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Consumption units are calculated based on age, gender, type of work, and physiological additions (+1.4 for pregnancy, +2.5 for lactation) as specified in official guidelines.
            </p>

            <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#f5f0ff', color: 'var(--primary)', textAlign: 'left', borderBottom: '2px solid #e9d5ff' }}>
                            <th style={{ padding: '10px 12px', width: '50px' }}>Sr.</th>
                            <th style={{ padding: '10px 12px' }}>Name</th>
                            <th style={{ padding: '10px 12px', width: '70px' }}>Age</th>
                            <th style={{ padding: '10px 12px', width: '70px' }}>Sex</th>
                            <th style={{ padding: '10px 12px', minWidth: '220px' }}>Type of work</th>
                            <th style={{ padding: '10px 12px', minWidth: '180px' }}>Physiological status</th>
                            <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>Coefficient / CU</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                                    No members registered in this household yet.
                                </td>
                            </tr>
                        ) : members.map((m, idx) => {
                            const ms = surveyRecord.memberSurveys[m.id];
                            const isFemale = (ms?.gender || m.gender || '').toUpperCase() === 'F';
                            const work = (ms?.work_type || 'Moderate') as WorkType;
                            const phys = (ms?.physiological_status || 'None') as PhysiologicalStatus;
                            const cuVal = ms?.consumption_unit || '1.0';

                            return (
                                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{idx + 1}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{ms?.name || m.name}</td>
                                    <td style={{ padding: '10px 12px' }}>{ms?.age_years || m.age_years}y</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span className={`badge ${isFemale ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.72rem' }}>
                                            {ms?.gender || m.gender || 'M'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <SegmentedControl
                                            options={[
                                                { label: 'Sedentary', value: 'Sedentary' },
                                                { label: 'Moderate', value: 'Moderate' },
                                                { label: 'Heavy', value: 'Heavy' },
                                            ]}
                                            value={work}
                                            onChange={(val) => handleMemberCuUpdate(m.id, { workType: val })}
                                        />
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {isFemale ? (
                                            <select
                                                value={phys}
                                                onChange={(e) => handleMemberCuUpdate(m.id, { physiologicalStatus: e.target.value })}
                                                style={{
                                                    height: '34px',
                                                    fontSize: '0.8rem',
                                                    padding: '0 8px',
                                                    borderRadius: '6px',
                                                    border: '1.5px solid var(--border)',
                                                    background: '#ffffff',
                                                    width: '100%',
                                                }}
                                            >
                                                <option value="None">None</option>
                                                <option value="Pregnancy">Pregnancy (+1.4)</option>
                                                <option value="Lactation">Lactation (+2.5)</option>
                                            </select>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                                        {cuVal}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#f5f0ff', borderTop: '2px solid var(--primary)', fontWeight: 700 }}>
                            <td colSpan={6} style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                Total Coefficient / Consumption Unit of Family:
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--primary)', fontSize: '1.1rem' }}>
                                {totalCU} CU
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
