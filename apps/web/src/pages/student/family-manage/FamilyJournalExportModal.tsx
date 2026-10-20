/**
 * FamilyJournalExportModal.tsx
 * Printable & downloadable official "1: Family study" proforma (pp. 26-28)
 * for a specific family household, matching the physical medical college journal.
 */

import type { FamilyDetail } from './types';
import type { FamilyStudyData } from './studyTypes';

interface Props {
    open: boolean;
    family: FamilyDetail | null;
    studyData: FamilyStudyData;
    onClose: () => void;
}

export function FamilyJournalExportModal({ open, family, studyData, onClose }: Props) {
    if (!open || !family) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleExportJson = () => {
        const exportObj = {
            metadata: {
                title: 'MedPulse Official Student Journal: 1. Family Study',
                exported_at: new Date().toISOString(),
                institution: studyData.college_name || 'SAL Institute of Medical Sciences',
                student: studyData.student_name || 'Sangada Pratik Ashishbhai',
                roll_number: studyData.roll_no || '271',
                household_code: family.family_code || `FAM-${String(family.family_no).padStart(4, '0')}`,
            },
            family_summary: {
                family_no: family.family_no,
                head_of_family: family.head_of_family,
                family_name: family.family_name,
                contact: family.contact_phone || family.contact_number,
                location: [family.address, family.city, family.village_ward, family.pincode].filter(Boolean).join(', '),
                total_cu: family.total_cu,
                calorie_intake: family.calorie_intake_per_cu,
                calorie_status: family.calorie_status,
                dietary_advice: family.dietary_advice_given,
            },
            study_journal: studyData,
            members: family.members || [],
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `family_${family.family_no || 'study'}_journal_roll_${studyData.roll_no || '271'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const Field = ({ label, value, underline = true }: { label: string; value?: string | number | null; underline?: boolean }) => (
        <span style={{ display: 'inline-block', marginRight: '16px', marginBottom: '8px', fontSize: '0.86rem' }}>
            <span style={{ color: '#334155', fontWeight: 600 }}>{label}: </span>
            <span style={{
                color: '#0f172a',
                fontWeight: 650,
                borderBottom: underline ? '1.5px solid #0f172a' : 'none',
                paddingBottom: '1px',
                paddingRight: '6px',
                minWidth: '40px',
                display: 'inline-block',
            }}>
                {value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : '—'}
            </span>
        </span>
    );

    const OptionCheck = ({ label, selected }: { label: string; selected: boolean }) => (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginRight: '12px',
            fontSize: '0.85rem',
            color: selected ? '#1e293b' : '#64748b',
            fontWeight: selected ? 700 : 400,
        }}>
            <span style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '1.5px solid #0f172a',
                borderRadius: '3px',
                background: selected ? '#0f172a' : 'transparent',
                textAlign: 'center',
                lineHeight: '12px',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 900,
            }}>
                {selected ? '✓' : ''}
            </span>
            <span>{label}</span>
        </span>
    );

    return (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 9999, overflowY: 'auto', padding: '16px 8px' }}>
            <div
                className="modal-content journal-export-modal"
                style={{
                    maxWidth: '920px',
                    width: '100%',
                    margin: 'auto',
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    padding: '24px',
                    color: '#0f172a',
                    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                }}
            >
                {/* Non-printing Control Header */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📄</span>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', color: 'var(--primary)', margin: 0, fontWeight: 700 }}>Official Student Journal: 1. Family Study</h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Proforma Pages 26–28 • Family #{family.family_no} ({family.head_of_family})</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={handleExportJson} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                            ⬇ Export JSON
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                            🖨 Print / Save as PDF
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem', padding: '6px 10px' }}>
                            ✕ Close
                        </button>
                    </div>
                </div>

                {/* Printable Document Sheet */}
                <div id="journalPrintArea" className="journal-sheet" style={{ background: '#fff', color: '#000', fontSize: '13px', lineHeight: 1.6 }}>
                    {/* Page 1 (Book Page 26) */}
                    <div style={{ border: '2px solid #000', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>
                        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '14px' }}>
                            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                1: Family study
                            </h1>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                COLLEGE NAME, UNIVERSITY: <span style={{ textDecoration: 'underline' }}>{studyData.college_name || 'SAL Institute of Medical Sciences'}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#333' }}>
                                ADDRESS DETAILS: {studyData.address_details || 'Opp. Science City, Sola-Bhadaj Road, Ahmedabad - 380060'}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '12px', borderBottom: '1px dashed #666', paddingBottom: '10px' }}>
                            <div>
                                <Field label="NAME OF THE STUDENT" value={studyData.student_name || 'Sangada Pratik Ashishbhai'} />
                            </div>
                            <div>
                                <Field label="ROLL NO" value={studyData.roll_no || '271'} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="NAME OF THE MENTOR WITH DESIGNATION" value={studyData.mentor_name_designation || '—'} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="NAME OF ASHA WORKER &amp; EXPERIENCE" value={studyData.asha_name_experience || '—'} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="ADDRESS OF ASHA WORKER" value={studyData.asha_address || '—'} />
                            </div>
                        </div>

                        {/* GENERAL INFORMATION */}
                        <div style={{ marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                GENERAL INFORMATION
                            </h3>
                            <div>
                                <Field label="Village name" value={studyData.village_name || family.village_ward} />
                                <Field label="Tehsil/district" value={studyData.tehsil_district} />
                                <Field label="State" value={studyData.state} />
                                <Field label="Household No." value={studyData.household_no || family.family_no} />
                                <Field label="Name of Head" value={studyData.head_name || family.head_of_family} />
                                <Field label="Religion" value={studyData.religion} />
                                <Field label="Caste" value={studyData.caste} />
                                <Field label="Address" value={studyData.address || family.address} />
                                <Field label="Residing in this area since" value={studyData.residing_since_years ? `${studyData.residing_since_years} years` : undefined} />
                                <Field label="Native (Originally belongs to)" value={studyData.native_place} />
                                <Field label="Total family members" value={studyData.total_family_members || (family.members ? family.members.length : 0)} />
                            </div>
                            <div style={{ margin: '6px 0' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Type of Family:</span>
                                <OptionCheck label="Nuclear" selected={studyData.family_type === 'Nuclear'} />
                                <OptionCheck label="Joint" selected={studyData.family_type === 'Joint'} />
                                <OptionCheck label="Three generation" selected={studyData.family_type === 'Three generation'} />
                            </div>
                            <div>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Ayushman Card:</span>
                                <OptionCheck label="Yes (Y)" selected={studyData.ayushman_card === 'Y'} />
                                <OptionCheck label="No (N)" selected={studyData.ayushman_card === 'N'} />
                                {studyData.ayushman_card_no && <Field label="Card No" value={studyData.ayushman_card_no} />}
                            </div>
                            <div style={{ marginTop: '4px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>BPL Card:</span>
                                <OptionCheck label="Yes (Y)" selected={studyData.bpl_card === 'Y'} />
                                <OptionCheck label="No (N)" selected={studyData.bpl_card === 'N'} />
                                <Field label="Benefits of any Government schemes" value={studyData.govt_schemes_benefits} />
                            </div>
                        </div>

                        {/* SOCIO-ECONOMIC DETAILS */}
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                SOCIO-ECONOMIC DETAILS
                            </h3>
                            <div>
                                <Field label="Total income of Family per month" value={studyData.total_family_income_month ? `₹ ${studyData.total_family_income_month}` : undefined} />
                                <Field label="Per Capita income per month" value={studyData.per_capita_income_month ? `₹ ${studyData.per_capita_income_month}` : undefined} />
                                <Field label="Socio-economic classification (Modified Prasad's)" value={studyData.modified_prasad_class} />
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, marginTop: '8px' }}>Page 26</div>
                    </div>

                    {/* Page 2 (Book Page 27) */}
                    <div style={{ border: '2px solid #000', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <span style={{ fontWeight: 600, marginRight: '10px' }}>House:</span>
                            <OptionCheck label="Own" selected={studyData.house_ownership === 'Own'} />
                            <OptionCheck label="Rented" selected={studyData.house_ownership === 'Rented'} />
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                                Approximate expenditure per month on: <span style={{ fontWeight: 800 }}>{studyData.exp_total ? `₹ ${studyData.exp_total}` : '₹ 50,000'}</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '8px' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                        <td style={{ padding: '4px 8px' }}>Food: <strong>₹{studyData.exp_food || '—'}</strong></td>
                                        <td style={{ padding: '4px 8px' }}>Clothing: <strong>₹{studyData.exp_clothing || '—'}</strong></td>
                                        <td style={{ padding: '4px 8px' }}>Housing: <strong>₹{studyData.exp_housing || '—'}</strong></td>
                                        <td style={{ padding: '4px 8px' }}>Medical Care: <strong>₹{studyData.exp_medical || '—'}</strong></td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                        <td style={{ padding: '4px 8px' }}>Recreation: <strong>₹{studyData.exp_recreation || '—'}</strong></td>
                                        <td style={{ padding: '4px 8px' }}>Mobile recharge / bill: <strong>₹{studyData.exp_mobile_bills || '—'}</strong></td>
                                        <td style={{ padding: '4px 8px' }}>Fuel (Petrol/Diesel/LPG/PNG): <strong>₹{studyData.exp_fuel || '—'}</strong></td>
                                        <td style={{ padding: '4px 8px' }}>Others: <strong>₹{studyData.exp_others || '—'}</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                            <div>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Savings:</span>
                                <OptionCheck label="Yes" selected={studyData.savings === 'Yes'} />
                                <OptionCheck label="No" selected={studyData.savings === 'No'} />
                                <span style={{ fontWeight: 600, marginLeft: '20px', marginRight: '10px' }}>Debt:</span>
                                <OptionCheck label="Yes" selected={studyData.debt === 'Yes'} />
                                <OptionCheck label="No" selected={studyData.debt === 'No'} />
                            </div>
                        </div>

                        {/* ENVIRONMENT - 1. HOUSING & PHYSICAL ENVIRONMENT */}
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                ENVIRONMENT — 1. HOUSING &amp; PHYSICAL ENVIRONMENT
                            </h3>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Locality:</span>
                                <OptionCheck label="Urban" selected={studyData.locality === 'Urban'} />
                                <OptionCheck label="Urban slum" selected={studyData.locality === 'Urban slum'} />
                                <OptionCheck label="Rural" selected={studyData.locality === 'Rural'} />
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Type of House:</span>
                                <OptionCheck label="Kutcha" selected={studyData.house_type === 'Kutcha'} />
                                <OptionCheck label="Semi pucca" selected={studyData.house_type === 'Semi pucca'} />
                                <OptionCheck label="Pucca" selected={studyData.house_type === 'Pucca'} />
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Roof:</span>
                                <OptionCheck label="Theched (Thatched)" selected={studyData.roof === 'Thatched'} />
                                <OptionCheck label="Tiled" selected={studyData.roof === 'Tiled'} />
                                <OptionCheck label="Concrete" selected={studyData.roof === 'Concrete'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Floor:</span>
                                <OptionCheck label="Mud" selected={studyData.floor === 'Mud'} />
                                <OptionCheck label="Concrete" selected={studyData.floor === 'Concrete'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Wall:</span>
                                <OptionCheck label="Mud" selected={studyData.wall === 'Mud'} />
                                <OptionCheck label="Brick" selected={studyData.wall === 'Brick'} />
                                <OptionCheck label="Stone" selected={studyData.wall === 'Stone'} />
                            </div>
                            <div>
                                <Field label="Total rooms in the house" value={studyData.total_rooms} />
                                <Field label="Area of each room" value={studyData.room_area} />
                                <Field label="Area of windows in each room" value={studyData.window_area} />
                            </div>
                            <div style={{ margin: '6px 0' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Overcrowding:</span>
                                <OptionCheck label="Present" selected={studyData.overcrowding === 'Present'} />
                                <OptionCheck label="Absent" selected={studyData.overcrowding === 'Absent'} />
                                {studyData.overcrowding_reason && <Field label="Reason" value={studyData.overcrowding_reason} />}
                            </div>
                            <div style={{ margin: '6px 0' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Ventilation:</span>
                                <OptionCheck label="Adequate" selected={studyData.ventilation === 'Adequate'} />
                                <OptionCheck label="Inadequate" selected={studyData.ventilation === 'Inadequate'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Cross Ventilation:</span>
                                <OptionCheck label="Present" selected={studyData.cross_ventilation === 'Present'} />
                                <OptionCheck label="Absent" selected={studyData.cross_ventilation === 'Absent'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Light:</span>
                                <OptionCheck label="Adequate" selected={studyData.lighting === 'Adequate'} />
                                <OptionCheck label="Inadequate" selected={studyData.lighting === 'Inadequate'} />
                            </div>
                            <div style={{ marginTop: '8px', borderTop: '1px dashed #94a3b8', paddingTop: '6px' }}>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Kitchen Facilities:</div>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Kitchen:</span>
                                <OptionCheck label="Separate" selected={studyData.kitchen_separate === 'Separate'} />
                                <OptionCheck label="Not separate" selected={studyData.kitchen_separate === 'Not separate'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Type:</span>
                                <OptionCheck label="Kutcha" selected={studyData.kitchen_type === 'Kutcha'} />
                                <OptionCheck label="Semi pucca" selected={studyData.kitchen_type === 'Semi pucca'} />
                                <OptionCheck label="Pucca" selected={studyData.kitchen_type === 'Pucca'} />
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, marginTop: '8px' }}>Page 27</div>
                    </div>

                    {/* Page 3 (Book Page 28) */}
                    <div style={{ border: '2px solid #000', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <Field label="Kitchen Window - No." value={studyData.kitchen_windows_no} />
                            <Field label="Fuel" value={studyData.cooking_fuel} />
                            <div style={{ marginTop: '4px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Separate water supply pipe line:</span>
                                <OptionCheck label="Y" selected={studyData.separate_water_pipeline === 'Y'} />
                                <OptionCheck label="N" selected={studyData.separate_water_pipeline === 'N'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Drainage facility:</span>
                                <OptionCheck label="Y" selected={studyData.drainage_facility === 'Y'} />
                                <OptionCheck label="N" selected={studyData.drainage_facility === 'N'} />
                            </div>
                            <div style={{ marginTop: '4px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Smoke outlet:</span>
                                <OptionCheck label="Y" selected={studyData.smoke_outlet === 'Y'} />
                                <OptionCheck label="N" selected={studyData.smoke_outlet === 'N'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Food covered:</span>
                                <OptionCheck label="Y" selected={studyData.food_covered === 'Y'} />
                                <OptionCheck label="N" selected={studyData.food_covered === 'N'} />
                            </div>
                        </div>

                        {/* Water Supply */}
                        <div style={{ marginBottom: '10px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Water supply:</div>
                            <OptionCheck label="Y" selected={studyData.water_supply === 'Y'} />
                            <OptionCheck label="N" selected={studyData.water_supply === 'N'} />
                            <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>Frequency:</span>
                            <OptionCheck label="Intermittent" selected={studyData.water_supply_frequency === 'Intermittent'} />
                            <OptionCheck label="Continuous" selected={studyData.water_supply_frequency === 'Continuous'} />
                            <div style={{ marginTop: '4px' }}>
                                <Field label="Source" value={studyData.water_source} />
                                <Field label="Storage of drinking water" value={studyData.drinking_water_storage} />
                                <Field label="Stored water" value={studyData.stored_water_cover} />
                                <Field label="Earthen matka" value={studyData.earthen_matka} />
                                <Field label="Water drawing system" value={studyData.water_drawing_system} />
                                <Field label="Pre-treatment of Drinking water" value={studyData.water_pretreatment ? `${studyData.water_pretreatment} (${studyData.water_pretreatment_specify || 'None'})` : 'No'} />
                            </div>
                        </div>

                        {/* Sanitation */}
                        <div style={{ marginBottom: '10px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                            <Field label="Bathing facility" value={studyData.bathing_facility} />
                            <Field label="Latrine facility" value={studyData.latrine_facility} />
                            <Field label="Type" value={studyData.latrine_type} />
                            <Field label="Water supply" value={studyData.latrine_water_supply} />
                            <Field label="Disposal of Refuse" value={studyData.refuse_disposal} />
                            <Field label="Disposal of waste water" value={studyData.waste_water_disposal} />
                        </div>

                        {/* 2. BIOLOGICAL ENVIRONMENT */}
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 6px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                2. BIOLOGICAL ENVIRONMENT
                            </h3>
                            <div>
                                <Field label="Animal - Type of animals" value={studyData.animal_type ? `${studyData.animal_type} (${studyData.animal_specify || '—'})` : 'None'} />
                                <Field label="Stable or Cow shed" value={studyData.stable_cowshed} />
                                <Field label="Inside house - Problem of" value={studyData.indoor_pests} />
                            </div>
                            <div style={{ marginTop: '4px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Breeding places: For mosquito:</span>
                                <OptionCheck label="Y" selected={studyData.breeding_mosquito === 'Y'} />
                                <OptionCheck label="N" selected={studyData.breeding_mosquito === 'N'} />
                                <span style={{ fontWeight: 600, marginLeft: '16px', marginRight: '10px' }}>For housefly:</span>
                                <OptionCheck label="Y" selected={studyData.breeding_housefly === 'Y'} />
                                <OptionCheck label="N" selected={studyData.breeding_housefly === 'N'} />
                            </div>
                            <div style={{ marginTop: '4px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Outside house - Problem of Dog / Cattle etc:</span>
                                <OptionCheck label="Y" selected={studyData.outdoor_animals_problem === 'Y'} />
                                <OptionCheck label="N" selected={studyData.outdoor_animals_problem === 'N'} />
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, marginTop: '8px' }}>Page 28 (Part 1)</div>
                    </div>

                    {/* Page 4 (Book Page 28 Part 2 & Health Facility) */}
                    <div style={{ border: '2px solid #000', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>
                        {/* 3. PSYCHOSOCIAL ENVIRONMENT */}
                        <div style={{ marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                3. PSYCHOSOCIAL ENVIRONMENT (Options: Good / Bad)
                            </h3>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Relation of each other in the family:</span>
                                <OptionCheck label="Good" selected={studyData.relation_family === 'Good'} />
                                <OptionCheck label="Bad" selected={studyData.relation_family === 'Bad'} />
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Relationship with relatives:</span>
                                <OptionCheck label="Good" selected={studyData.relation_relatives === 'Good'} />
                                <OptionCheck label="Bad" selected={studyData.relation_relatives === 'Bad'} />
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, marginRight: '10px' }}>Relationship with neighbor:</span>
                                <OptionCheck label="Good" selected={studyData.relation_neighbors === 'Good'} />
                                <OptionCheck label="Bad" selected={studyData.relation_neighbors === 'Bad'} />
                            </div>
                            <div>
                                <Field label="Cultures &amp; Customs" value={studyData.cultures_customs} />
                            </div>
                        </div>

                        {/* 4. AVAILABLE HEALTH FACILITY IN THE AREA */}
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                4. AVAILABLE HEALTH FACILITY IN THE AREA
                            </h3>
                            <div>
                                <Field label="Specify (Facility Name)" value={studyData.health_facility_name} />
                                <Field label="Distance" value={studyData.health_facility_distance} />
                                <Field label="Type of facility" value={studyData.health_facility_type} />
                            </div>
                        </div>

                        {/* 5. FAMILY MEMBERS ROSTER SUMMARY */}
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 8px', textTransform: 'uppercase', background: '#f1f5f9', padding: '4px 8px' }}>
                                5. HOUSEHOLD MEMBERS CLINICAL ROSTER ({family.members ? family.members.length : 0} Members)
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #000' }}>
                                        <th style={{ padding: '6px' }}>#</th>
                                        <th style={{ padding: '6px' }}>Name</th>
                                        <th style={{ padding: '6px' }}>Relation</th>
                                        <th style={{ padding: '6px' }}>Gender / Age</th>
                                        <th style={{ padding: '6px' }}>Occupation</th>
                                        <th style={{ padding: '6px' }}>Clinical / NCD Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {family.members && family.members.length > 0 ? (
                                        family.members.map((m, idx) => (
                                            <tr key={m.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '6px' }}>{idx + 1}</td>
                                                <td style={{ padding: '6px', fontWeight: 650 }}>{m.name || '—'}</td>
                                                <td style={{ padding: '6px' }}>{m.relation_to_hof || '—'}</td>
                                                <td style={{ padding: '6px' }}>{m.gender || '—'} / {m.age_years || '—'} yrs</td>
                                                <td style={{ padding: '6px' }}>{m.occupation || '—'}</td>
                                                <td style={{ padding: '6px' }}>
                                                    {m.conditions_summary || (m.has_htn === 'Y' ? 'HTN ' : '') + (m.has_dm === 'Y' ? 'DM ' : '') || 'Normal'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>
                                                No members recorded for this family yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, marginTop: '8px' }}>Page 28 (Part 2)</div>
                    </div>
                </div>

                {/* Print Stylesheet */}
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .journal-export-modal, .journal-export-modal * {
                            visibility: visible;
                        }
                        .journal-export-modal {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .journal-sheet {
                            padding: 10mm !important;
                            margin: 0 !important;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 10mm;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
