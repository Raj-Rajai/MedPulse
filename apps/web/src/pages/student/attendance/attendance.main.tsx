import '../styles/attendance-styles.css';
import { mountPage } from '../../../shared/mount';
import { AttendanceApp } from './AttendanceApp';

mountPage(() => <AttendanceApp />, { pwa: true });
