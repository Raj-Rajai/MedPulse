import '../styles/entry-styles.css';
import { mountPage } from '../../../shared/mount';
import { installFieldLocation } from '../common/fieldLocation';
import { EntryApp } from './EntryApp';

// entry.html loaded auth-guard.js, then field-location.js (which wraps the guarded fetch), and pwa.js.
mountPage(() => {
    installFieldLocation();
    return <EntryApp />;
}, { pwa: true });
