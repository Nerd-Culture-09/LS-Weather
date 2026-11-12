/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  corePlugins: {
    preflight: false,
  },
  content: [
    "./pages/**/*.{axml,js,ts}",
    "./components/**/*.{axml,js,ts}",
    "./app.acss",
    "./app.js",
  ],
  theme: {
    extend: {
   
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
        '4xl': ['32px', { lineHeight: '40px' }],
      }, 
      screens: {
        'xs': '360px',
        'sm': '392px',
        'md': '412px',
        'lg': '432px',
        'xl': '480px',
        '2xl': '540px',
      },
      height: {
        // Static heights for common mobile components
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px', // Minimum touch target
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '28': '112px',
        '32': '128px',
        '36': '144px',
        '40': '160px',
        '44': '176px',
        '48': '192px',
        '52': '208px',
        '56': '224px',
        '60': '240px',
        '64': '256px',
        '72': '288px',
        '80': '320px',
        '96': '384px',
        
        // Screen-based heights
        'screen-xs': '568px',   // iPhone SE height
        'screen-sm': '640px',   // Small Android
        'screen-md': '732px',   // Standard Android
        'screen-lg': '800px',   // Large Android
        'screen-xl': '856px',   // Extra Large
        'screen-2xl': '1024px', // Tablets
        
        // Viewport heights optimized for mobile
        'vh-5': '5vh',
        'vh-10': '10vh',
        'vh-20': '20vh',
        'vh-25': '25vh',
        'vh-30': '30vh',
        'vh-33': '33vh',
        'vh-40': '40vh',
        'vh-50': '50vh',
        'vh-60': '60vh',
        'vh-66': '66vh',
        'vh-70': '70vh',
        'vh-75': '75vh',
        'vh-80': '80vh',
        'vh-90': '90vh',
        'vh-95': '95vh',
        
        // Dynamic viewport heights (better for mobile)
        'dvh-10': '10dvh',
        'dvh-20': '20dvh',
        'dvh-25': '25dvh',
        'dvh-30': '30dvh',
        'dvh-40': '40dvh',
        'dvh-50': '50dvh',
        'dvh-60': '60dvh',
        'dvh-70': '70dvh',
        'dvh-75': '75dvh',
        'dvh-80': '80dvh',
        'dvh-90': '90dvh',
        'dvh-100': '100dvh',
        
        // Common mobile component heights
        'header-sm': '48px',    // Small header
        'header-md': '56px',    // Medium header
        'header-lg': '64px',    // Large header
        'input-sm': '40px',     // Small input
        'input-md': '48px',     // Medium input
        'input-lg': '56px',     // Large input
        'button-sm': '36px',    // Small button
        'button-md': '44px',    // Medium button (min touch target)
        'button-lg': '52px',    // Large button
        'tab-sm': '40px',       // Tab height
        'tab-md': '48px',       // Tab height
        'card-sm': '80px',      // Small card
        'card-md': '120px',     // Medium card
        'card-lg': '160px',     // Large card
        'list-item': '56px',    // Standard list item
        'list-item-lg': '72px', // Large list item
      },
      minHeight: {
        // Minimum heights
        '0': '0px',
        '11': '44px', // Minimum touch target
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '32': '128px',
        '40': '160px',
        '48': '192px',
        '56': '224px',
        '64': '256px',
        'screen': '100vh',
        'screen-xs': '568px',
        'screen-sm': '640px',
        'screen-md': '732px',
        
        // Viewport min-heights
        'vh-50': '50vh',
        'vh-60': '60vh',
        'vh-70': '70vh',
        'vh-80': '80vh',
        'vh-90': '90vh',
      },
      maxHeight: {
        // Maximum heights
        '0': '0px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '32': '128px',
        '40': '160px',
        '48': '192px',
        '56': '224px',
        '64': '256px',
        '72': '288px',
        '80': '320px',
        '96': '384px',
        
        // Screen max-heights
        'screen': '100vh',
        'screen-sm': '640px',
        'screen-md': '732px',
        'screen-lg': '800px',
        
        // Viewport max-heights
        'vh-50': '50vh',
        'vh-60': '60vh',
        'vh-70': '70vh',
        'vh-80': '80vh',
        'vh-90': '90vh',
        
        // Common max heights
        'modal-sm': '40vh',
        'modal-md': '60vh',
        'modal-lg': '80vh',
        'dropdown': '200px',
        'sheet-sm': '300px',
        'sheet-md': '500px',
        'sheet-lg': '700px',
      },
    },
  },
  plugins: [],
}