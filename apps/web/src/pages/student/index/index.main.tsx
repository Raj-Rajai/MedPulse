import '../common/student-styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudentPortalApp } from '../common/StudentPortal';
import { installDatePicker } from '../../../shared/ui/date-picker';

installDatePicker();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <StudentPortalApp initialRoute="home" />
    </StrictMode>,
);
