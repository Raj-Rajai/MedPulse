/**
 * FamilyStudyFormSections.tsx
 * Renders the structured 9-category form fields matching pages 26-28 of the
 * official "1: Family study" student journal.
 */

import { useState, type ReactNode } from 'react';
import { STUDY_OPT, getModifiedPrasadClass, CULTURES_CUSTOMS_OPTIONS, type StudyKit } from './studyFields';
import type { FamilyStudyData } from './studyTypes';

/**
 * Safely parses the saved cultures_customs string into an array of matched options.
 * Accurately handles options with internal commas like 'Hand, Foot, and Mouth Disease (HFMD)'.
 */
export function parseCulturesCustoms(raw: string): string[] {
    if (!raw) return [];
    const selected: string[] = [];
    let str = raw;
    if (str.includes('Hand, Foot, and Mouth Disease (HFMD)')) {
        selected.push('Hand, Foot, and Mouth Disease (HFMD)');
        str = str.replace('Hand, Foot, and Mouth Disease (HFMD)', '');
    } else if (str.includes('Hand') && str.includes('Foot') && str.includes('HFMD')) {
        selected.push('Hand, Foot, and Mouth Disease (HFMD)');
    }
    const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
        if (part !== 'Hand' && part !== 'Foot' && part !== 'and Mouth Disease (HFMD)') {
            if (CULTURES_CUSTOMS_OPTIONS.includes(part as any) && !selected.includes(part)) {
                selected.push(part);
            }
        }
    }
    return selected;
}

interface MultiSelectProps {
    value: string;
    onChange: (val: string) => void;
}

function CulturesCustomsMultiSelect({ value, onChange }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selected = parseCulturesCustoms(value);

    const toggleOption = (opt: string) => {
        const isChecked = selected.includes(opt);
        const next = isChecked ? selected.filter((item) => item !== opt) : [...selected, opt];
        onChange(next.join(', '));
    };

    return (
        <div className="form-group prasad-span-2 multiselect-group" style={{ position: 'relative' }}>
            <label htmlFor="study_cultures_customs">Cultures &amp; Customs (Multi-Select)</label>
            <div
                id="study_cultures_customs"
                role="combobox"
                aria-expanded={isOpen}
                tabIndex={0}
                onClick={() => setIsOpen((prev) => !prev)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen((prev) => !prev);
                    } else if (e.key === 'Escape') {
                        setIsOpen(false);
                    }
                }}
                style={{
                    minHeight: '38px',
                    padding: '7px 12px',
                    background: '#ffffff',
                    border: isOpen ? '1.5px solid var(--primary)' : '1px solid #dce5dd',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 0 3px rgba(109, 40, 217, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                    gap: '8px',
                    userSelect: 'none',
                }}
            >
                <span
                    style={{
                        fontSize: '0.825rem',
                        color: selected.length > 0 ? '#1e293b' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                    }}
                    title={selected.length > 0 ? selected.join(', ') : undefined}
                >
                    {selected.length > 0 ? selected.join(', ') : 'Select Cultures & Customs...'}
                </span>
                <span
                    style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                    }}
                >
                    ▼
                </span>
            </div>

            {isOpen && (
                <div className="multiselect-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="multiselect-header" onClick={(e) => e.stopPropagation()}>
                        <span className="multiselect-count-badge">
                            {selected.length} of {CULTURES_CUSTOMS_OPTIONS.length} selected
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {selected.length > 0 && (
                                <button
                                    type="button"
                                    className="multiselect-clear-btn"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onChange('');
                                    }}
                                >
                                    Clear all
                                </button>
                            )}
                            <button
                                type="button"
                                className="multiselect-done-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                    {CULTURES_CUSTOMS_OPTIONS.map((opt) => {
                        const isChecked = selected.includes(opt);
                        return (
                            <label
                                key={opt}
                                className={`multiselect-option-label ${isChecked ? 'selected' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <input
                                    type="checkbox"
                                    className="multiselect-option-checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        toggleOption(opt);
                                    }}
                                />
                                <span className="multiselect-option-text">{opt}</span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface Props {
    kit: StudyKit;
    data: FamilyStudyData;
    setData: (updater: (prev: FamilyStudyData) => FamilyStudyData) => void;
    // Slot for Nutritional Assessment fields (Total CU, Calorie, etc.)
    nutritionSlot?: ReactNode;
    // Slot for phone number input (with live validation)
    phoneSlot?: ReactNode;
}

export function FamilyStudyFormSections({ kit, data, setData, nutritionSlot, phoneSlot }: Props) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
        cadre: false,
        general: false,
        socio: false,
        nutrition: false,
        housing: false,
        water: false,
        biological: false,
        psychosocial: false,
        facility: false,
    });

    const toggleSection = (sec: string) => {
        setCollapsed((prev) => ({ ...prev, [sec]: !prev[sec] }));
    };

    const SectionHeader = ({ id, title }: { id: string; title: string }) => {
        const isClosed = !!collapsed[id];
        return (
            <div
                onClick={() => toggleSection(id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(id); } }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    marginTop: '22px',
                    marginBottom: '8px',
                    background: '#f5f0ff',
                    border: '1.5px solid #e9d5ff',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                    gap: '12px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{
                        width: '4px',
                        height: '20px',
                        backgroundColor: 'var(--primary)',
                        borderRadius: '2px',
                        display: 'inline-block',
                        flexShrink: 0,
                    }} />
                    <h3 style={{
                        margin: 0,
                        fontSize: '1.12rem',
                        fontWeight: 750,
                        color: 'var(--primary)',
                        letterSpacing: '-0.01em',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                    }}>
                        {title}
                    </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{isClosed ? 'Show' : 'Hide'}</span>
                    <span style={{
                        fontSize: '0.72rem',
                        display: 'inline-block',
                        transform: isClosed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                    }}>▼</span>
                </div>
            </div>
        );
    };

    const SectionContent = ({ children, desc }: { children: ReactNode; desc?: string }) => (
        <div
            className="family-study-section-card"
            style={{
                background: '#faf7ff',
                border: '1px solid #ede9fe',
                borderRadius: '10px',
                padding: '16px 18px',
                marginBottom: '16px',
            }}
        >
            {desc && (
                <p className="card-desc" style={{ marginBottom: '14px', fontSize: '0.78rem', color: '#64748b' }}>
                    {desc}
                </p>
            )}
            {children}
        </div>
    );

    // Auto-calculate per capita income and Prasad classification
    const handleIncomeChange = (val: string) => {
        const income = parseFloat(val) || 0;
        const members = parseInt(data.total_family_members, 10) || 1;
        const perCapita = members > 0 ? Math.round(income / members) : 0;
        setData((prev) => ({
            ...prev,
            total_family_income_month: val,
            per_capita_income_month: perCapita > 0 ? String(perCapita) : prev.per_capita_income_month,
            modified_prasad_class: perCapita > 0 ? getModifiedPrasadClass(perCapita) : prev.modified_prasad_class,
        }));
    };

    const handlePerCapitaChange = (val: string) => {
        const pc = parseFloat(val) || 0;
        setData((prev) => ({
            ...prev,
            per_capita_income_month: val,
            modified_prasad_class: pc > 0 ? getModifiedPrasadClass(pc) : prev.modified_prasad_class,
        }));
    };

    const handleMembersChange = (val: string) => {
        const members = parseInt(val, 10) || 0;
        const income = parseFloat(data.total_family_income_month) || 0;
        const perCapita = members > 0 && income > 0 ? Math.round(income / members) : 0;
        setData((prev) => ({
            ...prev,
            total_family_members: val,
            per_capita_income_month: perCapita > 0 ? String(perCapita) : prev.per_capita_income_month,
            modified_prasad_class: perCapita > 0 ? getModifiedPrasadClass(perCapita) : prev.modified_prasad_class,
        }));
    };

    // Auto-calculate total expenditure
    const handleExpChange = (key: keyof FamilyStudyData, val: string) => {
        setData((prev) => {
            const next = { ...prev, [key]: val };
            const sum = [
                next.exp_food,
                next.exp_clothing,
                next.exp_housing,
                next.exp_medical,
                next.exp_recreation,
                next.exp_mobile_bills,
                next.exp_fuel,
                next.exp_others,
            ].reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
            if (sum > 0) next.exp_total = String(sum);
            return next;
        });
    };

    return (
        <div className="family-study-form-sections">
            {/* 1. Academic & Student Journal Cadre Details */}
            <SectionHeader id="cadre" title="Academic & Cadre Information" />
            <div style={{ display: collapsed.cadre ? 'none' : 'block' }}>
                <SectionContent desc="Cadet credentials, academic institution and community mentor details.">
                    <div className="form-grid">
                        {kit.inp('college_name', 'College Name, University *', 'e.g. SAL Institute of Medical Sciences', true, 'text', true)}
                        {kit.inp('student_name', 'Name of the Student *', 'e.g. Sangada Pratik Ashishbhai', true, 'text', true)}
                        {kit.inp('roll_no', 'Roll Number *', 'e.g. 271', true, 'text', true)}
                        {kit.inp('address_details', 'College / Hospital Address', 'e.g. Opp. Science City, Sola-Bhadaj Road, Ahmedabad, Gujarat 380060')}
                        {kit.inp('mentor_name_designation', 'Name of the Mentor with Designation', 'e.g. Dr. Mentor (Assistant Professor, Community Medicine)')}
                        {kit.inp('asha_name_experience', 'Name of ASHA Worker & Experience', 'e.g. ASHA Worker (5 years experience)')}
                        {kit.inp('asha_address', 'Address of ASHA Worker', 'e.g. Santej Sub-Center, Gandhinagar')}
                    </div>
                </SectionContent>
            </div>

            {/* 2. General Information */}
            <SectionHeader id="general" title="General Household Demographics" />
            <div style={{ display: collapsed.general ? 'none' : 'block' }}>
                <SectionContent>
                    <div className="form-grid">
                        {kit.inp('household_no', 'Household No. (Family Number) *', 'e.g. 1', false, 'number', true)}
                        {kit.inp('head_name', 'Name of Head of Family (HOF) *', 'e.g. Vaghela Taraben Somabhai', false, 'text', true)}
                        {kit.inp('village_name', 'Village name *', 'e.g. Santej', false, 'text', true)}
                        {kit.inp('tehsil_district', 'Tehsil / District', 'e.g. Kalol / Gandhinagar')}
                        {kit.inp('state', 'State', 'e.g. Gujarat')}
                        {kit.inp('religion', 'Religion', 'e.g. Valmiki / Hindu')}
                        {kit.inp('caste', 'Caste', 'e.g. Valmiki')}
                        {kit.inp('address', 'House / Street Address', 'e.g. Near Gram Panchayat, Santej')}
                        {kit.inp('city', 'City / Town', 'e.g. Ahmedabad')}
                        {kit.inp('pincode', 'Pincode', 'e.g. 382721')}
                        {phoneSlot}
                        {kit.inp('residing_since_years', 'Residing in this area since (Years)', 'e.g. 35', false, 'number')}
                        {kit.inp('native_place', 'Native (Originally belongs to)', 'e.g. Santej')}
                        <div className="form-group">
                            <label htmlFor="study_total_family_members">Total family members</label>
                            <input
                                type="number"
                                id="study_total_family_members"
                                placeholder="e.g. 6"
                                value={data.total_family_members}
                                onChange={(e) => handleMembersChange(e.target.value)}
                            />
                        </div>
                        {kit.sel('family_type', 'Type of Family', STUDY_OPT.familyType)}
                        {kit.sel('ayushman_card', 'Ayushman Card (Y/N)', STUDY_OPT.yn)}
                        {kit.inp('ayushman_card_no', 'If Yes, Ayushman Card no.', 'e.g. PMJAY-1234-5678')}
                        {kit.sel('bpl_card', 'BPL Card (Y/N)', STUDY_OPT.yn)}
                        {kit.inp('govt_schemes_benefits', 'Benefits of any Government schemes', 'e.g. PMJAY-MAA Card, PDS Ration')}
                    </div>
                </SectionContent>
            </div>

            {/* 3. Socio-Economic Details */}
            <SectionHeader id="socio" title="Socio-Economic Details & Expenditures" />
            <div style={{ display: collapsed.socio ? 'none' : 'block' }}>
                <SectionContent desc="Modified Prasad's classification and monthly family expenditure breakdown.">
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="study_total_family_income_month">Total income of Family per month (₹)</label>
                            <input
                                type="number"
                                id="study_total_family_income_month"
                                placeholder="e.g. 25000"
                                value={data.total_family_income_month}
                                onChange={(e) => handleIncomeChange(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="study_per_capita_income_month">Per Capita income per month (₹)</label>
                            <input
                                type="number"
                                id="study_per_capita_income_month"
                                placeholder="Auto-calculated or e.g. 4166"
                                value={data.per_capita_income_month}
                                onChange={(e) => handlePerCapitaChange(e.target.value)}
                            />
                        </div>
                        {kit.sel(
                            'modified_prasad_class',
                            "Socio-economic classification (Modified Prasad's)",
                            STUDY_OPT.prasadClass,
                            undefined,
                            undefined,
                            'prasad-span-2'
                        )}
                        {kit.sel('house_ownership', 'House (Own / Rented)', STUDY_OPT.houseOwnership)}
                        {kit.sel('savings', 'Savings (Yes / No)', STUDY_OPT.yesNo)}
                        {kit.sel('debt', 'Debt (Yes / No)', STUDY_OPT.yesNo)}
                    </div>

                    <div style={{ marginTop: '16px', padding: '16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
                            Approximate Monthly Expenditure Breakdown (₹)
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Food (₹)</label>
                                <input type="number" placeholder="e.g. 18000" value={data.exp_food} onChange={(e) => handleExpChange('exp_food', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Clothing (₹)</label>
                                <input type="number" placeholder="e.g. 4000" value={data.exp_clothing} onChange={(e) => handleExpChange('exp_clothing', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Housing (₹)</label>
                                <input type="number" placeholder="e.g. 3000" value={data.exp_housing} onChange={(e) => handleExpChange('exp_housing', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Medical Care (₹)</label>
                                <input type="number" placeholder="e.g. 5000" value={data.exp_medical} onChange={(e) => handleExpChange('exp_medical', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Recreation (₹)</label>
                                <input type="number" placeholder="e.g. 2000" value={data.exp_recreation} onChange={(e) => handleExpChange('exp_recreation', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Mobile recharge / bill payment (₹)</label>
                                <input type="number" placeholder="e.g. 3000" value={data.exp_mobile_bills} onChange={(e) => handleExpChange('exp_mobile_bills', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Fuel (Petrol/Diesel/LPG/PNG) (₹)</label>
                                <input type="number" placeholder="e.g. 5000" value={data.exp_fuel} onChange={(e) => handleExpChange('exp_fuel', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Others (₹)</label>
                                <input type="number" placeholder="e.g. 10000" value={data.exp_others} onChange={(e) => handleExpChange('exp_others', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label><strong>Total Expenditure per month (₹)</strong></label>
                                <input
                                    type="number"
                                    placeholder="e.g. 50000"
                                    value={data.exp_total}
                                    style={{ fontWeight: 700, color: 'var(--accent)' }}
                                    onChange={(e) => setData((prev) => ({ ...prev, exp_total: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </SectionContent>
            </div>

            {/* 4. Nutritional Assessment */}
            {nutritionSlot && (
                <>
                    <SectionHeader id="nutrition" title="Nutritional & Caloric Assessment" />
                    <div style={{ display: collapsed.nutrition ? 'none' : 'block' }}>
                        <SectionContent>
                            <div className="form-grid">{nutritionSlot}</div>
                        </SectionContent>
                    </div>
                </>
            )}

            {/* 5. Environment - 1. Housing & Physical Environment */}
            <SectionHeader id="housing" title="Housing & Physical Environment" />
            <div style={{ display: collapsed.housing ? 'none' : 'block' }}>
                <SectionContent desc="Structure, materials, ventilation, overcrowding, and kitchen facilities.">
                    <div className="form-grid">
                        {kit.sel('locality', 'Locality', STUDY_OPT.locality)}
                        {kit.sel('house_type', 'Type of House', STUDY_OPT.houseType)}
                        {kit.sel('roof', 'Roof Material', STUDY_OPT.roof)}
                        {kit.sel('floor', 'Floor Material', STUDY_OPT.floor)}
                        {kit.sel('wall', 'Wall Material', STUDY_OPT.wall)}
                        {kit.inp('total_rooms', 'Total rooms in the house', 'e.g. 2', false, 'number')}
                        {kit.inp('room_area', 'Area of each room', 'e.g. 120 sq ft')}
                        {kit.inp('window_area', 'Area of windows in each room', 'e.g. 15 sq ft')}
                        {kit.sel('overcrowding', 'Overcrowding', STUDY_OPT.presentAbsent)}
                        {kit.inp('overcrowding_reason', 'Overcrowding Reason', 'e.g. Large family in 2 rooms')}
                        {kit.sel('ventilation', 'Ventilation', STUDY_OPT.adequate)}
                        {kit.sel('cross_ventilation', 'Cross Ventilation', STUDY_OPT.presentAbsent)}
                        {kit.sel('lighting', 'Light', STUDY_OPT.adequate)}
                    </div>

                    <div style={{ marginTop: '16px', padding: '16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
                            Kitchen &amp; Cooking Facilities
                        </div>
                        <div className="form-grid">
                            {kit.sel('kitchen_separate', 'Kitchen (Separate / Not separate)', STUDY_OPT.kitchenSep)}
                            {kit.sel('kitchen_type', 'Kitchen Type', STUDY_OPT.houseType)}
                            {kit.sel('kitchen_roof', 'Kitchen Roof', STUDY_OPT.roof)}
                            {kit.sel('kitchen_floor', 'Kitchen Floor', STUDY_OPT.floor)}
                            {kit.sel('kitchen_wall', 'Kitchen Wall', STUDY_OPT.wall)}
                            {kit.inp('kitchen_windows_no', 'Kitchen Window - No.', 'e.g. 2', false, 'number')}
                            {kit.sel('cooking_fuel', 'Fuel Used', STUDY_OPT.cookingFuel)}
                            {kit.sel('separate_water_pipeline', 'Separate water supply pipe line', STUDY_OPT.yn)}
                            {kit.sel('drainage_facility', 'Drainage facility in kitchen', STUDY_OPT.yn)}
                            {kit.sel('smoke_outlet', 'Smoke outlet', STUDY_OPT.yn)}
                            {kit.sel('food_covered', 'Food covered (Y/N)', STUDY_OPT.yn)}
                        </div>
                    </div>
                </SectionContent>
            </div>

            {/* 6. Water Supply & Sanitation */}
            <SectionHeader id="water" title="Water Supply & Sanitation Facilities" />
            <div style={{ display: collapsed.water ? 'none' : 'block' }}>
                <SectionContent>
                    <div className="form-grid">
                        {kit.sel('water_supply', 'Water supply available (Y/N)', STUDY_OPT.yn)}
                        {kit.sel('water_supply_frequency', 'Supply Frequency', STUDY_OPT.waterFreq)}
                        {kit.sel('water_source', 'Source of Water', STUDY_OPT.waterSource)}
                        {kit.sel('drinking_water_storage', 'Storage of drinking water', STUDY_OPT.yesNo)}
                        {kit.sel('stored_water_cover', 'Stored water (Covered / Uncovered)', STUDY_OPT.storedWaterCover)}
                        {kit.sel('earthen_matka', 'Earthen matka (With / Without tap)', STUDY_OPT.matkaTap)}
                        {kit.sel('water_drawing_system', 'Water drawing system', STUDY_OPT.waterDrawing)}
                        {kit.sel('water_pretreatment', 'Pre-treatment of Drinking water if any', STUDY_OPT.yesNo)}
                        {kit.inp('water_pretreatment_specify', 'If pre-treatment, specify method', 'e.g. Boiling / Alum / Filtered')}
                        {kit.sel('bathing_facility', 'Bathing facility', STUDY_OPT.bathing)}
                        {kit.sel('latrine_facility', 'Latrine facility', STUDY_OPT.latrineFacility)}
                        {kit.sel('latrine_type', 'Latrine Type', STUDY_OPT.latrineType)}
                        {kit.sel('latrine_water_supply', 'Water supply in latrine', STUDY_OPT.latrineWaterSupply)}
                        {kit.sel('refuse_disposal', 'Disposal of Refuse', STUDY_OPT.refuseDisposal)}
                        {kit.sel('waste_water_disposal', 'Disposal of waste water', STUDY_OPT.wasteWaterDisposal)}
                    </div>
                </SectionContent>
            </div>

            {/* 7. Biological Environment */}
            <SectionHeader id="biological" title="Biological Environment & Pest Control" />
            <div style={{ display: collapsed.biological ? 'none' : 'block' }}>
                <SectionContent desc="Livestock, domestic animals, stable facilities, vector breeding and pests.">
                    <div className="form-grid">
                        {kit.sel('animal_type', 'Animal - Type of animals', STUDY_OPT.animalType)}
                        {kit.inp('animal_specify', 'If animals present, specify', 'e.g. 1 Cow, 2 Goats', false, 'text', false, undefined, 'prasad-span-2')}
                        {kit.sel('stable_cowshed', 'Stable or Cow shed', STUDY_OPT.stableCowshed)}
                        {kit.inp('indoor_pests', 'Inside house - Problem of pests', 'e.g. Mosquito, Cockroach')}
                        {kit.sel('breeding_mosquito', 'Breeding places: Mosquito', STUDY_OPT.yn)}
                        {kit.sel('breeding_housefly', 'Breeding places: Housefly', STUDY_OPT.yn)}
                        {kit.sel('outdoor_animals_problem', 'Outside house - Dog / Cattle problem', STUDY_OPT.yn)}
                    </div>
                </SectionContent>
            </div>

            {/* 8. Psychosocial Environment (Option-wise: Good / Bad + Multi-select Cultures & Customs) */}
            <SectionHeader id="psychosocial" title="Psychosocial Environment" />
            <div style={{ display: collapsed.psychosocial ? 'none' : 'block' }}>
                <SectionContent desc="Interpersonal relationships (Good / Bad) and community customs.">
                    <div className="form-grid">
                        {kit.sel('relation_family', 'Relation of each other in the family', STUDY_OPT.psychosocial)}
                        {kit.sel('relation_relatives', 'Relationship with relatives', STUDY_OPT.psychosocial)}
                        {kit.sel('relation_neighbors', 'Relationship with neighbor', STUDY_OPT.psychosocial)}
                        <CulturesCustomsMultiSelect
                            value={data.cultures_customs || ''}
                            onChange={(val) => setData((prev) => ({ ...prev, cultures_customs: val }))}
                        />
                    </div>
                </SectionContent>
            </div>

            {/* 9. Available Health Facility in the Area */}
            <SectionHeader id="facility" title="Available Health Facility in the Area" />
            <div style={{ display: collapsed.facility ? 'none' : 'block' }}>
                <SectionContent>
                    <div className="form-grid">
                        {kit.inp('health_facility_name', 'Specify Facility Name', 'e.g. Santej Primary Health Centre (PHC)')}
                        {kit.inp('health_facility_distance', 'Distance from Household', 'e.g. 1.5 km')}
                        {kit.sel('health_facility_type', 'Type of facility', STUDY_OPT.healthFacilityType)}
                    </div>
                </SectionContent>
            </div>
        </div>
    );
}

