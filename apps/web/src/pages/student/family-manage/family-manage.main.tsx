import '../styles/family-manage-styles.css';
import { mountPage } from '../../../shared/mount';
import { installFieldLocation } from '../common/fieldLocation';
import { FamilyManageApp } from './FamilyManageApp';

// family-manage.html loaded auth-guard.js, then field-location.js (which wraps the guarded fetch), and pwa.js.
mountPage(() => {
    installFieldLocation();
    return <FamilyManageApp />;
}, { pwa: true });
