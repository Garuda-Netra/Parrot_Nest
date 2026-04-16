export function initToggle() {
  const toggleParrotClip = document.getElementById('toggle-parrotclip') as HTMLButtonElement | null;
  const toggleUrlShortener = document.getElementById('toggle-urlshortener') as HTMLButtonElement | null;
  const toggleIndicator = document.getElementById('toggle-indicator') as HTMLDivElement | null;
  
  const parrotClipUI = document.getElementById('parrotclip-ui') as HTMLDivElement | null;
  const urlShortenerUI = document.getElementById('urlshortener-ui') as HTMLDivElement | null;

  if (!toggleParrotClip || !toggleUrlShortener || !toggleIndicator || !parrotClipUI || !urlShortenerUI) return;

  function switchTool(tool: 'parrotclip' | 'urlshortener') {
    if (tool === 'parrotclip') {
      toggleIndicator!.style.transform = 'translateX(0)';
      
      toggleParrotClip!.classList.replace('text-gray-400', 'text-gold-glow');
      toggleUrlShortener!.classList.replace('text-gold-glow', 'text-gray-400');
      
      urlShortenerUI!.style.opacity = '0';
      setTimeout(() => {
        urlShortenerUI!.classList.add('hidden');
        urlShortenerUI!.classList.remove('flex');
        
        parrotClipUI!.classList.remove('hidden');
        parrotClipUI!.classList.add('flex');
        setTimeout(() => parrotClipUI!.style.opacity = '1', 50);
      }, 300);
      
    } else {
      toggleIndicator!.style.transform = `translateX(100%)`;
      
      toggleUrlShortener!.classList.replace('text-gray-400', 'text-gold-glow');
      toggleParrotClip!.classList.replace('text-gold-glow', 'text-gray-400');

      parrotClipUI!.style.opacity = '0';
      setTimeout(() => {
        parrotClipUI!.classList.add('hidden');
        parrotClipUI!.classList.remove('flex');
        
        urlShortenerUI!.classList.remove('hidden');
        urlShortenerUI!.classList.add('flex');
        urlShortenerUI!.classList.remove('overflow-hidden');
        urlShortenerUI!.classList.add('overflow-y-auto');
        urlShortenerUI!.scrollTo({ top: 0, behavior: 'auto' });
        setTimeout(() => urlShortenerUI!.style.opacity = '1', 50);
      }, 300);
    }
  }

  toggleParrotClip.addEventListener('click', () => switchTool('parrotclip'));
  toggleUrlShortener.addEventListener('click', () => switchTool('urlshortener'));
}
