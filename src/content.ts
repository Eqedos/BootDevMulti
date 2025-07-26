console.log("✅ BootDevBattle content script injected and running!");

if (window.location.pathname === '/dashboard') {
  import('./dashboard').then(dashboardModule => {
    dashboardModule.initDashboardFeatures();
  });
} else if (window.location.pathname.includes('/lessons/')) {
  import('./lessons').then(lessonModule => {
    lessonModule.initLessonFeatures();
  });
}