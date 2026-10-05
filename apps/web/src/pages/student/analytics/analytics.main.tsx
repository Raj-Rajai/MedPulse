import '../styles/analytics-styles.css';
import { mountPage } from '../../../shared/mount';
import { AnalyticsApp } from './AnalyticsApp';

mountPage(() => <AnalyticsApp />, { pwa: true });
