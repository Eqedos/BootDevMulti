function extractUserAvatar(): string | null {
  const avatarImg = document.querySelector<HTMLImageElement>('img[alt="user avatar"]');
  return avatarImg?.src || null;
}

function extractUserName(): string | null {
  const nameSelectors = [
    'button[aria-label*="Profile"]',
    '[data-testid="user-menu"]',
    '.user-menu',
    'nav img[alt="user avatar"]'
  ];
  
  for (const selector of nameSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const textContent = element.textContent?.trim();
      if (textContent && textContent !== 'Profile') {
        return textContent;
      }
    }
  }
  
  return 'Player';
}

function injectActionButtons(): void {
    const courseCards = document.querySelectorAll<HTMLAnchorElement>('div.grid > a.block');
  
    courseCards.forEach((card: HTMLAnchorElement) => {
      const courseTitle: string = card.querySelector('h3')?.innerText ?? 'Unknown Course';
      const courseUrl = new URL(card.href);
      const courseId = courseUrl.pathname.split('/').filter(p => p).pop();
      
      if (!card.hasAttribute('data-logged')) {
        console.log(`Found Course -> Title: "${courseTitle}", ID: ${courseId}`);
        card.setAttribute('data-logged', 'true');
      }
  
      const injectionPoint = card.querySelector<HTMLDivElement>('.ml-2.flex-1');
  
      if (injectionPoint && !card.querySelector('.custom-button-container')) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'custom-button-container flex items-center gap-3 mt-4';
  
        const createButton = document.createElement('button');
        createButton.innerText = 'Create Room';
        createButton.className = 'px-4 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
  
        const joinButton = document.createElement('button');
        joinButton.innerText = 'Join Room';
        joinButton.className = 'px-4 py-1 text-sm font-semibold text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500';
        
        createButton.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault(); 
          e.stopPropagation(); 
          alert(`"Create" clicked for ${courseTitle}`);
        });
  
        joinButton.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          alert(`"Join" clicked for ${courseTitle}`);
        });
  
        buttonContainer.appendChild(createButton);
        buttonContainer.appendChild(joinButton);
        injectionPoint.appendChild(buttonContainer);
      }
    });
  }
  
  export function initDashboardFeatures(): void {
    console.log("Dashboard features initializing...");
    const observer = new MutationObserver(() => injectActionButtons());
    observer.observe(document.body, { childList: true, subtree: true });
    injectActionButtons(); 
  }