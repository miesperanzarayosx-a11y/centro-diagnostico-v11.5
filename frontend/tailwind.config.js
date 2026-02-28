/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#00E5FF", // Electric Teal
                "primary-dark": "#00B8D4",
                "background-light": "#F8FAFC",
                "background-dark": "#020617", // Pitch black/Deep Navy
                "surface-dark": "#0F172A", // Dark Navy
                "surface-light": "#FFFFFF",
                "accent-teal": "#14B8A6",
            },
            fontFamily: {
                display: ["Outfit", "sans-serif"],
                body: ["Inter", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "1rem",
                'xl': "1.5rem",
                '2xl': "2rem",
            },
            boxShadow: {
                'neon': '0 0 10px rgba(0, 229, 255, 0.3), 0 0 20px rgba(0, 229, 255, 0.1)',
                'inner-glow': 'inset 0 0 20px rgba(0, 229, 255, 0.05)',
            }
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
    ],
}
