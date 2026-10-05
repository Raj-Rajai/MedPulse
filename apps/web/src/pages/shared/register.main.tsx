import './register-styles.css';
import { mountPage } from '../../shared/mount';
import { RegisterApp } from './RegisterApp';

mountPage(() => <RegisterApp />, { pwa: true });
