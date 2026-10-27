/** A Chart.js chart on a canvas, rebuilt whenever its config changes and destroyed on unmount. */
import { useEffect, useRef } from 'react';
import Chart, { type ChartConfiguration } from 'chart.js/auto';

Chart.defaults.font.family = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#64748b';
Chart.defaults.borderColor = '#e2e8f0';
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

export function ChartCanvas({ config, height = 260, label }: { config: ChartConfiguration; height?: number; label: string }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!ref.current) return;
        const chart = new Chart(ref.current, {
            ...config,
            options: { responsive: true, maintainAspectRatio: false, ...config.options },
        } as ChartConfiguration);
        return () => chart.destroy();
    }, [config]);

    return (
        <div className="mm-chart" style={{ height }}>
            <canvas ref={ref} role="img" aria-label={label} />
        </div>
    );
}
