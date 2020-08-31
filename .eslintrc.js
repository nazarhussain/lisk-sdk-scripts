module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: './tsconfig.json',
		tsconfigRootDir: __dirname,
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'lisk-base/base',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
		'prettier/@typescript-eslint',
		'plugin:import/errors',
		'plugin:import/warnings',
		'plugin:import/typescript',
	],
	rules: {
		'max-len': 'off', // Managed by prettier
		'implicit-arrow-linebreak': 'off', // Preferred
		'lines-between-class-members': 'off', // Off because typescript has members and methods
		'func-names': ['error', 'never'],
		'import/extensions': [
			'error',
			'ignorePackages',
			{
				js: 'never',
				ts: 'never',
			},
		],
		'new-cap': ['error', { capIsNewExceptions: ['Given', 'Then', 'When', 'Before'] }],
	},
	globals: {
		BigInt: true,
	},
};
