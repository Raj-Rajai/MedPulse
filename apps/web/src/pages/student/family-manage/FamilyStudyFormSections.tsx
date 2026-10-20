/**
 * FamilyStudyFormSections.tsx
 * Renders the structured 9-category form fields matching pages 26-28 of the
 * official "1: Family study" student journal.
 */

import { useState, type ReactNode } from 'react';
import { STUDY_OPT, type StudyKit } from './studyFields';
import type { FamilyStudyData } from './studyTypes';

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

    const SectionHeader = ({ id, icon, title, badge, desc }: { id: string; icon: string; title: string; badge?: string; desc?: string }) => {
        const isClosed = !!collapsed[id];
        return (
            <div
                onClick={() => toggleSection(id)}
                style={{
                    background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.05), rgba(79, 70, 229, 0.02))',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    margin: '18px 0 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    transition: 'all 0.2s ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.15rem' }}>{icon}</span>
                    <strong style={{ fontSize: '0.925rem', color: 'var(--primary)', fontWeight: 650 }}>{title}</strong>
                    {badge && <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '2px 7px' }}>{badge}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {desc && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</span>}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transform: isClosed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                </div>
            </div>
        );
    };

    // Auto-calculate per capita income when family income or member count changes
    const handleIncomeChange = (val: string) => {
        const income = parseFloat(val) || 0;
        const members = parseInt(data.total_family_members, 10) || 1;
        const perCapita = members > 0 ? Math.round(income / members) : 0;
        setData((prev) => ({
            ...prev,
            total_family_income_month: val,
            per_capita_income_month: perCapita > 0 ? String(perCapita) : prev.per_capita_income_month,
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
            <SectionHeader id="cadre" icon="🎓" title="Academic & Cadre Information" badge="Official Journal Header" />
            <div style={{ display: collapsed.cadre ? 'none' : 'block' }}>
                <p className="card-desc" style={{ marginBottom: '10px' }}>Cadet credentials, academic institution and community mentor details.</p>
                <div className="form-grid">
                    {kit.inp('college_name', 'College Name, University *', 'e.g. SAL Institute of Medical Sciences', true, 'text', true)}
                    {kit.inp('student_name', 'Name of the Student *', 'e.g. Sangada Pratik Ashishbhai', true, 'text', true)}
                    {kit.inp('roll_no', 'Roll Number *', 'e.g. 271', true, 'text', true)}
                    {kit.inp('address_details', 'College / Hospital Address', 'e.g. Opp. Science City, Ahmedabad')}
                    {kit.inp('mentor_name_designation', 'Name of the Mentor with Designation', 'e.g. Dr. Mentor (Asst Prof, PSM/Community Med)')}
                    {kit.inp('asha_name_experience', 'Name of ASHA Worker & Experience', 'e.g. Smt. Patel (5 yrs experience)')}
                    {kit.inp('asha_address', 'Address of ASHA Worker', 'e.g. Santej Sub-Center, Gandhinagar')}
                </div>
            </div>

            {/* 2. General Information */}
            <SectionHeader id="general" icon="📋" title="General Household Demographics" badge="Page 26" />
            <div style={{ display: collapsed.general ? 'none' : 'block' }}>
                <div className="form-grid">
                    {kit.inp('household_no', 'Household No. (Family Number) *', 'e.g. 1', false, 'number', true)}
                    {kit.inp('head_name', 'Name of Head of Family (HOF) *', 'e.g. Vaghela Taraben Somabhai', false, 'text', true)}
                    {kit.inp('village_name', 'Village name *', 'e.g. Santej', false, 'text', true)}
                    {kit.inp('tehsil_district', 'Tehsil / District', 'e.g. Kalol / Gandhinagar')}
                    {kit.inp('state', 'State', 'e.g. Gujarat')}
                    {kit.inp('religion', 'Religion', 'e.g. Valmiki / Hindu')}
                    {kit.inp('caste', 'Caste', 'e.g. Valmiki')}
                    {kit.inp('address', 'House / Street Address', 'e.g. Near Gram Panchayat')}
                    {kit.inp('city', 'City / Town', 'e.g. Ahmedabad')}
                    {kit.inp('pincode', 'Pincode', 'e.g. 382721')}
                    {phoneSlot}
                    {kit.inp('residing_since_years', 'Residing in this area since (Years)', 'e.g. 35', false, 'number')}
                    {kit.inp('native_place', 'Native (Originally belongs to)', 'e.g. Santej')}
                    {kit.inp('total_family_members', 'Total family members', 'e.g. 6', false, 'number')}
                    {kit.sel('family_type', 'Type of Family', STUDY_OPT.familyType)}
                    {kit.sel('ayushman_card', 'Ayushman Card (Y/N)', STUDY_OPT.yn)}
                    {kit.inp('ayushman_card_no', 'If Yes, Ayushman Card no.', 'e.g. PMJAY-1234-5678')}
                    {kit.sel('bpl_card', 'BPL Card (Y/N)', STUDY_OPT.yn)}
                    {kit.inp('govt_schemes_benefits', 'Benefits of any Government schemes', 'e.g. PMJAY, PDS Ration')}
                </div>
            </div>

            {/* 3. Socio-Economic Details */}
            <SectionHeader id="socio" icon="💰" title="Socio-Economic Details & Expenditures" badge="Page 26-27" />
            <div style={{ display: collapsed.socio ? 'none' : 'block' }}>
                <p className="card-desc" style={{ marginBottom: '10px' }}>Modified Prasad's classification and monthly family expenditure breakdown.</p>
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
                    {kit.inp('per_capita_income_month', 'Per Capita income per month (₹)', 'Auto-calculated or e.g. 4166', false, 'number')}
                    {kit.sel('modified_prasad_class', "Socio-economic classification (Modified Prasad's)", STUDY_OPT.prasadClass)}
                    {kit.sel('house_ownership', 'House (Own / Rented)', STUDY_OPT.houseOwnership)}
                    {kit.sel('savings', 'Savings (Yes / No)', STUDY_OPT.yesNo)}
                    {kit.sel('debt', 'Debt (Yes / No)', STUDY_OPT.yesNo)}
                </div>

                <div style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.825rem', fontWeight: 650, color: 'var(--primary)', marginBottom: '8px' }}>
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
            </div>

            {/* 4. Nutritional Assessment */}
            {nutritionSlot && (
                <>
                    <SectionHeader id="nutrition" icon="🥗" title="Nutritional & Caloric Assessment" badge="Clinical Field Assessment" />
                    <div style={{ display: collapsed.nutrition ? 'none' : 'block' }}>
                        <div className="form-grid">{nutritionSlot}</div>
                    </div>
                </>
            )}

            {/* 5. Environment - 1. Housing & Physical Environment */}
            <SectionHeader id="housing" icon="🏡" title="Environment: Housing & Physical Environment" badge="Page 27-28" />
            <div style={{ display: collapsed.housing ? 'none' : 'block' }}>
                <p className="card-desc" style={{ marginBottom: '10px' }}>Structure, materials, ventilation, overcrowding, and kitchen facilities.</p>
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

                <div style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.825rem', fontWeight: 650, color: 'var(--primary)', marginBottom: '8px' }}>
                        🍳 Kitchen &amp; Cooking Facilities (Page 27-28)
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
            </div>

            {/* 6. Water Supply & Sanitation */}
            <SectionHeader id="water" icon="💧" title="Water Supply & Sanitation Facilities" badge="Page 28" />
            <div style={{ display: collapsed.water ? 'none' : 'block' }}>
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
            </div>

            {/* 7. Biological Environment */}
            <SectionHeader id="biological" icon="🐾" title="2. Biological Environment" badge="Page 28" />
            <div style={{ display: collapsed.biological ? 'none' : 'block' }}>
                <p className="card-desc" style={{ marginBottom: '10px' }}>Livestock, domestic animals, stable facilities, vector breeding and pests.</p>
                <div className="form-grid">
                    {kit.sel('animal_type', 'Animal - Type of animals', STUDY_OPT.animalType)}
                    {kit.inp('animal_specify', 'If animals present, specify', 'e.g. 1 Cow, 2 Goats')}
                    {kit.sel('stable_cowshed', 'Stable or Cow shed', STUDY_OPT.stableCowshed)}
                    {kit.inp('indoor_pests', 'Inside house - Problem of (Mosquito/Fly/etc.)', 'e.g. Mosquito, Cockroach')}
                    {kit.sel('breeding_mosquito', 'Breeding places: For mosquito (Y/N)', STUDY_OPT.yn)}
                    {kit.sel('breeding_housefly', 'Breeding places: For housefly (Y/N)', STUDY_OPT.yn)}
                    {kit.sel('outdoor_animals_problem', 'Outside the house - Problem of Dog/Cattle (Y/N)', STUDY_OPT.yn)}
                </div>
            </div>

            {/* 8. Psychosocial Environment (Option-wise: Good / Bad) */}
            <SectionHeader id="psychosocial" icon="🤝" title="3. Psychosocial Environment" badge="Page 28" />
            <div style={{ display: collapsed.psychosocial ? 'none' : 'block' }}>
                <p className="card-desc" style={{ marginBottom: '10px' }}>Interpersonal relationships (Good / Bad) and community customs.</p>
                <div className="form-grid">
                    {kit.sel('relation_family', 'Relation of each other in the family', STUDY_OPT.psychosocial)}
                    {kit.sel('relation_relatives', 'Relationship with relatives', STUDY_OPT.psychosocial)}
                    {kit.sel('relation_neighbors', 'Relationship with neighbor', STUDY_OPT.psychosocial)}
                    {kit.inp('cultures_customs', 'Cultures & Customs (ANC/Colostrum/Weaning/Mataji)', 'e.g. ANC registration, Colostrum given, Mataji puja for measles')}
                </div>
            </div>

            {/* 9. Available Health Facility in the Area */}
            <SectionHeader id="facility" icon="🏥" title="4. Available Health Facility in the Area" badge="Page 28" />
            <div style={{ display: collapsed.facility ? 'none' : 'block' }}>
                <div className="form-grid">
                    {kit.inp('health_facility_name', 'Specify Facility Name', 'e.g. Santej Primary Health Centre (PHC)')}
                    {kit.inp('health_facility_distance', 'Distance from Household', 'e.g. 1.5 km')}
                    {kit.sel('health_facility_type', 'Type of facility', STUDY_OPT.healthFacilityType)}
                </div>
            </div>
        </div>
    );
}
