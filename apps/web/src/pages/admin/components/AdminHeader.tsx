import type { ExportButtons } from '../hooks/useExports';

export interface Heading { title: string; sub: string }

/** Top action bar: brand, dynamic heading for the active tab. */
export function AdminHeader({ heading }: {
    heading: Heading;
    exports?: ExportButtons;
    onRegisterCadet?: () => void;
    onRefresh?: () => void;
}) {
    return (
        <div className="page-header admin-page-header anim-fade-up">
            <div className="page-header-brand">
                <img src="/images/sal-logo.png" alt="SAL Logo" className="header-brand-logo" />
                <div className="page-header-text">
                    <h1 className="page-title page-title-animated" id="adminPageHeading">{heading.title}</h1>
                    {heading.sub && <p className="page-subtitle" id="adminPageSubheading">{heading.sub}</p>}
                </div>
            </div>
        </div>
    );
}

