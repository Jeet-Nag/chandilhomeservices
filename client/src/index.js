import { jsx as _jsx } from "preact/jsx-runtime";
import { render } from 'preact';
import { App } from './app';
import './styles/index.css';
const root = document.getElementById('app');
if (root) {
    render(_jsx(App, {}), root);
}
