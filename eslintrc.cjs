/* eslint-env node */
module.exports = {
    env: {
        browser: true,
        'vue/setup-compiler-macros': true,
    },
    parser: 'vue-eslint-parser',
    parserOptions: {
        ecmaVersion: 'latest',
        parser: '@typescript-eslint/parser',
    },
    extends: ['airbnb-base', 'plugin:vue/vue3-essential'],
    plugins: ['vue', '@typescript-eslint'],
    rules: {
        '@typescript-eslint/no-require-imports': 'off',
        'no-shadow': 'off',
        'no-console': 'off',
        'no-debugger': 'off',
        'import/prefer-default-export': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/no-unresolved': 'off',
        'no-prototype-builtins': 0,
        'no-param-reassign': ['error', { props: false }],
        'prefer-destructuring': 'off',
        'no-unused-expressions': ['error', { allowTernary: true }],
        'max-len': ['error', { code: 160 }],
        '@typescript-eslint/consistent-type-imports': [
            'error',
            {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
            },
        ],
    },
    overrides: [
        {
            files: ['*.vue'],
            rules: {
                'no-unused-vars': [
                    'error',
                    {
                        vars: 'all',
                        args: 'none',
                    },
                ],
                'vue/multi-word-component-names': [
                    'error',
                    {
                        ignores: ['index'],
                    },
                ],
                indent: 'off',
                'vue/script-indent': [
                    'error',
                    2,
                    {
                        baseIndent: 1,
                        switchCase: 0,
                        ignores: [],
                    },
                ],
                'import/no-unresolved': 'off',
                'prefer-destructuring': 'off',
                'no-unused-expressions': ['error', { allowTernary: true }],
                'max-len': ['error', { code: 160 }],
                'import/extensions': 'off',
                'no-prototype-builtins': 0,
                'no-param-reassign': ['error', { props: false }],
                'vue/component-name-in-template-casing': [
                    'error',
                    'kebab-case',
                    {
                        registeredComponentsOnly: true,
                        ignores: [],
                    },
                ],
            },
            extends: ['plugin:vue/vue3-recommended', 'airbnb-base'],
        },
        {
            files: ['functions/**/*.js'],
            rules: {
                '@typescript-eslint/no-require-imports': 'off',
                'no-undef': 'off',
                'no-unused-vars': 'off',
            },
        },
        {
            files: ['functions/**/*'],
            excludedFiles: ['*.test.js'],
            rules: {
                'no-console': 'off',
                'import/no-commonjs': 'off',
            },
        },
        {
            files: ['*.ts', '*.tsx'],
            extends: [
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking',
            ],
            parserOptions: {
                project: ['./tsconfig.app.json', './tsconfig.json'],
                parser: require.resolve('@typescript-eslint/parser'),
                sourceType: 'module',
            },
            rules: {
                '@typescript-eslint/no-shadow': ['error'],
                '@typescript-eslint/no-unused-vars': ['error'],
                '@typescript-eslint/no-unsafe-argument': 'warn',
                'import/extensions': 'off',
            },
        },
        {
            files: ['src/assets/icons/*.vue'],
            rules: {
                'max-len': 'off',
            },
        },
    ],
}
