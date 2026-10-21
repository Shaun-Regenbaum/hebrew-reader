import { render } from 'solid-js/web';
import { loadStore } from '../lib/store.ts';
import { App } from './App.tsx';
import './styles.css';

void loadStore();
render(() => <App />, document.getElementById('root') as HTMLElement);
