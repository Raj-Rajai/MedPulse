/**
 * Data shared by several parts of the console: overview stats, the cadet roster (table, edit
 * modal), the college list (it fills six selects) and the university-admin roster + quota.
 * Each loader mirrors one load* function of the original page.
 */
import { useCallback, useRef, useState } from 'react';
import { errMessage } from '../lib/http';
import type { AdminStats, Cadet, CollegeStat, UniAdmin, UniAdminsResponse, UniQuota } from '../types';
import type { ShowToast } from './useToasts';

export function useOverview(showToast: ShowToast) {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) throw new Error('Failed to fetch administrative statistics');
            setStats((await res.json()) as AdminStats);
        } catch (err) {
            showToast('Error loading overview: ' + errMessage(err), 'error');
        }
    }, [showToast]);
    return { stats, load };
}

export function useCadets(showToast: ShowToast) {
    const [all, setAll] = useState<Cadet[] | null>(null);
    /** What the table shows: the full list after a load, the filtered list after a filter change. */
    const [rows, setRows] = useState<Cadet[] | null>(null);
    const allRef = useRef<Cadet[]>([]);
    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/students');
            if (!res.ok) throw new Error('Failed to load students');
            const students = (await res.json()) as Cadet[];
            allRef.current = students;
            setAll(students);
            setRows(students);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    }, [showToast]);
    const find = useCallback((id: number) => allRef.current.find((s) => s.id === id), []);
    return { all, rows, setRows, load, find };
}

export function useColleges(showToast: ShowToast) {
    /** null until loaded; `options` only changes when a non-empty list arrives (populateCollegeSelects). */
    const [list, setList] = useState<CollegeStat[] | null>(null);
    const [options, setOptions] = useState<CollegeStat[] | null>(null);
    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/colleges');
            if (!res.ok) throw new Error('Failed to load institutions');
            const colleges = (await res.json()) as CollegeStat[];
            setList(colleges);
            if (colleges && colleges.length > 0) setOptions(colleges);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    }, [showToast]);
    return { list, options, load };
}

export interface QuotaView {
    superText: string;
    adminsText: string;
    remainingText: string;
    pct: number;
    count: number;
    full: boolean;
    curA: number;
    maxQ: number;
    rem: number;
}

export function useUniAdmins(showToast: ShowToast) {
    const [admins, setAdmins] = useState<UniAdmin[] | null>(null);
    const [quota, setQuota] = useState<UniQuota | null>(null);
    const [view, setView] = useState<QuotaView | null>(null);
    const adminsRef = useRef<UniAdmin[]>([]);

    const load = useCallback(async (uniId: string | number) => {
        try {
            const res = await fetch(`/api/admin/university-admins?university_id=${uniId}`);
            if (!res.ok) throw new Error('Failed to load university administrators');
            const data = (await res.json()) as UniAdminsResponse;
            adminsRef.current = data.admins || [];
            const q = data.quota || {};

            const superAdmin = data.admins.find((a) => a.role === 'University Super Admin' || a.role === 'Super Admin');
            const maxQ = q.max_admins || 10;
            const curA = q.current_admins || 0;
            const rem = q.remaining_seats !== undefined ? q.remaining_seats : maxQ - curA;
            const pct = Math.min(100, Math.round((curA / maxQ) * 100));
            setView({
                superText: superAdmin ? `1 / 1 Appointed (${superAdmin.name.split(' ')[0]})` : '0 / 1 Appointed',
                adminsText: `${curA} / ${maxQ} Used`,
                remainingText: `${rem} seat${rem === 1 ? '' : 's'} remaining`,
                pct,
                count: data.admins.length,
                full: curA >= maxQ,
                curA,
                maxQ,
                rem,
            });
            setQuota(q);
            setAdmins(data.admins);
        } catch (err) {
            showToast('Error loading university admins: ' + errMessage(err), 'error');
        }
    }, [showToast]);

    const find = useCallback((id: number) => adminsRef.current.find((a) => a.id === id), []);
    return { admins, quota, view, load, find };
}
