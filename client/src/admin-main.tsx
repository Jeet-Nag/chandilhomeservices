import { initApiInterceptor } from './config/api';
import { render } from 'preact';
import { AdminApp } from './components/AdminApp';
import './styles/index.css';

// Initialize centralized API routing
initApiInterceptor();

const root = document.getElementById('admin-app');
if (root) {
  render(<AdminApp />, root);
}
