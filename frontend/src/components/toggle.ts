export function initToggle() {
  const toggleParrotShare = document.getElementById('toggle-parrotshare') as HTMLButtonElement | null;
  const toggleUrlShortener = document.getElementById('toggle-urlshortener') as HTMLButtonElement | null;
  const toggleIndicator = document.getElementById('toggle-indicator') as HTMLDivElement | null;
  
  const parrotShareUI = document.getElementById('parrotshare-ui') as HTMLDivElement | null;
  const urlShortenerUI = document.getElementById('urlshortener-ui') as HTMLDivElement | null;

  if (!toggleParrotShare || !toggleUrlShortener || !toggleIndicator || !parrotShareUI || !urlShortenerUI) return;

  function switchTool(tool: 'parrotshare' | 'urlshortener') {
    if (tool === 'parrotshare') {
      toggleIndicator!.style.transform = 'translateX(0)';
      
      toggleParrotShare!.classList.replace('text-gray-400', 'text-gold-glow');
      toggleUrlShortener!.classList.replace('text-gold-glow', 'text-gray-400');
      
      urlShortenerUI!.style.opacity = '0';
      setTimeout(() => {
        urlShortenerUI!.classList.add('hidden');
        urlShortenerUI!.classList.remove('flex');
        
        parrotShareUI!.classList.remove('hidden');
        parrotShareUI!.classList.add('flex');
        setTimeout(() => parrotShareUI!.style.opacity = '1', 50);
      }, 300);
      
    } else {
      toggleIndicator!.style.transform = `translateX(100%)`;
      
      toggleUrlShortener!.classList.replace('text-gray-400', 'text-gold-glow');
      toggleParrotShare!.classList.replace('text-gold-glow', 'text-gray-400');

      parrotShareUI!.style.opacity = '0';
      setTimeout(() => {
        parrotShareUI!.classList.add('hidden');
        parrotShareUI!.classList.remove('flex');
        
        urlShortenerUI!.classList.remove('hidden');
        urlShortenerUI!.classList.add('flex');
        urlShortenerUI!.classList.remove('overflow-hidden');
        urlShortenerUI!.classList.add('overflow-y-auto');
        urlShortenerUI!.scrollTo({ top: 0, behavior: 'auto' });
        setTimeout(() => urlShortenerUI!.style.opacity = '1', 50);
      }, 300);
    }
  }

  toggleParrotShare.addEventListener('click', () => switchTool('parrotshare'));
  toggleUrlShortener.addEventListener('click', () => switchTool('urlshortener'));
}
