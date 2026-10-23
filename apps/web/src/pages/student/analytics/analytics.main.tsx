import '../common/student-styles.css';
import { mountPage } from '../../../shared/mount';
import { StudentPortalApp } from '../common/StudentPortal';

mountPage(() => <StudentPortalApp initialRoute="analytics" />, { pwa: true });
