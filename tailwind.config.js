import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
        './resources/js/**/*.ts',
    ],

    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#eff5fc',
                    100: '#dbe8f7',
                    200: '#bfd6f1',
                    300: '#93bbe7',
                    400: '#6098da',
                    500: '#3d79cd',
                    600: '#2b5fb4',
                    700: '#1f4d87',
                    800: '#1d406f',
                    900: '#1c375d',
                    950: '#13233d',
                },
                // Matches UCSSACCO_DMS_FRONT_END dark surfaces (#151b28 / #1e2532 / …)
                night: {
                    50: '#f1f5f9',
                    100: '#e6edf3',
                    200: '#c8d1dc',
                    300: '#a8b3c4',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#3a4455',
                    700: '#2d3544',
                    800: '#252d3b',
                    900: '#1e2532',
                    950: '#151b28',
                },
            },
            // Sharper radii (aligned with UCSSACCO FE ~6–8px controls / cards)
            borderRadius: {
                lg: '0.375rem', // 6px
                xl: '0.5rem', // 8px
                '2xl': '0.625rem', // 10px
                '3xl': '0.75rem', // 12px
            },
            fontFamily: {
                sans: ['Poppins', ...defaultTheme.fontFamily.sans],
                signature: ['"Dancing Script"', 'cursive'],
            },
            boxShadow: {
                card: 'none',
                pop: '0 8px 24px -8px rgb(0 0 0 / 0.18), 0 2px 8px -2px rgb(0 0 0 / 0.08)',
            },
            letterSpacing: {
                tight: '-0.025em',
                snug: '-0.015em',
            },
            keyframes: {
                'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(6px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 150ms ease-out',
                'slide-up': 'slide-up 180ms ease-out',
            },
        },
    },

    plugins: [forms],
};
