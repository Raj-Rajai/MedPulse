import '../styles/index-styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IndexApp } from './IndexApp';
import { installDatePicker } from '../../../shared/ui/date-picker';

installDatePicker();

// student/index.html loaded neither auth-guard.js nor pwa.js, so it mounts without the guard.
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <IndexApp />
    </StrictMode>,
);
