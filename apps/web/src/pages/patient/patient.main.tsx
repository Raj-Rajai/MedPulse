import './patient-styles.css';
import { mountPage } from '../../shared/mount';
import { PatientApp } from './PatientApp';

mountPage(() => <PatientApp />, { pwa: true });
