/**
 * Simple "coming soon" page. The Schedule and Exams links in the student sidebar open this page;
 * ScheduleApp and ExamsApp stay in the codebase for when those features return.
 */
export function UpcomingApp({ feature }: { feature: string }) {
    return (
        <main className="main-content">
            <section className="upcoming-card anim-fade-up" aria-labelledby="upcomingTitle">
                <div className="upcoming-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>
                <span className="upcoming-pill">Upcoming</span>
                <h1 id="upcomingTitle" className="upcoming-title">{feature} is coming soon</h1>
                <p className="upcoming-text">
                    We're getting {feature.toLowerCase()} ready for you. It will appear here as soon as it's available.
                </p>
            </section>
        </main>
    );
}
