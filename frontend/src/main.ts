import './style.css'

import { initToggle } from './components/toggle';
import { initTabs } from './components/tabs';
import { initRipple } from './components/ripple';
import { initUrlBuilder } from './components/urlBuilder';
import { initParrotAnimation } from './components/parrotAnimation';
import { initHistory } from './components/history';

document.addEventListener('DOMContentLoaded', () => {
  // Global Liquid Ripple setup
  initRipple();
  
  // ParrotClip UI structure handlers
  initToggle();
  initTabs();

  // ParrotURLShortener handlers
  initUrlBuilder();

  // Bring the hero parrot to life
  initParrotAnimation();

  // Secret history modal + delete actions
  initHistory();
});
