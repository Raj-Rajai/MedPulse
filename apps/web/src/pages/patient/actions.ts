/** Callbacks the portal sections use (the window.PT / inline-handler functions of patient.js). */
import type { RefObject } from 'react';
import type { PatientCard, TabId } from './types';

export type ToastType = 'info' | 'success' | 'error';

export interface PortalActions {
    showTab: (tab: TabId | string, push?: boolean) => void;
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    printCard: () => void;
    copyUid: () => void;
    profileSaved: (card: PatientCard) => Promise<void>;
    editFamily: () => void;
    addMember: () => void;
    editMember: (id: number) => void;
    removeMember: (id: number) => void;
    requestFor: (id: number) => void;
    focusRequestMessage: () => void;
    confirmRequest: (id: number, confirmed: boolean) => void;
    cancelRequest: (id: number) => void;
    sendRsvp: (id: number, rsvp: string, note?: string) => void;
    askRsvp: (id: number, rsvp: string) => void;
    confirmCampContact: (id: number, confirmed: boolean) => void;
    downloadIcs: (id: number) => void;
    openCamp: (id: number) => void;
    openLink: () => void;
}

/** Hospital callback request form (lives in the app because "Call hospital" on a member card preselects it). */
export interface RequestForm {
    forId: string;
    dept: string;
    reason: string;
    channel: string;
    time: string;
    msg: string;
}

export interface RequestFormRefs {
    reqDept: RefObject<HTMLSelectElement | null>;
    reqMsg: RefObject<HTMLTextAreaElement | null>;
}
