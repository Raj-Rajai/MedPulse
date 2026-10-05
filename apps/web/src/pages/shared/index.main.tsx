import '../../styles/style.css';
import { mountPage } from '../../shared/mount';
import { IndexApp } from './IndexApp';

mountPage(() => <IndexApp />, { pwa: true });
