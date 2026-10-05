import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import { useToast } from '../../hooks/useToasts';
import { datePart, errMessage } from '../../lib/http';
import type { Household } from '../../types';

function CalorieBadge({ status }: { status?: string | null }) {
    if (status === 'D') return <span className="badge badge-danger">Deficient</span>;
    if (status === 'E') return <span className="badge badge-warning">Excess</span>;
    return <span className="badge badge-info">Normal</span>;
}

/** VIEW 3: Global household registry (loadGlobalHouseholds / filterHouseholds). */
export function HouseholdsSection({ active, loadSignal }: { active: boolean; loadSignal: number }) {
    const showToast = useToast();
    const allRef = useRef<Household[]>([]);
    const [count, setCount] = useState(0);
    const [rows, setRows] = useState<Household[] | null>(null);
    const [q, setQ] = useState('');
    const [surveyor, setSurveyor] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/families');
            if (!res.ok) throw new Error('Failed to load global households');
            const families = (await res.json()) as Household[];
            allRef.current = families;
            setCount(families.length);
            setRows(families);
        } catch (err) {
            showToast(errMessage(err), 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (loadSignal) load();
    }, [loadSignal, load]);

    const applyFilter = (query: string, cadet: string) => {
        const ql = query.toLowerCase().trim();
        setRows(allRef.current.filter((f) => {
            const matchesQ = !ql || (f.head_of_family && f.head_of_family.toLowerCase().includes(ql)) || (f.family_code && f.family_code.toLowerCase().includes(ql)) || (f.village && f.village.toLowerCase().includes(ql)) || (f.student_name && f.student_name.toLowerCase().includes(ql)) || (f.roll_number && f.roll_number.toLowerCase().includes(ql));
            const matchesCadet = !cadet || String(f.student_id) === String(cadet);
            return matchesQ && matchesCadet;
        }));
    };

    return (
        <div id="viewHouseholds" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="card">
                {/* Filter Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.25rem' }}>
                            🏡 Global Household Registry (<span id="householdTotalCount">{count}</span> Households)
                        </h2>
                        <p className="card-desc" style={{ margin: 0 }}>
                            Consolidated household surveillance records across all students with socio-demographics.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="text" id="householdSearchInput" className="search-input" placeholder="🔍 Search family code, HOF, village..." value={q}
                            onChange={(e) => { setQ(e.target.value); applyFilter(e.target.value, surveyor); }}
                            style={{ maxWidth: 250, fontSize: '0.82rem', padding: '0.45rem 0.8rem' }} />

                        <select id="householdCadetFilter" value={surveyor} onChange={(e) => { setSurveyor(e.target.value); applyFilter(q, e.target.value); }} style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#fff', maxWidth: 200 }}>
                            <option value="">All Surveyors (Cadets)</option>
                        </select>
                    </div>
                </div>

                {/* Households Table */}
                <div className="table-wrapper">
                    <table id="householdsTable">
                        <thead>
                            <tr>
                                <th>Family Code</th>
                                <th>Family No.</th>
                                <th>Head of Family (HOF)</th>
                                <th>Village / Ward</th>
                                <th>Surveyor Cadet</th>
                                <th>Institution</th>
                                <th style={{ textAlign: 'center' }}>Members</th>
                                <th style={{ textAlign: 'center' }}>Calorie Status</th>
                                <th>Survey Date</th>
                            </tr>
                        </thead>
                        <tbody id="householdsTbody">
                            {rows === null ? (
                                <MessageRow colSpan={9} padding={24}>Loading household surveillance registry...</MessageRow>
                            ) : rows.length === 0 ? (
                                <MessageRow colSpan={9} padding={24}>No surveyed households recorded</MessageRow>
                            ) : (
                                rows.map((f, i) => (
                                    <tr key={i}>
                                        <td><code>{f.family_code || 'FAM-' + f.family_no}</code></td>
                                        <td><strong>#{f.family_no}</strong></td>
                                        <td><strong style={{ color: 'var(--text-primary)' }}>{f.head_of_family || ''}</strong></td>
                                        <td>{f.village || 'Field Block'}</td>
                                        <td>
                                            <strong>{f.student_name || ''}</strong>
                                            {' '}
                                            <span className="badge badge-primary" style={{ fontSize: '0.68rem', marginLeft: 4 }}>Roll {f.roll_number || ''}</span>
                                        </td>
                                        <td>{f.college_name || 'SAL'}</td>
                                        <td style={{ textAlign: 'center' }}><span className="badge badge-success">{f.members_count || 0} Members</span></td>
                                        <td style={{ textAlign: 'center' }}><CalorieBadge status={f.calorie_status} /></td>
                                        <td>{f.survey_date || datePart(f.created_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
