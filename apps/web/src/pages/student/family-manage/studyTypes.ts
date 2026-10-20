/**
 * Types and schema for the official "1: Family study" student journal proforma (pp. 26-28).
 * Covers Academic Header, General Information, Socio-Economic, Housing, Water & Sanitation,
 * Biological Environment, Psychosocial Environment, and Local Health Facilities.
 */

export interface FamilyStudyData {
    // Academic & Cadre Info
    college_name: string;
    address_details: string;
    student_name: string;
    roll_no: string;
    mentor_name_designation: string;
    asha_name_experience: string;
    asha_address: string;

    // General Information
    village_name: string;
    tehsil_district: string;
    state: string;
    household_no: string;
    head_name: string;
    religion: string;
    caste: string;
    address: string;
    city: string;
    pincode: string;
    residing_since_years: string;
    native_place: string;
    total_family_members: string;
    family_type: 'Nuclear' | 'Joint' | 'Three generation' | '';
    ayushman_card: 'Y' | 'N' | '';
    ayushman_card_no: string;
    bpl_card: 'Y' | 'N' | '';
    govt_schemes_benefits: string;

    // Socio-Economic Details
    total_family_income_month: string;
    per_capita_income_month: string;
    modified_prasad_class: string;
    house_ownership: 'Own' | 'Rented' | '';
    exp_food: string;
    exp_clothing: string;
    exp_housing: string;
    exp_medical: string;
    exp_recreation: string;
    exp_mobile_bills: string;
    exp_fuel: string;
    exp_others: string;
    exp_total: string;
    savings: 'Yes' | 'No' | '';
    debt: 'Yes' | 'No' | '';

    // Housing & Physical Environment
    locality: 'Urban' | 'Urban slum' | 'Rural' | '';
    house_type: 'Kutcha' | 'Semi pucca' | 'Pucca' | '';
    roof: 'Thatched' | 'Tiled' | 'Concrete' | '';
    floor: 'Mud' | 'Concrete' | '';
    wall: 'Mud' | 'Brick' | 'Stone' | '';
    total_rooms: string;
    room_area: string;
    window_area: string;
    overcrowding: 'Present' | 'Absent' | '';
    overcrowding_reason: string;
    ventilation: 'Adequate' | 'Inadequate' | '';
    cross_ventilation: 'Present' | 'Absent' | '';
    lighting: 'Adequate' | 'Inadequate' | '';

    // Kitchen & Cooking
    kitchen_separate: 'Separate' | 'Not separate' | '';
    kitchen_type: 'Kutcha' | 'Semi pucca' | 'Pucca' | '';
    kitchen_roof: 'Thatched' | 'Tiled' | 'Concrete' | '';
    kitchen_floor: 'Mud' | 'Concrete' | '';
    kitchen_wall: 'Mud' | 'Brick' | 'Stone' | '';
    kitchen_windows_no: string;
    cooking_fuel: 'Gas' | 'Kerosene' | 'Wood' | 'Coal' | 'Other' | '';
    separate_water_pipeline: 'Y' | 'N' | '';
    drainage_facility: 'Y' | 'N' | '';
    smoke_outlet: 'Y' | 'N' | '';
    food_covered: 'Y' | 'N' | '';

    // Water Supply & Sanitation
    water_supply: 'Y' | 'N' | '';
    water_supply_frequency: 'Intermittent' | 'Continuous' | '';
    water_source: string;
    drinking_water_storage: 'Yes' | 'No' | '';
    stored_water_cover: 'Covered' | 'Uncovered' | '';
    earthen_matka: 'With tap' | 'Without tap' | 'NA' | '';
    water_drawing_system: 'Doya' | 'Glass' | 'Direct tap' | 'Other' | '';
    water_pretreatment: 'Yes' | 'No' | '';
    water_pretreatment_specify: string;
    bathing_facility: 'Bathroom' | 'Open space' | '';
    latrine_facility: 'Separate' | 'Common' | 'Open field' | '';
    latrine_type: 'RCA' | 'Other' | 'NA' | '';
    latrine_water_supply: 'Adequate' | 'Non adequate' | '';
    refuse_disposal: string;
    waste_water_disposal: string;

    // Biological Environment
    animal_type: 'Domestic' | 'Pet' | 'None' | 'Others' | '';
    animal_specify: string;
    stable_cowshed: 'Absent' | 'Present (separated)' | 'Present (not separated)' | '';
    indoor_pests: string; // Comma-separated or selected
    breeding_mosquito: 'Y' | 'N' | '';
    breeding_housefly: 'Y' | 'N' | '';
    outdoor_animals_problem: 'Y' | 'N' | '';

    // Psychosocial Environment (Option-wise: Good / Bad)
    relation_family: 'Good' | 'Bad' | '';
    relation_relatives: 'Good' | 'Bad' | '';
    relation_neighbors: 'Good' | 'Bad' | '';
    cultures_customs: string;

    // Available Health Facility in the Area
    health_facility_name: string;
    health_facility_distance: string;
    health_facility_type: string;
}

export const DEFAULT_STUDY_DATA: FamilyStudyData = {
    college_name: 'SAL Institute of Medical Sciences',
    address_details: 'Opp. Science City, Sola-Bhadaj Road, Ahmedabad, Gujarat 380060',
    student_name: 'Sangada Pratik Ashishbhai',
    roll_no: '271',
    mentor_name_designation: '',
    asha_name_experience: '',
    asha_address: '',

    village_name: 'Santej',
    tehsil_district: 'Kalol / Gandhinagar',
    state: 'Gujarat',
    household_no: '',
    head_name: '',
    religion: 'Valmiki',
    caste: 'Valmiki',
    address: 'Near Gram Panchayat, Santej',
    city: 'Ahmedabad',
    pincode: '382721',
    residing_since_years: '35',
    native_place: 'Santej',
    total_family_members: '6',
    family_type: 'Joint',
    ayushman_card: 'Y',
    ayushman_card_no: '',
    bpl_card: 'Y',
    govt_schemes_benefits: 'PMJAY-MAA Card, PDS Ration',

    total_family_income_month: '25000',
    per_capita_income_month: '4166',
    modified_prasad_class: 'Class III (Upper Middle)',
    house_ownership: 'Own',
    exp_food: '18000',
    exp_clothing: '4000',
    exp_housing: '3000',
    exp_medical: '5000',
    exp_recreation: '2000',
    exp_mobile_bills: '3000',
    exp_fuel: '5000',
    exp_others: '10000',
    exp_total: '50000',
    savings: 'No',
    debt: 'No',

    locality: 'Rural',
    house_type: 'Semi pucca',
    roof: 'Tiled',
    floor: 'Concrete',
    wall: 'Brick',
    total_rooms: '2',
    room_area: '120 sq ft',
    window_area: '15 sq ft',
    overcrowding: 'Absent',
    overcrowding_reason: '',
    ventilation: 'Adequate',
    cross_ventilation: 'Present',
    lighting: 'Adequate',

    kitchen_separate: 'Separate',
    kitchen_type: 'Semi pucca',
    kitchen_roof: 'Tiled',
    kitchen_floor: 'Concrete',
    kitchen_wall: 'Brick',
    kitchen_windows_no: '2',
    cooking_fuel: 'Gas',
    separate_water_pipeline: 'Y',
    drainage_facility: 'Y',
    smoke_outlet: 'Y',
    food_covered: 'Y',

    water_supply: 'Y',
    water_supply_frequency: 'Intermittent',
    water_source: 'Municipal supply',
    drinking_water_storage: 'Yes',
    stored_water_cover: 'Covered',
    earthen_matka: 'With tap',
    water_drawing_system: 'Doya',
    water_pretreatment: 'Yes',
    water_pretreatment_specify: 'Boiling / Filtered',
    bathing_facility: 'Bathroom',
    latrine_facility: 'Separate',
    latrine_type: 'RCA',
    latrine_water_supply: 'Adequate',
    refuse_disposal: 'Municipality',
    waste_water_disposal: 'Pipe drainage system',

    animal_type: 'Domestic',
    animal_specify: 'Cow / Buffalo',
    stable_cowshed: 'Present (separated)',
    indoor_pests: 'Mosquito',
    breeding_mosquito: 'N',
    breeding_housefly: 'N',
    outdoor_animals_problem: 'Y',

    relation_family: 'Good',
    relation_relatives: 'Good',
    relation_neighbors: 'Good',
    cultures_customs: 'ANC / Colostrum / Weaning / Mataji puja',

    health_facility_name: 'Santej Primary Health Centre (PHC)',
    health_facility_distance: '1.5 km',
    health_facility_type: 'Govt. (Allopathy)',
};
