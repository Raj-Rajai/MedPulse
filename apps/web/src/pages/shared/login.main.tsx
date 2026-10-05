import './login-styles.css';
import { mountPage } from '../../shared/mount';
import { LoginApp } from './LoginApp';

mountPage(() => <LoginApp />, { pwa: true });
