<script setup lang="ts">
import type { Ref } from 'vue';
import type { AutoUpdateConfig } from './utils/autoUpdate';
import type { FieldName, StatusValue } from './utils/fieldDetection';

import { useApi } from '@directus/extensions-sdk';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { createAutoUpdater } from './utils/autoUpdate';
import {

	getProcessedFieldValue,
	getStatusValue,
	isHTMLInputElement,
	isString,

} from './utils/fieldDetection';
import { createSlug } from './utils/transliteration';
import { generateUUIDv4 } from './utils/uuid';

// Type definitions
type SlugValue = string | null;
type ValidationState = boolean;
type CollectionName = string;
type PrimaryKey = string | number | null;

// Props with proper typing
const props = withDefaults(defineProps<SlugGeneratorProps>(), {
	value: null,
	disabled: false,
	selectCollection: null,
	selectField: null,
	generationMode: 'slug',
	auto: true,
	required: true,
	separator: '-',
	lowercase: true,
	placeholder: 'Enter a slug or url...',
	primaryKey: null,
	customEmptyMessage: null,
	customFormatMessage: null,
	customUniqueMessage: null,
	allowDuplicates: false,
	status: null,
	autoUpdateMode: 'change',
	preserveExisting: false,
	updateDelay: 100,
	showPreviewLink: true,
	previewBaseUrl: '',
	previewOpenInNewTab: true,
});

// Emits with proper typing
const emit = defineEmits<{
	input: [value: string];
	validation: [isValid: boolean];
}>();

const el = ref<HTMLElement | null>(null);

// Enums for better type safety
enum ValidationStatus {
	VALID = 'valid',
	INVALID = 'invalid',
	PENDING = 'pending',
}

// Interfaces for better type definitions
interface SlugGeneratorProps {
	value?: SlugValue;
	disabled?: boolean;
	selectCollection?: CollectionName | null;
	selectField?: FieldName | null;
	generationMode?: 'slug' | 'uuid';
	auto?: boolean;
	required?: boolean;
	separator?: string;
	lowercase?: boolean;
	placeholder?: string;
	collection: CollectionName;
	field: FieldName;
	primaryKey?: PrimaryKey;
	customEmptyMessage?: string | null;
	customFormatMessage?: string | null;
	customUniqueMessage?: string | null;
	allowDuplicates?: boolean;
	status?: StatusValue;
	autoUpdateMode?: string;
	preserveExisting?: boolean;
	updateDelay?: number;
	showPreviewLink?: boolean;
	previewBaseUrl?: string | null;
	previewOpenInNewTab?: boolean;
}

interface ValidationResult {
	isValid: boolean;
	message: string;
	status: ValidationStatus;
}

interface SlugOptions {
	separator: string;
	lowercase: boolean;
}

// API and stores
const api = useApi();

// Reactive state with proper typing
const internalValue: Ref<SlugValue> = ref(props.value || '');
const isValid: Ref<ValidationState> = ref(true);
const validationMessage: Ref<string> = ref('');
const sourceValue: Ref<string> = ref('');
const isEditing: Ref<boolean> = ref(false);
const cachedValueBeforeEdit: Ref<string> = ref('');

// DOM element references
let statusInputEl: HTMLInputElement | HTMLSelectElement | null = null;
const statusFieldName = 'status' as const;

// Auto-updater instance
let autoUpdater: ReturnType<typeof createAutoUpdater> | null = null;

// Constants
const VALIDATION_INTERVAL = 1000;

const selectedSourceField = computed((): FieldName | null => {
	return props.selectField || props.selectCollection;
});

// Utility functions are now imported from fieldDetection.ts

// Core functionality with proper typing
const checkSlugUniqueness = async (slug: string): Promise<boolean> => {
	if (!props.collection || !slug) return true;

	try {
		const response = await api.get(`/items/${props.collection}`, {
			params: {
				filter: {
					[props.field]: { _eq: slug },
					...(props.primaryKey && { id: { _neq: props.primaryKey } }),
				},
				limit: 1,
			},
		});

		return response.data.data.length === 0;
	}
	catch (error) {
		console.error('Error checking slug uniqueness:', error);
		return true;
	}
};

const validateSlug = async (): Promise<ValidationResult> => {
	if (!internalValue.value) {
		return {
			isValid: true,
			message: '',
			status: ValidationStatus.VALID,
		};
	}

	const statusValue = props.status || getStatusValue();
	const isDraft = statusValue === 'draft';

	if (isDraft) {
		return {
			isValid: true,
			message: '',
			status: ValidationStatus.VALID,
		};
	}

	const isUrl = /^https?:\/\//i.test(internalValue.value);
	const slugPattern = isUrl
		? /^https?:\/\/[^\s<>"{}|\\^~[\]`]+$/i
		: /^[^\s<>"{}|\\^~[\]`]+$/;

	if (!slugPattern.test(internalValue.value)) {
		return {
			isValid: false,
			message: props.customFormatMessage || 'Please enter a valid URL or slug.',
			status: ValidationStatus.INVALID,
		};
	}

	if (!props.allowDuplicates) {
		const isUnique = await checkSlugUniqueness(internalValue.value);

		if (!isUnique) {
			return {
				isValid: false,
				message: props.customUniqueMessage || 'This slug is already in use.',
				status: ValidationStatus.INVALID,
			};
		}
	}

	return {
		isValid: true,
		message: '',
		status: ValidationStatus.VALID,
	};
};

const updateValidationState = async (): Promise<void> => {
	const result = await validateSlug();
	isValid.value = result.isValid;
	validationMessage.value = result.message;
	emit('validation', result.isValid);
};

const enableEdit = (): void => {
	if (props.disabled) return;
	cachedValueBeforeEdit.value = internalValue.value || '';
	isEditing.value = true;

	if (!internalValue.value) {
		internalValue.value = props.value || '';
	}
};

const disableEdit = (): void => {
	isEditing.value = false;
	updateValidationState();
};

const fetchSourceValue = async (): Promise<void> => {
	if (!selectedSourceField.value) return;

	const processedValue = getProcessedFieldValue(selectedSourceField.value, el.value);

	if (processedValue) {
		sourceValue.value = processedValue;
	}
};

const processInput = async (value: string | Event): Promise<void> => {
	const inputValue = isString(value)
		? value
		: (value && typeof value === 'object' && 'target' in value && isHTMLInputElement(value.target) ? value.target.value : '');

	if (props.generationMode === 'uuid') {
		internalValue.value = inputValue;
		await updateValidationState();
		emit('input', internalValue.value);
		return;
	}

	if (inputValue === '' && props.auto && selectedSourceField.value) {
		await fetchSourceValue();

		if (sourceValue.value) {
			const slugOptions: SlugOptions = {
				separator: props.separator,
				lowercase: props.lowercase,
			};
			internalValue.value = createSlug(sourceValue.value, slugOptions);
		}
		else {
			internalValue.value = '';
		}
	}
	else if (inputValue && props.auto && !cachedValueBeforeEdit.value) {
		const slugOptions: SlugOptions = {
			separator: props.separator,
			lowercase: props.lowercase,
		};
		internalValue.value = createSlug(inputValue, slugOptions);
	}
	else {
		internalValue.value = inputValue;
	}

	await updateValidationState();
	emit('input', internalValue.value);
};

const onKeyPress = (event: KeyboardEvent): void => {
	if (event.key === 'Escape') {
		internalValue.value = cachedValueBeforeEdit.value;
		disableEdit();
	}
	else if (event.key === 'Enter') {
		disableEdit();
	}
};

const regenerateSlug = async (): Promise<void> => {
	console.log('Regenerating slug...', {
		generationMode: props.generationMode,
		selectField: props.selectField,
		selectedSourceField: selectedSourceField.value,
	});

	if (props.generationMode === 'uuid') {
		internalValue.value = generateUUIDv4();
		await updateValidationState();
		emit('input', internalValue.value);
		return;
	}

	// Try to get source field value
	const fieldName = selectedSourceField.value || props.selectField || 'title';
	console.log('Looking for source field:', fieldName);

	const processedValue = getProcessedFieldValue(fieldName, el.value);
	console.log('Processed value from source field:', processedValue);

	if (processedValue) {
		sourceValue.value = processedValue;
		const slugOptions: SlugOptions = {
			separator: props.separator,
			lowercase: props.lowercase,
		};
		const newSlug = createSlug(processedValue, slugOptions);
		console.log('Generated new slug:', newSlug);

		internalValue.value = newSlug;
		await updateValidationState();
		emit('input', internalValue.value);
	}
	else {
		console.warn('No source value found for field:', fieldName);

		// Try common field names as fallback
		const fallbackFields = ['title', 'name', 'heading', 'label'];

		for (const fallbackField of fallbackFields) {
			const fallbackValue = getProcessedFieldValue(fallbackField, el.value);

			if (fallbackValue) {
				console.log(`Using fallback field "${fallbackField}" with value:`, fallbackValue);
				sourceValue.value = fallbackValue;
				const slugOptions: SlugOptions = {
					separator: props.separator,
					lowercase: props.lowercase,
				};
				const newSlug = createSlug(fallbackValue, slugOptions);
				internalValue.value = newSlug;
				await updateValidationState();
				emit('input', internalValue.value);
				return;
			}
		}

		console.error('No suitable source field found for slug generation');
	}
};

// Auto-updater management functions
const initializeAutoUpdater = (): void => {
	if (autoUpdater) {
		autoUpdater.destroy();
		autoUpdater = null;
	}

	if (props.autoUpdateMode === 'disabled' || (!props.selectField && props.generationMode !== 'uuid')) {
		return;
	}

	const config: AutoUpdateConfig = {
		sourceField: props.selectField || props.field,
		targetField: props.field,
		separator: props.separator,
		lowercase: props.lowercase,
		autoUpdate: true,
		preserveExisting: props.preserveExisting,
		updateOnChange: props.autoUpdateMode === 'change' || props.autoUpdateMode === 'realtime',
		updateOnBlur: props.autoUpdateMode === 'blur',
		updateOnFocus: props.autoUpdateMode === 'focus',
		generationMode: props.generationMode === 'uuid' ? 'uuid' : 'slug',
	};

	autoUpdater = createAutoUpdater(config, el.value);
	autoUpdater.initialize();
};

const destroyAutoUpdater = (): void => {
	if (autoUpdater) {
		autoUpdater.destroy();
		autoUpdater = null;
	}
};

// Lifecycle and watchers
let validationIntervalRef: ReturnType<typeof setInterval> | null = null;

const updateValidationUI = (): void => {
	const headerBar = document.querySelector('.header-bar');

	if (!isValid.value) {
		if (headerBar) {
			headerBar.classList.add('slug-validation-error');
			const headerBarButtons = headerBar.querySelectorAll('button:not(.slug-generator button)');

			headerBarButtons.forEach((button) => {
				if (isHTMLInputElement(button)) {
					button.disabled = true;
					button.dataset.disabledBySlug = 'true';
				}
			});
		}
	}
	else {
		const disabledButtons = document.querySelectorAll('[data-disabled-by-slug="true"]');

		disabledButtons.forEach((button) => {
			if (isHTMLInputElement(button)) {
				button.disabled = false;
				delete button.dataset.disabledBySlug;
			}
		});

		if (headerBar) {
			headerBar.classList.remove('slug-validation-error');
		}
	}
};

const statusChangeHandler = (): void => {
	updateValidationState();
};

onMounted(async (): Promise<void> => {
	if ((!internalValue.value || internalValue.value === '') && props.auto) {
		if (props.generationMode === 'uuid') {
			internalValue.value = generateUUIDv4();
			await updateValidationState();
			emit('input', internalValue.value);
		}
		else {
			const fieldName = props.selectField || 'title';
			const processedValue = getProcessedFieldValue(fieldName, el.value);

			if (processedValue) {
				sourceValue.value = processedValue;
				const slugOptions: SlugOptions = {
					separator: props.separator,
					lowercase: props.lowercase,
				};
				internalValue.value = createSlug(processedValue, slugOptions);
				await updateValidationState();
				emit('input', internalValue.value);
			}
		}
	}

	await updateValidationState();

	validationIntervalRef = setInterval(() => {
		updateValidationUI();
	}, VALIDATION_INTERVAL);

	statusInputEl = document.querySelector(`[name='${statusFieldName}']`) as HTMLInputElement | HTMLSelectElement;

	if (!statusInputEl) {
		statusInputEl = document.querySelector(`select[name='${statusFieldName}']`) as HTMLSelectElement;
	}

	if (statusInputEl) {
		statusInputEl.addEventListener('change', statusChangeHandler);
	}

	// Initialize auto-updater
	initializeAutoUpdater();
});

onUnmounted((): void => {
	if (validationIntervalRef) {
		clearInterval(validationIntervalRef);
	}

	if (statusInputEl) {
		statusInputEl.removeEventListener('change', statusChangeHandler);
	}

	// Destroy auto-updater
	destroyAutoUpdater();
});

watch(internalValue, (): void => {
	updateValidationState();
	updateValidationUI();
});

watch(() => props.value, (newVal): void => {
	if (newVal !== internalValue.value) {
		internalValue.value = newVal || '';
		updateValidationState();
	}
});

watch(
	(): string | null => {
		if (props.auto) {
			if (props.generationMode === 'uuid') return null;
			const fieldName = props.selectField || 'title';
			return getProcessedFieldValue(fieldName, el.value);
		}

		return null;
	},
	async (newValue): Promise<void> => {
		if (newValue && props.auto && (!internalValue.value || internalValue.value === '')) {
			sourceValue.value = newValue;
			const slugOptions: SlugOptions = {
				separator: props.separator,
				lowercase: props.lowercase,
			};
			internalValue.value = createSlug(newValue, slugOptions);
			await updateValidationState();
			emit('input', internalValue.value);
		}
	},
);

// Watch for auto-update configuration changes
watch(
	(): [string, boolean, number] => [
		props.autoUpdateMode || 'disabled',
		props.preserveExisting || false,
		props.updateDelay || 100,
	],
	(): void => {
		initializeAutoUpdater();
	},
);

// Watch for source field changes
watch(
	(): string | null => props.selectField,
	(): void => {
		initializeAutoUpdater();
	},
);

// Preview URL logic
const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const previewUrl = computed<string | ''>(() => {
	const value = (internalValue.value || '').trim();
	if (!value) return '';

	if (isAbsoluteUrl(value)) return value;

	const base = (props.previewBaseUrl || '').trim();
	if (!base) return '';

	const normalizedBase = base.replace(/\/+$/, '');
	const normalizedPath = value.replace(/^\/+/, '');
	return `${normalizedBase}/${normalizedPath}`;
});

const showPreviewLink = computed<boolean>(() => !!props.showPreviewLink);
const previewOpenInNewTab = computed<boolean>(() => props.previewOpenInNewTab !== false);
</script>

<template>
	<div ref="el" class="slug-generator">
		<v-input
			v-if="isEditing"
			v-model="internalValue"
			:placeholder="placeholder"
			:disabled="disabled"
			:class="{ 'has-error': !isValid }"
			autofocus
			@input="processInput"
			@blur="disableEdit"
			@keydown="onKeyPress"
		>
			<template #append>
				<v-icon
					v-if="internalValue"
					:name="isValid ? 'check' : 'warning'"
					:class="isValid ? 'valid-icon' : 'invalid-icon'"
				/>
			</template>
		</v-input>

		<div v-else class="slug-preview-mode">
			<span class="slug-display" @click="enableEdit">{{ internalValue || placeholder }}</span>

			<div class="action-buttons">
				<v-button
					v-if="!disabled"
					v-tooltip="'Edit slug'"
					x-small
					secondary
					icon
					class="action-button"
					@click="enableEdit"
				>
					<v-icon name="edit" />
				</v-button>

				<v-button
					v-if="!disabled && (props.generationMode === 'uuid' || selectedSourceField || props.selectField)"
					v-tooltip="props.generationMode === 'uuid' ? 'Generate new UUID' : 'Regenerate from source'"
					x-small
					secondary
					icon
					class="action-button"
					@click="regenerateSlug"
				>
					<v-icon name="autorenew" />
				</v-button>
			</div>
		</div>

		<div v-if="showPreviewLink && previewUrl" class="preview-container">
			<a
				class="preview-link"
				:href="previewUrl"
				:target="previewOpenInNewTab ? '_blank' : '_self'"
				rel="noopener noreferrer"
			>
				{{ previewUrl }}
			</a>
		</div>

		<div v-if="!isValid" class="validation-message">
			{{ validationMessage }}
		</div>
	</div>
</template>

<style scoped>
.slug-generator {
	width: 100%;
}

.validation-message {
	margin-top: 4px;
	font-size: 12px;
	color: var(--theme--danger);
}

.slug-preview-mode {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 0 var(--theme--form--field--input--padding);
	block-size: var(--theme--form--field--input--height);
	background-color: var(--theme--form--field--input--background);
	border: var(--theme--border-width) solid var(--theme--border-color);
	border-radius: var(--theme--border-radius);
	justify-content: space-between;
}

.slug-display-wrapper {
	flex-grow: 1;
	cursor: text;
	min-width: 0;
}

.slug-display {
	font-family: var(--theme--fonts--sans--font-family);
	color: var(--theme--foreground);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	display: block;
	width: 100%;
	cursor: pointer;
}

.action-buttons {
	display: flex;
	gap: 8px;
	margin-left: 8px;
	flex-shrink: 0;
}

.action-button {
	color: var(--theme--foreground-subdued);
}

.action-button:hover {
	color: var(--theme--foreground);
}

.has-error {
	border-color: var(--theme--danger);
}

.valid-icon {
	color: var(--theme--success);
}

.invalid-icon {
	color: var(--theme--danger);
}

.preview-container {
	margin-top: 6px;
}

.preview-link {
	font-size: 12px;
	color: var(--theme--primary);
	text-decoration: underline;
	word-break: break-all;
}
</style>
