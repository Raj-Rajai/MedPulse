import '../styles/profile-styles.css';
import { mountPage } from '../../../shared/mount';
import { ProfileApp } from './ProfileApp';

mountPage(() => <ProfileApp />, { pwa: true });
