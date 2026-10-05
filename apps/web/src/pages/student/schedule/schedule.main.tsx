import '../styles/schedule-styles.css';
import { mountPage } from '../../../shared/mount';
import { ScheduleApp } from './ScheduleApp';

// schedule.html did not load pwa.js.
mountPage(() => <ScheduleApp />);
