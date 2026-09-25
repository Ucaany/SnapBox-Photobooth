import { z } from 'zod';

const SETTING_KEY_VALUES = [
  'sales_whatsapp_number',
  'email_default_reply_to',
  'email_template.tenant_invite',
  'email_template.invoice_b2b',
  'email_template.subscription_expiring',
  'feature_flag.kiosk_theme_customizer',
  'feature_flag.advanced_promo_batch',
  'feature_flag.web_device_console',
] as const;
export type SettingKey = (typeof SETTING_KEY_VALUES)[number];
export const settingKeySchema = z.enum(SETTING_KEY_VALUES);
export const SETTING_KEYS_BY_NAME = {
  salesWhatsappNumber: 'sales_whatsapp_number',
  emailDefaultReplyTo: 'email_default_reply_to',
  templateTenantInvite: 'email_template.tenant_invite',
  templateInvoiceB2b: 'email_template.invoice_b2b',
  templateSubscriptionExpiring: 'email_template.subscription_expiring',
  flagKioskThemeCustomizer: 'feature_flag.kiosk_theme_customizer',
  flagAdvancedPromoBatch: 'feature_flag.advanced_promo_batch',
  flagWebDeviceConsole: 'feature_flag.web_device_console',
} as const;
export { SETTING_KEYS_BY_NAME as SETTING_KEYS };

export const TEMPLATE_PLACEHOLDERS = {
  'email_template.tenant_invite': ['tenantName', 'ownerName', 'inviteUrl'] as const,
  'email_template.invoice_b2b': [
    'tenantName',
    'invoiceNumber',
    'invoiceAmount',
    'dueDate',
  ] as const,
  'email_template.subscription_expiring': ['tenantName', 'planName', 'expiresAt'] as const,
} as const;
export type TemplateName = keyof typeof TEMPLATE_PLACEHOLDERS;
export type TemplatePlaceholder<T extends TemplateName = TemplateName> =
  (typeof TEMPLATE_PLACEHOLDERS)[T][number];

export const whatsappNumberSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ()-]*$/)
  .transform((value) => value.replace(/[^0-9]/g, ''))
  .refine((value) => value === '' || (value.length >= 8 && value.length <= 15));
export const emailReplyToSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(255)
  .or(z.literal(''));
const templateTextSchema = z.string().trim().min(1).max(100_000);
export const emailTemplateSchema = z
  .object({ subject: templateTextSchema.max(200), body: templateTextSchema })
  .strict();
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export const emailTemplateValueSchema = emailTemplateSchema;
export const featureFlagSchema = z.boolean();
export const EMAIL_TEMPLATE_KEYS = [
  SETTING_KEYS_BY_NAME.templateTenantInvite,
  SETTING_KEYS_BY_NAME.templateInvoiceB2b,
  SETTING_KEYS_BY_NAME.templateSubscriptionExpiring,
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];
export type EmailTemplateValue = EmailTemplate;
export type FeatureFlagKey = Exclude<
  SettingKey,
  EmailTemplateKey | 'sales_whatsapp_number' | 'email_default_reply_to'
>;
export interface SettingsSnapshot {
  readonly whatsappNumber: string;
  readonly emailReplyTo: string;
  readonly templates: Record<EmailTemplateKey, EmailTemplate>;
  readonly flags: Record<FeatureFlagKey, boolean>;
}

export const settingValueSchemas = {
  sales_whatsapp_number: whatsappNumberSchema,
  email_default_reply_to: emailReplyToSchema,
  'email_template.tenant_invite': emailTemplateSchema,
  'email_template.invoice_b2b': emailTemplateSchema,
  'email_template.subscription_expiring': emailTemplateSchema,
  'feature_flag.kiosk_theme_customizer': z.boolean(),
  'feature_flag.advanced_promo_batch': z.boolean(),
  'feature_flag.web_device_console': z.boolean(),
} as const;
export type SettingValue = {
  [K in SettingKey]: z.infer<(typeof settingValueSchemas)[K]>;
};

export const settingUpdateSchema = z.union(
  SETTING_KEY_VALUES.map((key) =>
    z.object({ key: z.literal(key), value: settingValueSchemas[key] }).strict(),
  ) as unknown as [z.ZodTypeAny, ...z.ZodTypeAny[]],
) as z.ZodType<SettingUpdate>;
export type SettingUpdate =
  | { key: 'sales_whatsapp_number'; value: string }
  | { key: 'email_default_reply_to'; value: string }
  | { key: EmailTemplateKey; value: EmailTemplate }
  | { key: FeatureFlagKey; value: boolean };
export const settingsUpdateInputSchema = settingUpdateSchema;

export const SETTINGS_DEFAULTS = {
  whatsappNumber: '',
  emailReplyTo: '',
  templates: {
    [SETTING_KEYS_BY_NAME.templateTenantInvite]: {
      subject: 'Undangan {{tenantName}}',
      body: 'Halo {{ownerName}}, buka {{inviteUrl}}.',
    },
    [SETTING_KEYS_BY_NAME.templateInvoiceB2b]: {
      subject: 'Invoice {{invoiceNumber}}',
      body: 'Total {{invoiceAmount}}, jatuh tempo {{dueDate}}.',
    },
    [SETTING_KEYS_BY_NAME.templateSubscriptionExpiring]: {
      subject: 'Langganan {{tenantName}} berakhir',
      body: 'Paket {{planName}} berakhir {{expiresAt}}.',
    },
  },
  flags: {
    [SETTING_KEYS_BY_NAME.flagKioskThemeCustomizer]: false,
    [SETTING_KEYS_BY_NAME.flagAdvancedPromoBatch]: false,
    [SETTING_KEYS_BY_NAME.flagWebDeviceConsole]: false,
  },
} as const;

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;
const ANY_BRACE_PATTERN = /\{|\}/;

export function validateTemplatePlaceholders(
  name: TemplateName | EmailTemplateKey,
  template: EmailTemplate | string,
  body?: string,
): readonly string[] {
  const normalizedTemplate =
    typeof template === 'string' ? { subject: template, body: body ?? '' } : template;
  const allowed = new Set<string>(TEMPLATE_PLACEHOLDERS[name as TemplateName]);
  const found = [
    ...`${normalizedTemplate.subject}\n${normalizedTemplate.body}`.matchAll(PLACEHOLDER_PATTERN),
  ]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
  const errors = found
    .filter((placeholder) => !allowed.has(placeholder))
    .map((placeholder) => `Unsupported placeholder: ${placeholder}`);
  const withoutValid = `${normalizedTemplate.subject}\n${normalizedTemplate.body}`.replace(
    PLACEHOLDER_PATTERN,
    '',
  );
  if (ANY_BRACE_PATTERN.test(withoutValid)) errors.push('Malformed placeholder syntax');
  return [...new Set(errors)];
}

export function collectSettingsIssues(key: SettingKey, value: unknown): readonly string[] {
  const parsed = settingValueSchemas[key].safeParse(value);
  if (!parsed.success) return parsed.error.issues.map((issue) => issue.message);
  if (key.startsWith('email_template.'))
    return validateTemplatePlaceholders(key as EmailTemplateKey, parsed.data as EmailTemplate);
  return [];
}

export type ErrorCode = SettingsActionErrorCode;

export function normalizeSettingUpdate(update: SettingUpdate): SettingUpdate {
  if (update.key.startsWith('email_template.')) {
    return {
      ...update,
      value: {
        subject: (update.value as EmailTemplate).subject.trim(),
        body: (update.value as EmailTemplate).body.trim(),
      },
    } as SettingUpdate;
  }
  if (typeof update.value === 'string')
    return { ...update, value: update.value.trim() } as SettingUpdate;
  return update;
}

function escapeText(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

export function renderTemplatePreview(
  name: TemplateName,
  template: EmailTemplate,
  values: Partial<Record<TemplatePlaceholder, string>>,
): { subject: string; body: string } {
  const errors = validateTemplatePlaceholders(name, template);
  if (errors.length) throw new Error(errors.join('; '));
  const render = (text: string) =>
    text.replace(PLACEHOLDER_PATTERN, (_, key: TemplatePlaceholder) =>
      escapeText(values[key] ?? `{{${key}}}`),
    );
  return { subject: render(template.subject), body: render(template.body) };
}

export const REDACTED_SETTING_VALUE = '[redacted]';
export function redactSettingValue(key: string, value: unknown): unknown {
  if (/(secret|token|password|api[_-]?key|credential)/i.test(key)) return REDACTED_SETTING_VALUE;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactSettingValue(childKey, childValue),
      ]),
    );
  }
  return value;
}

export const SETTINGS_ACTION_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'SERVER_ERROR',
] as const;
export type SettingsActionErrorCode = (typeof SETTINGS_ACTION_ERROR_CODES)[number];
export type SettingsActionResult =
  | { readonly ok: true; readonly key: SettingKey; readonly message: string }
  | {
      readonly ok: false;
      readonly code: SettingsActionErrorCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };
