import { useState } from 'react';
import { AccordionSectionHeader } from './FastControls';
import { FOOD_ITEMS, calculateNutritionRow } from './nutritionConstants';
import type { FamilySurveyRecord } from './types';

export interface HealthyMacrosSectionProps {
    surveyRecord: FamilySurveyRecord;
    onChangeSurveyRecord: (updater: (prev: FamilySurveyRecord) => FamilySurveyRecord) => void;
}

export function HealthyMacrosSection({ surveyRecord, onChangeSurveyRecord }: HealthyMacrosSectionProps) {
    const [isClosed, setIsClosed] = useState(false);
    const handleDayChange = (foodId: string, valStr: string) => {
        const num = parseFloat(valStr) || 0;
        onChangeSurveyRecord((prev) => {
            const nextIntake = {
                ...(prev.nutritionIntakeDay || {}),
                [foodId]: Math.max(0, num),
            };

            // Calculate total calories to sync with family diet
            let totalKcal = 0;
            for (const item of FOOD_ITEMS) {
                const q = nextIntake[item.id] || 0;
                totalKcal += (q / 100) * item.kcalPer100g;
            }
            const famCu = parseFloat(prev.totalCu) || 1.0;
            const perCuKcal = famCu > 0 ? Math.round(totalKcal / famCu) : 0;

            return {
                ...prev,
                nutritionIntakeDay: nextIntake,
                calorieIntakePerCu: String(perCuKcal),
            };
        });
    };

    // Calculate totals across all food items
    let grandTotalMonth = 0;
    let grandTotalDay = 0;
    let grandTotalKcal = 0;
    let grandTotalProtein = 0;

    const rows = FOOD_ITEMS.map((item) => {
        const qDay = surveyRecord.nutritionIntakeDay?.[item.id] || 0;
        const res = calculateNutritionRow(qDay, item);
        grandTotalMonth += res.quantityMonth;
        grandTotalDay += res.quantityDay;
        grandTotalKcal += res.kcal;
        grandTotalProtein += res.protein;
        return { item, res };
    });

    const famCu = parseFloat(surveyRecord.totalCu) || 1.0;
    const perCuKcal = famCu > 0 ? (grandTotalKcal / famCu).toFixed(1) : '0';
    const perCuProtein = famCu > 0 ? (grandTotalProtein / famCu).toFixed(1) : '0';

    // Group rows by category
    const categories: Record<string, typeof rows> = {};
    for (const r of rows) {
        if (!categories[r.item.category]) categories[r.item.category] = [];
        categories[r.item.category].push(r);
    }

    return (
        <div className="card anim-fade-up" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.4rem' }}>
            <AccordionSectionHeader
                id="macros_section"
                title="Healthy Macros / Food Intake Assessment"
                subtitle="Enter daily quantity (gm) per item; monthly quantity, Kcal, and Protein calculate automatically"
                badge={`Total: ${grandTotalKcal.toFixed(0)} kcal / day`}
                isClosed={isClosed}
                onToggle={() => setIsClosed((prev) => !prev)}
            />

            {!isClosed && (
                <>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ background: '#f5f0ff', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Daily Energy</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{grandTotalKcal.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>kcal</span></div>
                </div>
                <div style={{ background: '#f5f0ff', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Daily Protein</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{grandTotalProtein.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>g</span></div>
                </div>
                <div style={{ background: '#f5f0ff', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Intake / C.U. / Day</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{perCuKcal} kcal • {perCuProtein} g</div>
                </div>
            </div>

            <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#f5f0ff', color: 'var(--primary)', textAlign: 'left', borderBottom: '2px solid #e9d5ff' }}>
                            <th style={{ padding: '10px 12px', width: '140px' }}>Nutrients</th>
                            <th style={{ padding: '10px 12px', minWidth: '160px' }}>Items</th>
                            <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Qty (month)</th>
                            <th style={{ padding: '10px 12px', width: '140px', textAlign: 'center', background: '#ede9fe', color: 'var(--primary)', fontWeight: 800 }}>
                                Qty (day) (gm) ✎
                            </th>
                            <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right' }}>Kcal / 100g</th>
                            <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right', fontWeight: 700 }}>Kcal</th>
                            <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Protein / 100g</th>
                            <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right', fontWeight: 700 }}>Protein</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(categories).map(([catName, catRows]) => (
                            catRows.map((r, rIdx) => {
                                const isFirstInCat = rIdx === 0;
                                return (
                                    <tr key={r.item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        {isFirstInCat ? (
                                            <td
                                                rowSpan={catRows.length}
                                                style={{
                                                    padding: '10px 12px',
                                                    fontWeight: 700,
                                                    color: 'var(--primary)',
                                                    background: '#faf8ff',
                                                    verticalAlign: 'top',
                                                    borderRight: '1px solid #ede9fe',
                                                }}
                                            >
                                                {catName}
                                            </td>
                                        ) : null}
                                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.item.name}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {r.res.quantityMonth > 0 ? `${r.res.quantityMonth} g` : '—'}
                                        </td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center', background: '#faf5ff' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                placeholder="0"
                                                value={surveyRecord.nutritionIntakeDay?.[r.item.id] || ''}
                                                onChange={(e) => handleDayChange(r.item.id, e.target.value)}
                                                style={{
                                                    width: '100px',
                                                    textAlign: 'right',
                                                    height: '32px',
                                                    padding: '0 8px',
                                                    borderRadius: '6px',
                                                    border: '1.5px solid var(--primary)',
                                                    fontWeight: 700,
                                                    color: 'var(--primary)',
                                                    background: '#ffffff',
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {r.item.kcalPer100g}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: r.res.kcal > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                                            {r.res.kcal > 0 ? r.res.kcal.toFixed(1) : '—'}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {r.item.proteinPer100g} g
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: r.res.protein > 0 ? '#10b981' : 'var(--text-muted)' }}>
                                            {r.res.protein > 0 ? `${r.res.protein.toFixed(1)} g` : '—'}
                                        </td>
                                    </tr>
                                );
                            })
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#f5f0ff', borderTop: '2px solid var(--primary)', fontWeight: 750 }}>
                            <td colSpan={2} style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                Total Household Consumption:
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                {grandTotalMonth.toFixed(0)} g
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--primary)', fontWeight: 800 }}>
                                {grandTotalDay.toFixed(1)} g/day
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--primary)', fontSize: '1.05rem' }}>
                                {grandTotalKcal.toFixed(1)}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#10b981', fontSize: '1.05rem' }}>
                                {grandTotalProtein.toFixed(1)} g
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            </>
            )}
        </div>
    );
}
