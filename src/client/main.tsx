import { render } from 'solid-js/web';
import { startAutoSync } from '../lib/account.ts';
import { loadStore } from '../lib/store.ts';
import { App } from './App.tsx';
import './styles.css';

void loadStore().then(startAutoSync);
render(() => <App />, document.getElementById('root') as HTMLElement);
