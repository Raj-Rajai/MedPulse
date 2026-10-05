import '../styles/exams-styles.css';
import { mountPage } from '../../../shared/mount';
import { ExamsApp } from './ExamsApp';

mountPage(() => <ExamsApp />, { pwa: true });
