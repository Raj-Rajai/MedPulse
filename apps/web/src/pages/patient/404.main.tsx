import '../shared/NotFoundApp.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NotFoundApp } from '../shared/NotFoundApp';

const el = document.getElementById('root');
if (el) {
    createRoot(el).render(
        <StrictMode>
            <NotFoundApp initialPortal="patient" />
        </StrictMode>
    );
}
