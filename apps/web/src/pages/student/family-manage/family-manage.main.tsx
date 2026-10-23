import '../common/student-styles.css';
import { mountPage } from '../../../shared/mount';
import { installFieldLocation } from '../common/fieldLocation';
import { StudentPortalApp } from '../common/StudentPortal';

// family-manage.html loaded auth-guard.js, then field-location.js (which wraps the guarded fetch), and pwa.js.
mountPage(() => {
    installFieldLocation();
    return <StudentPortalApp initialRoute="families" />;
}, { pwa: true });
