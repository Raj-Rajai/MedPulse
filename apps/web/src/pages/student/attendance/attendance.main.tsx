import '../common/student-styles.css';
import { mountPage } from '../../../shared/mount';
import { StudentPortalApp } from '../common/StudentPortal';

mountPage(() => <StudentPortalApp initialRoute="profile" />, { pwa: true });
