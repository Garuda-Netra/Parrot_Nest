/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        parchment: {
          light: '#F4EAD5',
          DEFAULT: '#E6D5B8',
          dark: '#B09B71'
        },
        darkUI: {
          light: '#2A2A2A',
          DEFAULT: '#121212',
          deep: '#0a0a0a',
          glass: 'rgba(18, 18, 18, 0.6)',
          overlay: 'rgba(0, 0, 0, 0.75)'
        },
        gold: {
          muted: '#CFAE7B',
          glow: '#E2C288'
        }
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
        'ripple': 'ripple 0.6s linear',
        'wiggle': 'wiggle 0.3s ease-in-out',
        'shake': 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
        'fade-slide': 'fadeSlide 0.3s ease-out',
        'parrot-float': 'parrotFloat 4.5s ease-in-out infinite',
        'glow-pulse': 'glowPulse 6s ease-in-out infinite'
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        fadeSlide: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.4' },
          '100%': { transform: 'scale(3)', opacity: '0' }
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-3px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(3px, 0, 0)' }
        },
        parrotFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' }
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' }
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' }
        }
      }
    },
  },
  plugins: [],
}
