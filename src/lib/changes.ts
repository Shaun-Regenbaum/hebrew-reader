import { createSignal } from 'solid-js';

/** Goes up whenever the learner changes something worth saving. Sync watches it; applying a synced copy does not move it. */
const [localVersion, setLocalVersion] = createSignal(0);

export { localVersion };

export const markChanged = () => setLocalVersion((v) => v + 1);
