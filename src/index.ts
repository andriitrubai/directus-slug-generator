import { defineInterface } from '@directus/extensions-sdk';

import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'slug-generator',
	name: 'Slug Generator',
	icon: 'link',
	description: 'Generate and validate a slug from another field',
	component: InterfaceComponent,
	types: ['string'],
	group: 'standard',
	options: [
		{
			field: 'generationMode',
			name: 'Generation Mode',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: 'Slug', value: 'slug' },
						{ text: 'UUID v4', value: 'uuid' },
					],
				},
			},
			schema: {
				default_value: 'slug',
			},
		},
		{
			field: 'selectCollection',
			name: 'Source Collection',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'system-collection',
				options: {
					allowPrimaryKey: false,
					allowNone: false,
					includeCollections: ['translations'],
				},
			},
		},
		{
			field: 'selectField',
			name: 'Source Field',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'system-field',
				options: {
					collectionField: 'selectCollection',
					allowPrimaryKey: false,
					allowNone: false,
					fieldFilter: {
						type: ['string'],
					},
				},
			},
		},
		{
			field: 'auto',
			name: 'Auto Generate',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Generate slug automatically',
				},
			},
			schema: {
				default_value: true,
			},
		},
		{
			field: 'required',
			name: 'Required',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Slug is required',
				},
			},
			schema: {
				default_value: true,
			},
		},
		{
			field: 'separator',
			name: 'Separator',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: 'Hyphen (-)', value: '-' },
						{ text: 'Underscore (_)', value: '_' },
					],
				},
			},
			schema: {
				default_value: '-',
			},
		},
		{
			field: 'lowercase',
			name: 'Lowercase',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Convert to lowercase',
				},
			},
			schema: {
				default_value: true,
			},
		},
		{
			field: 'placeholder',
			name: 'Placeholder',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				options: {
					placeholder: 'Enter placeholder text...',
				},
			},
		},
		{
			field: 'customEmptyMessage',
			name: 'Custom Empty Error Message',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder: 'Slug cannot be empty. Please enter a valid slug.',
				},
			},
		},
		{
			field: 'customFormatMessage',
			name: 'Custom Format Error Message',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder:
            'Slug must contain only lowercase letters, numbers, hyphens, and forward slashes.',
				},
			},
		},
		{
			field: 'allowDuplicates',
			name: 'Allow Duplicate Slugs',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Allow duplicate slugs across collections',
				},
			},
			schema: {
				default_value: false,
			},
		},
		{
			field: 'autoUpdateMode',
			name: 'Auto Update Mode',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: 'Disabled', value: 'disabled' },
						{ text: 'On Change', value: 'change' },
						{ text: 'On Blur', value: 'blur' },
						{ text: 'On Focus', value: 'focus' },
						{ text: 'Real-time', value: 'realtime' },
					],
				},
			},
			schema: {
				default_value: 'change',
			},
		},
		{
			field: 'preserveExisting',
			name: 'Preserve Existing Values',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Preserve existing URL values when source changes',
				},
			},
			schema: {
				default_value: false,
			},
		},
		{
			field: 'updateDelay',
			name: 'Update Delay (ms)',
			type: 'integer',
			meta: {
				width: 'half',
				interface: 'input',
				options: {
					placeholder: '100',
				},
			},
			schema: {
				default_value: 100,
			},
		},
		{
			field: 'showPreviewLink',
			name: 'Show Preview Link',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Display a preview link under the field',
				},
			},
			schema: {
				default_value: true,
			},
		},
		{
			field: 'previewBaseUrl',
			name: 'Preview Base URL',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder: 'https://example.com',
				},
			},
		},
		{
			field: 'previewOpenInNewTab',
			name: 'Open Preview in New Tab',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: 'Open preview link in a new browser tab',
				},
			},
			schema: {
				default_value: true,
			},
		},
	],
});
