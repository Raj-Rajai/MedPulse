import { useLayoutEffect, useRef, useState } from 'react';
import { ModalOverlay, closeBtnStyle, modalFootStyle, modalHeadStyle, twoColStyle } from '../../components/ModalOverlay';
import type { ModalState } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToasts';
import { errMessage, readJson, sendJson } from '../../lib/http';
import type { CollegeStat } from '../../types';

const DEFAULTS = { name: '', code: '', city: '', state: 'Gujarat' };

export function AddCollegeModal({ modal, onSaved }: { modal: ModalState<true>; onSaved: () => void }) {
    const showToast = useToast();
    const [f, setF] = useState(DEFAULTS);
    const [busy, setBusy] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        if (!modal.nonce) return;
        setF(DEFAULTS);
        nameRef.current?.focus();
    }, [modal.nonce]);

    const set = (k: keyof typeof DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = {
                name: f.name.trim(),
                code: f.code.trim(),
                city: f.city.trim() || null,
                state: f.state.trim() || 'Gujarat',
            };
            const res = await sendJson('/api/admin/colleges', 'POST', payload);
            const data = await readJson<{ college: CollegeStat }>(res);
            if (!res.ok) throw new Error(data.error || 'Failed to add college');
            showToast(`Institution "${data.college.name}" registered!`, 'success');
            modal.hide();
            onSaved();
        } catch (err) {
            showToast(errMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalOverlay id="addCollegeModal" open={modal.open} onClose={modal.hide} contentStyle={{ maxWidth: 480 }}>
            <div style={modalHeadStyle}>
                <h2 style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>🏥 Add Medical Institution</h2>
                <button className="btn btn-secondary" onClick={modal.hide} style={closeBtnStyle}>✕</button>
            </div>
            <form id="addCollegeForm" onSubmit={submit}>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-group">
                        <label htmlFor="acName">College / Hospital Name *</label>
                        <input type="text" id="acName" ref={nameRef} required placeholder="e.g. B.J. Medical College" value={f.name} onChange={set('name')} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="acCode">Institutional Code *</label>
                        <input type="text" id="acCode" required placeholder="e.g. BJMC-01" value={f.code} onChange={set('code')} />
                    </div>
                    <div style={twoColStyle}>
                        <div className="form-group">
                            <label htmlFor="acCity">City</label>
                            <input type="text" id="acCity" placeholder="Ahmedabad" value={f.city} onChange={set('city')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="acState">State</label>
                            <input type="text" id="acState" value={f.state} onChange={set('state')} />
                        </div>
                    </div>
                </div>
                <div style={modalFootStyle}>
                    <button type="button" className="btn btn-secondary" onClick={modal.hide}>Cancel</button>
                    <button type="submit" className="btn btn-primary" id="addCollegeSubmitBtn" disabled={busy}>{busy ? 'Saving...' : '💾 Save College'}</button>
                </div>
            </form>
        </ModalOverlay>
    );
}
