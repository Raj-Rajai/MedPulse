import '../common/student-styles.css';
import { mountPage } from '../../../shared/mount';
import { StudentPortalApp } from '../common/StudentPortal';

// schedule.html did not load pwa.js.
mountPage(() => <StudentPortalApp initialRoute="schedule" />);
