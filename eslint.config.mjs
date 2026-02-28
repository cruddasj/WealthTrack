export default [
    {
        ignores: ["coverage/**"],
    },
    {
        files: ["**/*.js"],
        rules: {
            "no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],
            "no-undef": "off"
        }
    }
];