import { jsx as _jsx } from "preact/jsx-runtime";
import { initApiInterceptor } from './config/api';
import { render } from 'preact';
import { App } from './app';
import './styles/index.css';
// Initialize centralized API routing
initApiInterceptor();
const root = document.getElementById('app');
if (root) {
    render(_jsx(App, {}), root);
}
