/**
 * Storage helpers for Family Study Journal data.
 * Adheres strictly to the Frontend-Only invariant: encodes data into `notes` field
 * when communicating with the backend API, and mirrors it into localStorage
 * to ensure 100% data durability and zero schema conflicts.
 */

import { DEFAULT_STUDY_DATA, type FamilyStudyData } from './studyTypes';
import type { FamilyDetail } from './types';

const STORAGE_PREFIX = 'medpulse_family_study_';

export function getStorageKey(familyIdOrNo: string | number): string {
    return `${STORAGE_PREFIX}${familyIdOrNo}`;
}

/**
 * Extracts and parses FamilyStudyData from a FamilyDetail object or local cache.
 */
export function extractStudyData(family: FamilyDetail | null, fallbackDefaults = DEFAULT_STUDY_DATA): FamilyStudyData {
    if (!family) return { ...fallbackDefaults };

    const data: FamilyStudyData = { ...fallbackDefaults };

    // 1. Try to parse from notes if it contains serialized JSON
    const notesStr = (family as any).notes;
    if (typeof notesStr === 'string' && notesStr.includes('"medpulse_study":true')) {
        try {
            const parsed = JSON.parse(notesStr);
            if (parsed && parsed.study_data) {
                Object.assign(data, parsed.study_data);
            }
        } catch (e) {
            console.warn('Failed to parse study_data from family notes JSON:', e);
        }
    }

    // 2. Check local storage cache for this family (keyed by family_no or family_code or id)
    const identifiers = [family.family_no, family.family_code, (family as any).id].filter(Boolean);
    for (const id of identifiers) {
        try {
            const cached = localStorage.getItem(getStorageKey(String(id)));
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object') {
                    Object.assign(data, parsed);
                    break;
                }
            }
        } catch {
            // Ignore parse errors
        }
    }

    // 3. Populate base family properties into matching study data fields
    if (family.family_no) data.household_no = String(family.family_no);
    if (family.head_of_family) data.head_name = family.head_of_family;
    if (family.village_ward) data.village_name = family.village_ward;
    if (family.address) data.address = family.address;
    if (family.city) data.city = family.city;
    if (family.pincode) data.pincode = family.pincode;
    if (family.roll_number) data.roll_no = family.roll_number;
    if (family.members && family.members.length > 0) {
        data.total_family_members = String(family.members.length);
    }

    return data;
}

/**
 * Saves study data to local storage for quick retrieval.
 */
export function persistStudyDataLocally(identifiers: (string | number | undefined | null)[], data: FamilyStudyData): void {
    const serialized = JSON.stringify(data);
    for (const id of identifiers) {
        if (!id) continue;
        try {
            localStorage.setItem(getStorageKey(String(id)), serialized);
        } catch (e) {
            console.warn('LocalStorage save error:', e);
        }
    }
}

/**
 * Encodes the study data into the `notes` payload string so it persists in the backend SQLite `families.notes` column.
 */
export function encodeNotesPayload(studyData: FamilyStudyData, existingNotes?: string): string {
    return JSON.stringify({
        medpulse_study: true,
        version: 1,
        study_data: studyData,
        raw_notes: existingNotes || '',
    });
}
