import type { CSSProperties } from 'react';
import { MessageRow } from '../../components/ModalOverlay';
import type { CollegeStat } from '../../types';

const postingBox: CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: 16 };
const postingText: CSSProperties = { fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 };

const POSTINGS = [
    { color: '#0284c7', title: 'RHTC - Rural Health Training Center', text: 'Primary rural posting block covering village wards, agricultural communities, and rural sub-centers.' },
    { color: '#7c3aed', title: 'UHTC - Urban Health Training Center', text: 'Urban slum settlements, peri-urban field catchment sectors, and municipal primary clinics.' },
    { color: '#059669', title: 'Primary Health Center (PHC) Posting', text: 'Government primary healthcare clinics, maternal & child health (RCH) immunization hubs.' },
];

/** VIEW 4: Colleges & posting units (loadCollegesMaster). */
export function CollegesSection({ active, colleges, onAdd }: { active: boolean; colleges: CollegeStat[] | null; onAdd: () => void }) {
    return (
        <div id="viewColleges" className={`admin-view-pane${active ? ' active' : ''}`}>
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 className="card-title" style={{ marginBottom: 4, fontSize: '1.25rem' }}>
                            🏥 Affiliated Medical Institutions &amp; Colleges
                        </h2>
                        <p className="card-desc" style={{ margin: 0 }}>
                            Configure medical colleges, institutional codes, and geographical branches.
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={onAdd} style={{ fontSize: '0.82rem' }}>
                        ➕ Add Medical College
                    </button>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 60 }}>ID</th>
                                <th>Institution Name</th>
                                <th>College Code</th>
                                <th>City</th>
                                <th>State</th>
                                <th style={{ textAlign: 'center' }}>Enrolled Cadets</th>
                                <th style={{ textAlign: 'center' }}>Families Surveyed</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="collegesMasterTbody">
                            {colleges === null ? (
                                <MessageRow colSpan={8} padding={24}>Loading colleges...</MessageRow>
                            ) : colleges.length === 0 ? (
                                <MessageRow colSpan={8} padding={24}>No institutions registered</MessageRow>
                            ) : (
                                colleges.map((c) => (
                                    <tr key={c.id}>
                                        <td><strong>#{c.id}</strong></td>
                                        <td><strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{c.name || ''}</strong></td>
                                        <td><code>{c.code || ''}</code></td>
                                        <td>{c.city || '-'}</td>
                                        <td>{c.state || '-'}</td>
                                        <td style={{ textAlign: 'center' }}><span className="badge badge-primary">{c.students_count} Cadets</span></td>
                                        <td style={{ textAlign: 'center' }}><span className="badge badge-success">{c.families_count} Families</span></td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="badge badge-success">Affiliated</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Clinical Posting Units Reference Card */}
            <div className="card">
                <h2 style={{ fontSize: '1.15rem', fontWeight: 750, marginBottom: 12, color: 'var(--text-primary)' }}>
                    📍 Clinical Field Training Postings
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    {POSTINGS.map((p) => (
                        <div style={postingBox} key={p.title}>
                            <div style={{ fontWeight: 750, color: p.color, marginBottom: 4 }}>{p.title}</div>
                            <p style={postingText}>{p.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
