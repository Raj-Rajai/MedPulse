import './admin.styles.css'; // style.css, then admin.css (same cascade order as the original)
import { mountPage } from '../../shared/mount';
import { applyStoredSidebarCollapsed } from '../../shared/nav-glider';
import { AdminApp } from './AdminApp';
import { initAdminSidebar } from './lib/sidebar';

// Inline <head> script of the original page, then initSidebar() from its DOMContentLoaded handler.
applyStoredSidebarCollapsed();
initAdminSidebar();

// The page renders straight into <body id="root">: style.css hides any other direct child of
// <body> (its "rogue right-side panel" rule), so the sidebar, <main>, modals and toasts must be
// body children exactly as in the original markup.
mountPage(() => <AdminApp />, { pwa: true });
