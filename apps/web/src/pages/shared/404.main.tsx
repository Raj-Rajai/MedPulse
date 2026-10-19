import './NotFoundApp.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerServiceWorker } from '../../shared/pwa';
import { NotFoundApp } from './NotFoundApp';

registerServiceWorker();

const el = document.getElementById('root');
if (el) {
    createRoot(el).render(
        <StrictMode>
            <NotFoundApp initialPortal="common" />
        </StrictMode>
    );
}
